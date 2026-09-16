import { NextResponse } from "next/server";
import { generateContentWithFallback } from "@/lib/ai/gemini";
import { refineReadmeSchema } from "@/lib/validation/generate-schema";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = refineReadmeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { currentMarkdown, instruction, repoDigest } = parsed.data;

    const systemInstruction = `
You are a Principal Software Architect and Lead Technical Writer specializing in README engineering.
You are tasked with surgically refining or updating an existing README.md document based on a specific user directive.

MANDATORY RULES:
1. Apply the user's requested changes faithfully while preserving existing valid architecture, badges, and structure.
2. Ban robotic placeholders ("Implementation details not determinable", "N/A", etc.).
3. Maintain clean GitHub Flavored Markdown (GFM) formatting.
4. Return ONLY the complete updated markdown text starting directly with the # H1 heading.
5. Do NOT enclose the entire response in triple backticks.
`;

    const prompt = `
EXISTING README:
${currentMarkdown}

${repoDigest ? `REPOSITORY DIGEST CONTEXT:\n${JSON.stringify(repoDigest, null, 2)}\n` : ""}

USER REFINEMENT DIRECTIVE:
"${instruction}"

Generate the complete updated README.md now.`;

    const refined = await generateContentWithFallback(prompt, systemInstruction);
    const cleaned = refined.replace(/^```markdown\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();

    return NextResponse.json({
      success: true,
      refinedMarkdown: cleaned,
      instruction,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to refine README";
    console.error("[Refine README API Error]:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
