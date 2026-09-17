import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.username) {
      return NextResponse.json(
        { error: "Authentication required to view project history" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10), 1), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

    const userGithubId = session.user.githubId || session.user.username;
    const dbUser = await prisma.user.findFirst({
      where: {
        OR: [
          { githubId: userGithubId },
          { username: session.user.username },
        ],
      },
    });

    if (!dbUser) {
      return NextResponse.json({ history: [], total: 0 });
    }

    const [readmes, total] = await Promise.all([
      prisma.generatedReadme.findMany({
        where: {
          repository: {
            userId: dbUser.id,
          },
        },
        include: {
          repository: {
            select: {
              owner: true,
              name: true,
              fullName: true,
              defaultBranch: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip: offset,
        take: limit,
      }),
      prisma.generatedReadme.count({
        where: {
          repository: {
            userId: dbUser.id,
          },
        },
      }),
    ]);

    const history = readmes.map((r) => {
      const cleanContent = r.content.replace(/\r\n/g, "\n").trim();
      return {
        id: r.id,
        repoFullName: r.repository.fullName,
        repoOwner: r.repository.owner,
        repoName: r.repository.name,
        persona: r.persona,
        contentPreview: cleanContent.slice(0, 200),
        contentLength: r.content.length,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({ history, total });
  } catch (error: unknown) {
    console.error("[API History Error]:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
