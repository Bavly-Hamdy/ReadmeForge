import { NextResponse } from "next/server";
import { getOctokitClient } from "@/lib/github/octokit";
import { fetchRepoTree } from "@/lib/github/tree";
import { AnalysisPipeline } from "@/worker/pipeline";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      repoUrl,
      persona = "PORTFOLIO",
      customTitle,
      demoUrl,
      teamName,
      collaborators = [],
    } = body;

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

    const octokit = getOctokitClient(userAccessToken);

    // 3. Single-Call Recursive Git Trees API
    let treeResponse;
    try {
      treeResponse = await fetchRepoTree(octokit, { owner, repo });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch repository details from GitHub";
      console.error("[API Generate] GitHub tree error:", err);
      return NextResponse.json(
        { error: `Could not access repository '${fullName}'. Please check if the repo is public or if URL is correct. Details: ${message}` },
        { status: 404 }
      );
    }

    const treePaths = treeResponse.tree.map((t) => t.path).filter((p): p is string => Boolean(p));

    // 4. Run Analysis Pipeline (Stages 0–4)
    const pipeline = new AnalysisPipeline();

    // Stage 0: Structural Extraction
    const stage0 = await pipeline.runStage0(treePaths, {});

    // Stage 1: Relevance Filtering
    const stage1 = await pipeline.runStage1(treePaths);

    // Stage 2: Module Summaries
    const topModules = stage1.prioritizedFiles.slice(0, 10).map((f) => ({
      moduleName: f.path,
      files: [{ path: f.path, content: `// File ${f.path} in ${repo}` }],
    }));
    const moduleSummaries = await pipeline.runStage2(topModules);

    // Stage 3: Reduce into RepoDigest
    const digest = await pipeline.runStage3(repo, `${repo} software repository`, moduleSummaries, stage0);

    // Stage 4: Generation via Gemini 1.5 Pro with Extra Team & Architecture Params
    const markdown = await pipeline.runStage4({
      digest,
      persona: persona as "PORTFOLIO" | "OPEN_SOURCE" | "MINIMALIST" | "ENTERPRISE",
      teamName,
      demoUrl,
      customTitle,
      collaborators,
    });

    // 5. Store in SQLite Database
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
      digest,
      commitSha: treeResponse.sha,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("[API Generate] Fatal Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
