import { NextRequest, NextResponse } from "next/server";
import { translateRequestSchema } from "@/lib/validation/generate-schema";
import { getLanguageByCode } from "@/lib/i18n/languages";
import { generateContentWithFallback } from "@/lib/ai/gemini";

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = translateRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid translation request payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { markdownContent, targetLanguage, repoName } = parsed.data;
    const lang = getLanguageByCode(targetLanguage);

    if (!lang) {
      return NextResponse.json(
        { error: `Unsupported target language code: ${targetLanguage}` },
        { status: 400 }
      );
    }

    const systemPrompt = `You are a Principal Software Architect and Lead Technical Localization Specialist.
Your mission is to translate a technical GitHub README markdown document into "${lang.label}" (${lang.nativeLabel}).

CRITICAL LOCALIZATION & PRESERVATION RULES:
1. FORMAT INTEGRITY: Preserve all GitHub-Flavored Markdown (GFM) formatting, tables, lists, quotes, and badges verbatim.
2. ZERO CODE MODIFICATION: NEVER translate anything inside fenced code blocks (\`\`\`...\`\`\`) or inline code (\`...\`). Preserve all terminal commands, package names, import statements, and code logic exactly as-is.
3. PRESERVE URLS & BADGES: Do not translate URLs, image links, Shields.io badge templates, or anchors.
4. MERMAID DIAGRAMS: Keep Mermaid syntax structure intact.
5. TECHNICAL TERMINOLOGY: Use standard, modern technical terms familiar to software developers in ${lang.label} (e.g. for Arabic, keep terms like API, Framework, Docker, Database or transliterate with high engineering precision).
6. LANGUAGE SWITCHER BANNER: At the very top (before the main title), inject a clean language switcher bar:
   \`<!-- ReadmeForge Multilingual Switcher -->\`
   \`[🌐 English (Original)](README.md) • [${lang.flag} ${lang.nativeLabel}](README.${lang.code}.md)\`
   \`<br />\`

7. DIRECTIONALITY: ${
      lang.direction === "rtl"
        ? "The target language is Right-to-Left (RTL). Ensure prose flows naturally for RTL readers, while all code fences, terminal commands, and technical symbols maintain standard LTR rendering."
        : "Standard LTR rendering."
    }

OUTPUT FORMAT:
Return ONLY the translated GitHub-Flavored Markdown document. Do not wrap in conversational prefaces.`;

    const prompt = `Translate the following README for repository "${repoName || "Project"}" into ${lang.label} (${lang.nativeLabel}):\n\n${markdownContent}`;

    const translatedMarkdown = await generateContentWithFallback(prompt, systemPrompt);

    return NextResponse.json({
      success: true,
      translatedMarkdown,
      language: lang,
      filename: `README.${lang.code}.md`,
    });
  } catch (error: unknown) {
    console.error("[Translate API Error]:", error);
    const message = error instanceof Error ? error.message : "Translation processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
