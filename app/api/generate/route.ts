import { NextResponse } from "next/server";
import { getOctokitClient } from "@/lib/github/octokit";
import { fetchRepoTree, fetchBlobsThrottled, GitTreeItem } from "@/lib/github/tree";
import { AnalysisPipeline } from "@/worker/pipeline";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateMITLicense } from "@/lib/license/mit";
import { generateRepoMetadata } from "@/lib/ai/gemini";
import { generateRequestSchema } from "@/lib/validation/generate-schema";
import { Persona, CollaboratorInfo } from "@/types/repo-digest";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request payload" }, { status: 400 });
  }

  // 1. Zod Input Validation
  const validationResult = generateRequestSchema.safeParse(body);
  if (!validationResult.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: validationResult.error.flatten(),
      },
      { status: 400 }
    );
  }

  const {
    repoUrl,
    customTitle,
    demoUrl,
    teamName,
    authorName,
    copyrightYear,
    includeLicense,
    persona,
    collaborators,
  } = validationResult.data;

  // 2. Parse Owner and Repo from GitHub URL
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/#?]+)/);
  if (!match) {
    return NextResponse.json(
      { error: "Invalid GitHub URL format. Example: https://github.com/owner/repo" },
      { status: 400 }
    );
  }

  const owner = match[1];
  const repo = match[2].replace(/\.git$/, "");
  const fullName = `${owner}/${repo}`;

  // 3. User Authentication & Token resolution
  const session = await getServerSession(authOptions);
  const userAccessToken = session?.user?.accessToken;
  const serverToken = process.env.GITHUB_TOKEN;
  const effectiveToken = userAccessToken || serverToken;

  if (!effectiveToken) {
    return NextResponse.json(
      {
        error:
          "GitHub API access is unauthenticated (60 req/hr limit). " +
          "Please sign in with your GitHub account to generate READMEs.",
      },
      { status: 401 }
    );
  }

  // 4. Initialize SSE Stream Response
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  const sendEvent = async (event: string, data: unknown) => {
    try {
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      await writer.write(encoder.encode(payload));
    } catch (e) {
      console.error("[SSE Stream Write Error]:", e);
    }
  };

  // Run pipeline asynchronously inside stream worker
  (async () => {
    try {
      const octokit = getOctokitClient(effectiveToken);

      // ── Stage 0: Structural Extraction ──
      await sendEvent("stage-progress", {
        stage: 0,
        progress: 5,
        message: `Connecting to GitHub API for ${fullName}...`,
      });
      await sendEvent("file-activity", {
        action: "fetch",
        fileName: fullName,
        detail: `Fetching repository tree from GitHub...`,
        timestamp: Date.now(),
      });

      // Fetch Tree and Manifests
      let treeResponse;
      let repoDescription: string | null = null;
      try {
        treeResponse = await fetchRepoTree(octokit, { owner, repo });
        repoDescription = treeResponse.repoDescription;
      } catch (err: unknown) {
        const status = (err as any)?.status ?? (err as any)?.response?.status;
        const isRateLimit = status === 403 || status === 429;
        const message =
          err instanceof Error ? err.message : "Failed to fetch repository details from GitHub";

        if (isRateLimit) {
          throw new Error("GitHub API rate limit exceeded. Please wait a moment and try again.");
        }
        throw new Error(`Could not access repository '${fullName}'. Verify access or repository name. (${message})`);
      }

      const treePaths = treeResponse.tree
        .map((t) => t.path)
        .filter((p): p is string => Boolean(p));

      const treeMap = new Map<string, GitTreeItem>();
      let dirCount = 0;
      for (const item of treeResponse.tree) {
        if (item.path && item.type === "blob") {
          treeMap.set(item.path, item);
        } else if (item.type === "tree") {
          dirCount++;
        }
      }

      await sendEvent("file-activity", {
        action: "detect",
        fileName: "repository-tree",
        detail: `Found ${treePaths.length} files across ${dirCount} directories`,
        timestamp: Date.now(),
      });

      await sendEvent("stage-progress", {
        stage: 0,
        progress: 10,
        message: `Scanning configuration manifests...`,
      });

      const manifestFileNames = [
        "package.json",
        "requirements.txt",
        "pyproject.toml",
        "Pipfile",
        "uv.lock",
        "Cargo.toml",
        "go.mod",
        "pom.xml",
        "build.gradle",
        "turbo.json",
        "nx.json",
        "lerna.json",
        "pnpm-workspace.yaml",
        "pnpm-workspace.yml",
        "go.work",
        "openapi.json",
        "openapi.yaml",
        "openapi.yml",
        "swagger.json",
        "swagger.yaml",
        ".env.example",
        ".env.local",
      ];
      const manifestPaths = treePaths.filter((path) => {
        const name = path.split("/").pop();
        return name && manifestFileNames.includes(name);
      });

      // Emit file-activity for each manifest found
      for (const mp of manifestPaths) {
        await sendEvent("file-activity", {
          action: "parse",
          fileName: mp.split("/").pop() || mp,
          detail: `Found configuration manifest: ${mp}`,
          timestamp: Date.now(),
        });
      }

      const manifestItems = manifestPaths
        .map((p) => ({ path: p, sha: treeMap.get(p)?.sha ?? "" }))
        .filter((x) => x.sha);

      await sendEvent("stage-progress", {
        stage: 0,
        progress: 15,
        message: `Fetching ${manifestItems.length} manifest file contents...`,
      });

      const manifestContents: Record<string, string> = await fetchBlobsThrottled(
        octokit,
        owner,
        repo,
        manifestItems,
        Boolean(effectiveToken)
      );

      // Initialize Pipeline
      const pipeline = new AnalysisPipeline();

      // Stage 0: Structural Extraction
      const stage0 = await pipeline.runStage0(treePaths, manifestContents);

      // Report detected ecosystems
      if (stage0.ecosystems.length > 0) {
        await sendEvent("file-activity", {
          action: "detect",
          fileName: "ecosystems",
          detail: `Detected: ${stage0.ecosystems.join(", ")}`,
          timestamp: Date.now(),
        });
      }

      if (stage0.monorepoInfo?.isMonorepo) {
        await sendEvent("file-activity", {
          action: "detect",
          fileName: "monorepo",
          detail: `Monorepo workspace (${stage0.monorepoInfo.tool}) detected with ${stage0.monorepoInfo.packages.length} packages`,
          timestamp: Date.now(),
        });
      }

      if (stage0.openApiSpec) {
        await sendEvent("file-activity", {
          action: "detect",
          fileName: "openapi",
          detail: `OpenAPI spec (${stage0.openApiSpec.title} v${stage0.openApiSpec.version}) with ${stage0.openApiSpec.endpoints.length} endpoints`,
          timestamp: Date.now(),
        });
      }

      await sendEvent("stage-progress", {
        stage: 0,
        progress: 20,
        message: `Structural extraction complete — ${manifestPaths.length} manifests parsed`,
      });
      await sendEvent("file-activity", {
        action: "parse",
        fileName: "structure",
        detail: `Structural extraction complete`,
        timestamp: Date.now(),
      });

      // ── Stage 1: Relevance Filtering ──
      await sendEvent("stage-progress", {
        stage: 1,
        progress: 25,
        message: `Filtering relevant files from ${treePaths.length} total entries...`,
      });
      await sendEvent("file-activity", {
        action: "analyze",
        fileName: "file-filter",
        detail: `Analyzing ${treePaths.length} files for relevance...`,
        timestamp: Date.now(),
      });

      const stage1 = await pipeline.runStage1(treePaths);

      // Report categorized file counts
      const routeCount = stage1.prioritizedFiles.filter((f) => f.category === "route").length;
      const entryCount = stage1.prioritizedFiles.filter((f) => f.category === "entry").length;
      const configCount = stage1.prioritizedFiles.filter((f) => f.category === "config").length;

      await sendEvent("file-activity", {
        action: "detect",
        fileName: "categories",
        detail: `Found ${routeCount} API routes, ${entryCount} entry points, ${configCount} configs`,
        timestamp: Date.now(),
      });

      await sendEvent("stage-progress", {
        stage: 1,
        progress: 35,
        message: `Filtered ${stage1.filteredPaths.length} relevant files from ${treePaths.length} total`,
      });
      await sendEvent("file-activity", {
        action: "analyze",
        fileName: "filter-result",
        detail: `Kept ${stage1.filteredPaths.length} of ${treePaths.length} files after filtering`,
        timestamp: Date.now(),
      });

      // ── Stage 2: Code Summarization ──
      await sendEvent("stage-progress", {
        stage: 2,
        progress: 40,
        message: `Fetching top priority source files for AI analysis...`,
      });

      const topPrioritized = stage1.prioritizedFiles.slice(0, 10);
      const codeItems = topPrioritized
        .map((f) => ({ path: f.path, sha: treeMap.get(f.path)?.sha ?? "" }))
        .filter((x) => x.sha);

      // Emit file-activity for each code file being fetched
      for (const item of codeItems) {
        await sendEvent("file-activity", {
          action: "fetch",
          fileName: item.path,
          detail: `Fetching source code for analysis...`,
          timestamp: Date.now(),
        });
      }

      const fetchedCode = await fetchBlobsThrottled(
        octokit,
        owner,
        repo,
        codeItems,
        Boolean(effectiveToken)
      );

      await sendEvent("stage-progress", {
        stage: 2,
        progress: 50,
        message: `Sending ${codeItems.length} modules to Gemini AI for summarization...`,
      });
      await sendEvent("file-activity", {
        action: "analyze",
        fileName: "gemini-summarize",
        detail: `Sending ${codeItems.length} modules to Gemini AI...`,
        timestamp: Date.now(),
      });

      const topModules = topPrioritized.map((f) => ({
        moduleName: f.path,
        files: [
          {
            path: f.path,
            content: (fetchedCode[f.path] ?? `// File ${f.path}`).slice(0, 2500),
          },
        ],
      }));

      const moduleSummaries = await pipeline.runStage2(topModules);

      await sendEvent("stage-progress", {
        stage: 2,
        progress: 60,
        message: `AI summarized ${moduleSummaries.length} code modules`,
      });
      await sendEvent("file-activity", {
        action: "analyze",
        fileName: "summaries",
        detail: `Gemini AI summarized ${moduleSummaries.length} modules successfully`,
        timestamp: Date.now(),
      });

      // ── Stage 3: Reduce into RepoDigest ──
      await sendEvent("stage-progress", {
        stage: 3,
        progress: 65,
        message: `Assembling architecture topology & dependency graph...`,
      });
      await sendEvent("file-activity", {
        action: "write",
        fileName: "architecture",
        detail: `Assembling architecture topology...`,
        timestamp: Date.now(),
      });

      const digest = await pipeline.runStage3(
        `${owner}/${repo}`,
        repoDescription || null,
        moduleSummaries,
        stage0
      );

      await sendEvent("stage-progress", {
        stage: 3,
        progress: 75,
        message: `Architecture digest assembled — ${digest.techStack.frameworks.length + 1} technologies detected`,
      });

      const techList = [digest.techStack.language, ...digest.techStack.frameworks].filter(Boolean);
      await sendEvent("file-activity", {
        action: "detect",
        fileName: "tech-stack",
        detail: `Detected tech stack: ${techList.slice(0, 6).join(", ")}${techList.length > 6 ? "..." : ""}`,
        timestamp: Date.now(),
      });

      const licenseAuthor = authorName || teamName || session?.user?.name || owner;
      const finalCopyrightYear = copyrightYear || new Date().getFullYear().toString();

      // ── Stage 4: Gemini README Generation ──
      await sendEvent("stage-progress", {
        stage: 4,
        progress: 78,
        message: `Generating ${persona} style README via Gemini AI...`,
      });
      await sendEvent("file-activity", {
        action: "write",
        fileName: "README.md",
        detail: `Generating ${persona} README markdown and diagrams...`,
        timestamp: Date.now(),
      });

      const normalizedCollaborators: CollaboratorInfo[] = (collaborators || []).map((c) => ({
        name: c.name,
        role: c.role ?? null,
        githubHandle: c.githubHandle ?? null,
      }));

      const markdown = await pipeline.runStage4({
        digest,
        persona: persona as Persona,
        teamName,
        demoUrl,
        customTitle,
        authorName: licenseAuthor,
        copyrightYear: finalCopyrightYear,
        collaborators: normalizedCollaborators,
      });

      await sendEvent("file-activity", {
        action: "write",
        fileName: "README.md",
        detail: `README generated — ${markdown.length.toLocaleString()} characters`,
        timestamp: Date.now(),
      });

      // Generate suggested metadata & license
      await sendEvent("stage-progress", {
        stage: 4,
        progress: 88,
        message: `Generating repository metadata & topics...`,
      });
      await sendEvent("file-activity", {
        action: "write",
        fileName: "metadata",
        detail: `Generating repository description, topics & release notes...`,
        timestamp: Date.now(),
      });

      const metadataRes = await generateRepoMetadata(digest);

      await sendEvent("stage-progress", {
        stage: 4,
        progress: 92,
        message: `Generating license file...`,
      });

      const licenseContent =
        includeLicense !== false
          ? generateMITLicense(licenseAuthor, Number(finalCopyrightYear) || new Date().getFullYear())
          : null;

      if (licenseContent) {
        await sendEvent("file-activity", {
          action: "write",
          fileName: "LICENSE",
          detail: `Generated MIT License for ${licenseAuthor}`,
          timestamp: Date.now(),
        });
      }

      await sendEvent("stage-progress", {
        stage: 4,
        progress: 95,
        message: "Persisting generation record to database...",
      });
      await sendEvent("file-activity", {
        action: "write",
        fileName: "database",
        detail: `Persisting generation record...`,
        timestamp: Date.now(),
      });

      // Non-blocking Database Persistence
      try {
        let dbUser = null;
        if (session?.user?.username) {
          const userGithubId = session.user.githubId || session.user.username;
          dbUser = await prisma.user.upsert({
            where: { githubId: userGithubId },
            update: {
              username: session.user.username,
              avatarUrl: session.user.image,
              accessToken: session.user.accessToken,
            },
            create: {
              githubId: userGithubId,
              username: session.user.username,
              email: session.user.email,
              avatarUrl: session.user.image,
              accessToken: session.user.accessToken,
            },
          });
        }

        if (!dbUser) {
          dbUser = await prisma.user.upsert({
            where: { githubId: "anonymous" },
            update: {},
            create: {
              githubId: "anonymous",
              username: "Anonymous User",
            },
          });
        }

        const dbRepo = await prisma.repository.upsert({
          where: { fullName },
          update: {
            lastAnalyzedSha: treeResponse.sha,
            userId: dbUser.id,
          },
          create: {
            owner,
            name: repo,
            fullName,
            defaultBranch: "main",
            userId: dbUser.id,
            lastAnalyzedSha: treeResponse.sha,
          },
        });

        await prisma.generatedReadme.create({
          data: {
            repositoryId: dbRepo.id,
            persona,
            content: markdown,
          },
        });
      } catch (dbError) {
        console.warn("[API Generate] DB persistence warning (non-fatal):", dbError);
      }

      await sendEvent("stage-progress", {
        stage: 4,
        progress: 98,
        message: "Finalizing documentation and badges...",
      });
      await sendEvent("file-activity", {
        action: "write",
        fileName: "finalize",
        detail: `Finalizing documentation — all stages complete`,
        timestamp: Date.now(),
      });

      // Send Complete Event
      await sendEvent("complete", {
        success: true,
        markdown,
        licenseContent,
        suggestedDescription: metadataRes.suggestedDescription,
        suggestedTopics: metadataRes.suggestedTopics,
        releaseNotes: metadataRes.releaseNotes,
        digest,
        commitSha: treeResponse.sha,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Internal Server Error";
      console.error("[API Generate Stream Error]:", err);
      await sendEvent("error", { error: message });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
