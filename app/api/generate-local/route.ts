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

      // Stage 0: Structural Extraction
      await sendEvent("stage-progress", {
        stage: 0,
        progress: 25,
        message: `Parsed local file tree (${treePaths.length} files detected)`,
      });

      const stage0 = await pipeline.runStage0(treePaths, fileContents);

      // Stage 1: Relevance Filtering
      await sendEvent("stage-progress", {
        stage: 1,
        progress: 45,
        message: `Filtering source code files...`,
      });

      const stage1 = await pipeline.runStage1(treePaths);

      // Stage 2: Code Module Summarization
      await sendEvent("stage-progress", {
        stage: 2,
        progress: 65,
        message: `Summarizing core code modules via Gemini AI...`,
      });

      const topPrioritized = stage1.prioritizedFiles.slice(0, 10);
      const topModules = topPrioritized.map((f) => ({
        moduleName: f.path,
        files: [
          {
            path: f.path,
            content: (fileContents[f.path] ?? `// File ${f.path}`).slice(0, 2500),
          },
        ],
      }));

      const moduleSummaries = await pipeline.runStage2(topModules);

      // Stage 3: Reduce into RepoDigest
      await sendEvent("stage-progress", {
        stage: 3,
        progress: 80,
        message: `Synthesizing architecture dependencies & tech stack...`,
      });

      const digest = await pipeline.runStage3(
        repoTitle,
        `Locally uploaded repository project: ${repoTitle}`,
        moduleSummaries,
        stage0
      );

      const licenseAuthor = authorName || teamName || session?.user?.name || "Project Author";
      const finalCopyrightYear = copyrightYear || new Date().getFullYear().toString();

      // Stage 4: Gemini README Generation
      await sendEvent("stage-progress", {
        stage: 4,
        progress: 92,
        message: `Generating ${persona} style README markdown...`,
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

      const metadataRes = await generateRepoMetadata(digest);
      const licenseContent =
        includeLicense !== false
          ? generateMITLicense(licenseAuthor, Number(finalCopyrightYear) || new Date().getFullYear())
          : null;

      await sendEvent("stage-progress", {
        stage: 4,
        progress: 98,
        message: "Finalizing documentation and badges...",
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
