import { NextResponse } from "next/server";
import { getOctokitClient } from "@/lib/github/octokit";
import { fetchRepoTree, fetchBlobContent, fetchBlobsThrottled, GitTreeItem } from "@/lib/github/tree";
import { AnalysisPipeline } from "@/worker/pipeline";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateMITLicense } from "@/lib/license/mit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      repoUrl,
      customTitle,
      demoUrl,
      teamName,
      authorName,
      includeLicense = true,
      collaborators = [],
    } = body;

    // Persona is permanently locked to ENTERPRISE on the server
    const persona = "ENTERPRISE" as const;

    if (!repoUrl || typeof repoUrl !== "string") {
      return NextResponse.json(
        { error: "A valid GitHub repository URL is required." },
        { status: 400 }
      );
    }

    // 1. Parse Owner and Repo from GitHub URL
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

    // 2. Obtain user session if logged in
    const session = await getServerSession(authOptions);
    const userAccessToken = session?.user?.accessToken;
    const serverToken = process.env.GITHUB_TOKEN;
    const effectiveToken = userAccessToken || serverToken;

    // Warn early if completely unauthenticated — 60 req/hr is exhausted easily
    if (!effectiveToken) {
      console.warn(
        "[API Generate] No GitHub token available (no user session + no GITHUB_TOKEN env). " +
          "Rate limit is 60 req/hr — generation will likely fail for anything beyond tiny repos."
      );
      return NextResponse.json(
        {
          error:
            "GitHub API access is unauthenticated (60 req/hr limit). " +
            "Please sign in with your GitHub account to generate READMEs. " +
            "Alternatively, add a GITHUB_TOKEN to your .env file for server-side access.",
        },
        { status: 401 }
      );
    }

    const octokit = getOctokitClient(effectiveToken);

    // 3. Single-Call Recursive Git Trees API
    let treeResponse;
    let repoDescription: string | null = null;
    try {
      treeResponse = await fetchRepoTree(octokit, { owner, repo });
      repoDescription = treeResponse.repoDescription;
    } catch (err: unknown) {
      const status = (err as any)?.status ?? (err as any)?.response?.status;
      const isRateLimit = status === 403 || status === 429;
      const message = err instanceof Error ? err.message : "Failed to fetch repository details from GitHub";
      console.error("[API Generate] GitHub tree error:", err);

      if (isRateLimit) {
        return NextResponse.json(
          {
            error:
              "GitHub API rate limit exceeded. " +
              (userAccessToken
                ? "Please wait a moment and try again."
                : "Sign in with your GitHub account to get a higher rate limit (5,000 req/hr vs 60 req/hr)."),
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: `Could not access repository '${fullName}'. Please check if the repo is public or if the URL is correct. Details: ${message}` },
        { status: 404 }
      );
    }

    const treePaths = treeResponse.tree.map((t) => t.path).filter((p): p is string => Boolean(p));

    // Map tree items by path for SHA lookups (only blobs/files, not directories/trees)
    const treeMap = new Map<string, GitTreeItem>();
    for (const item of treeResponse.tree) {
      if (item.path && item.type === "blob") {
        treeMap.set(item.path, item);
      }
    }

    const manifestFileNames = [
      "package.json", "requirements.txt", "pyproject.toml", "Pipfile", "uv.lock",
      "Cargo.toml", "go.mod", "pom.xml", "build.gradle", ".env.example", ".env.local"
    ];
    const manifestPaths = treePaths.filter((path) => {
      const name = path.split("/").pop();
      return name && manifestFileNames.includes(name);
    });

    const manifestContents: Record<string, string> = {};
    // Use throttled blob fetching — sequential for unauthenticated users (60 req/hr),
    // parallel for authenticated users with OAuth token (5,000 req/hr)
    const manifestItems = manifestPaths
      .map((p) => ({ path: p, sha: treeMap.get(p)?.sha ?? "" }))
      .filter((x) => x.sha);

    const fetchedManifests = await fetchBlobsThrottled(
      octokit,
      owner,
      repo,
      manifestItems,
      Boolean(effectiveToken)
    );
    Object.assign(manifestContents, fetchedManifests);

    // Run Analysis Pipeline (Stages 0–4)
    const pipeline = new AnalysisPipeline();

    // Stage 0: Structural Extraction with Real Manifests
    const stage0 = await pipeline.runStage0(treePaths, manifestContents);

    // Stage 1: Relevance Filtering
    const stage1 = await pipeline.runStage1(treePaths);

    // Stage 2: Fetch actual code snippets for top prioritized files (throttle-aware)
    const topPrioritized = stage1.prioritizedFiles.slice(0, 10);
    const codeItems = topPrioritized
      .map((f) => ({ path: f.path, sha: treeMap.get(f.path)?.sha ?? "" }))
      .filter((x) => x.sha);

    const fetchedCode = await fetchBlobsThrottled(
      octokit,
      owner,
      repo,
      codeItems,
      Boolean(effectiveToken)
    );

    const topModules = topPrioritized.map((f) => ({
      moduleName: f.path,
      files: [{ path: f.path, content: (fetchedCode[f.path] ?? `// File ${f.path}`).slice(0, 2500) }],
    }));

    const moduleSummaries = await pipeline.runStage2(topModules);

    // Stage 3: Reduce into RepoDigest
    // Pass the GitHub repo description from treeResponse metadata.
    // Fallback to a descriptive string only when description is truly absent.
    const digest = await pipeline.runStage3(
      `${owner}/${repo}`,
      repoDescription || null,
      moduleSummaries,
      stage0
    );

    // Stage 4: Generation via Gemini 1.5 Pro with Extra Team & Architecture Params
    const markdown = await pipeline.runStage4({
      digest,
      persona: persona as "PORTFOLIO" | "OPEN_SOURCE" | "MINIMALIST" | "ENTERPRISE",
      teamName,
      demoUrl,
      customTitle,
      collaborators,
    });

    // Generate MIT License content if requested
    const licenseAuthor = authorName || teamName || session?.user?.name || owner;
    const licenseContent = includeLicense !== false ? generateMITLicense(licenseAuthor) : null;

    // 5. Store in Database
    try {
      let dbUser = null;
      if (session?.user?.username) {
        dbUser = await prisma.user.findFirst({
          where: { username: session.user.username },
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
        update: {},
        create: {
          owner,
          name: repo,
          fullName,
          defaultBranch: "main",
          userId: dbUser.id,
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

    return NextResponse.json({
      success: true,
      markdown,
      licenseContent,
      digest,
      commitSha: treeResponse.sha,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("[API Generate] Fatal Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
