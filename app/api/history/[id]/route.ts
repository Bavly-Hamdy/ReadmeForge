import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "Missing record ID" }, { status: 400 });
    }

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
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const readme = await prisma.generatedReadme.findUnique({
      where: { id },
      include: {
        repository: true,
      },
    });

    if (!readme) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    // Ownership check: must belong to the user
    if (readme.repository.userId !== dbUser.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      id: readme.id,
      persona: readme.persona,
      content: readme.content,
      createdAt: readme.createdAt.toISOString(),
      updatedAt: readme.updatedAt.toISOString(),
      repository: {
        id: readme.repository.id,
        owner: readme.repository.owner,
        name: readme.repository.name,
        fullName: readme.repository.fullName,
        defaultBranch: readme.repository.defaultBranch,
        url: `https://github.com/${readme.repository.fullName}`,
      },
    });
  } catch (error: unknown) {
    console.error("[API History Item GET Error]:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "Missing record ID" }, { status: 400 });
    }

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
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const readme = await prisma.generatedReadme.findUnique({
      where: { id },
      include: {
        repository: true,
      },
    });

    if (!readme) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    if (readme.repository.userId !== dbUser.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.generatedReadme.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Generation record deleted" });
  } catch (error: unknown) {
    console.error("[API History Item DELETE Error]:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
