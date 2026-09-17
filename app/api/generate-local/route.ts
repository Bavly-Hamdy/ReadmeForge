import { NextResponse } from "next/server";
import { AnalysisPipeline } from "@/worker/pipeline";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateMITLicense } from "@/lib/license/mit";
import { generateRepoMetadata } from "@/lib/ai/gemini";
import { generateLocalRequestSchema } from "@/lib/validation/generate-schema";
import { Persona, CollaboratorInfo } from "@/types/repo-digest";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request payload" }, { status: 400 });
  }

  // 1. Zod Validation
  const validationResult = generateLocalRequestSchema.safeParse(body);
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
    treePaths,
    fileContents,
    customTitle,
    demoUrl,
    teamName,
    authorName,
    copyrightYear,
    includeLicense,
    persona,
    collaborators,
  } = validationResult.data;

  const repoTitle = customTitle || "Local Project";
  const session = await getServerSession(authOptions);

  // 2. Initialize SSE Stream Response
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  const sendEvent = async (event: string, data: unknown) => {
    try {
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      await writer.write(encoder.encode(payload));
    } catch (e) {
      console.error("[SSE Local Stream Write Error]:", e);
    }
  };

  (async () => {
    try {
      const pipeline = new AnalysisPipeline();

      // ── Stage 0: Structural Extraction ──
      await sendEvent("stage-progress", {
        stage: 0,
        progress: 5,
        message: `Parsing uploaded project structure...`,
      });
      await sendEvent("file-activity", {
        action: "parse",
        fileName: repoTitle,
        detail: `Parsing local project file tree...`,
        timestamp: Date.now(),
      });

      // Count directories
      const dirSet = new Set<string>();
      for (const p of treePaths) {
        const parts = p.split("/");
        for (let i = 1; i < parts.length; i++) {
          dirSet.add(parts.slice(0, i).join("/"));
        }
      }

      await sendEvent("file-activity", {
        action: "detect",
        fileName: "project-tree",
        detail: `Found ${treePaths.length} files across ${dirSet.size} directories`,
        timestamp: Date.now(),
      });

      await sendEvent("stage-progress", {
        stage: 0,
        progress: 12,
        message: `Scanning configuration manifests...`,
      });

      const stage0 = await pipeline.runStage0(treePaths, fileContents);

      // Emit manifests found
      const manifestKeys = Object.keys(stage0.manifests);
      for (const mk of manifestKeys) {
        await sendEvent("file-activity", {
          action: "parse",
          fileName: mk.split("/").pop() || mk,
          detail: `Found configuration manifest: ${mk}`,
          timestamp: Date.now(),
        });
      }

      // Report detected ecosystems
      if (stage0.ecosystems.length > 0) {
        await sendEvent("file-activity", {
          action: "detect",
          fileName: "ecosystems",
          detail: `Detected: ${stage0.ecosystems.join(", ")}`,
          timestamp: Date.now(),
        });
      }

      await sendEvent("stage-progress", {
        stage: 0,
        progress: 20,
        message: `Structural extraction complete — ${manifestKeys.length} manifests parsed`,
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

      // ── Stage 2: Code Module Summarization ──
      await sendEvent("stage-progress", {
        stage: 2,
        progress: 40,
        message: `Preparing top priority source files for AI analysis...`,
      });

      const topPrioritized = stage1.prioritizedFiles.slice(0, 10);

      // Emit file-activity for each code file being analyzed
      for (const f of topPrioritized) {
        await sendEvent("file-activity", {
          action: "fetch",
          fileName: f.path,
          detail: `Reading source code for analysis...`,
          timestamp: Date.now(),
        });
      }

      const topModules = topPrioritized.map((f) => ({
        moduleName: f.path,
        files: [
          {
            path: f.path,
            content: (fileContents[f.path] ?? `// File ${f.path}`).slice(0, 2500),
          },
        ],
      }));

      await sendEvent("stage-progress", {
        stage: 2,
        progress: 50,
        message: `Sending ${topPrioritized.length} modules to Gemini AI for summarization...`,
      });
      await sendEvent("file-activity", {
        action: "analyze",
        fileName: "gemini-summarize",
        detail: `Sending ${topPrioritized.length} modules to Gemini AI...`,
        timestamp: Date.now(),
      });

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
        repoTitle,
        `Locally uploaded repository project: ${repoTitle}`,
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

      const licenseAuthor = authorName || teamName || session?.user?.name || "Project Author";
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
        customTitle: repoTitle,
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

      // Database Persistence (non-blocking)
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
          where: { fullName: `local/${repoTitle.toLowerCase().replace(/\s+/g, "-")}` },
          update: {},
          create: {
            owner: "local",
            name: repoTitle,
            fullName: `local/${repoTitle.toLowerCase().replace(/\s+/g, "-")}`,
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
      } catch (dbErr) {
        console.warn("[Local Generate] DB persistence warning (non-fatal):", dbErr);
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

      await sendEvent("complete", {
        success: true,
        markdown,
        licenseContent,
        suggestedDescription: metadataRes.suggestedDescription,
        suggestedTopics: metadataRes.suggestedTopics,
        releaseNotes: metadataRes.releaseNotes,
        digest,
        commitSha: null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Internal Server Error";
      console.error("[Local Generate Stream Error]:", err);
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
