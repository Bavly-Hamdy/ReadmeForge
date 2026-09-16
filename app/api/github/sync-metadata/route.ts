import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOctokitClient } from "@/lib/github/octokit";
import { updateRepoDetails, createInitialRelease } from "@/lib/github/metadata";

import { syncMetadataSchema } from "@/lib/validation/generate-schema";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userAccessToken = session?.user?.accessToken;

    if (!userAccessToken) {
      return NextResponse.json(
        {
          error:
            "Authentication required. Please sign in with your GitHub account to update repo metadata and publish releases.",
        },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = syncMetadataSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      repoUrl,
      description,
      homepage,
      topics,
      publishRelease,
      releaseNotes,
      tagName,
    } = parsed.data;

    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/#?]+)/)!;
    const owner = match[1];
    const repo = match[2].replace(/\.git$/, "");
    const octokit = getOctokitClient(userAccessToken);

    // 1. Update Repository Details (Description, Website URL, Topics)
    await updateRepoDetails(octokit, {
      owner,
      repo,
      description: (description || "").trim(),
      homepage: (homepage || "").trim(),
      topics: Array.isArray(topics) ? topics : [],
    });

    let releaseData = null;

    // 2. Publish Official v1.0.0 Release if requested
    if (publishRelease && releaseNotes) {
      releaseData = await createInitialRelease(
        octokit,
        owner,
        repo,
        releaseNotes,
        tagName
      );
    }

    return NextResponse.json({
      success: true,
      message: "GitHub Repository metadata synced successfully!",
      updated: {
        owner,
        repo,
        description,
        homepage,
        topics,
      },
      release: releaseData,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update GitHub repository metadata";
    console.error("[GitHub Sync Metadata Error]:", error);

    const status = (error as any)?.status ?? 500;
    return NextResponse.json(
      { error: `GitHub API error: ${message}` },
      { status: status === 403 || status === 401 ? status : 500 }
    );
  }
}
