import { GoogleGenerativeAI } from "@google/generative-ai";
import { RepoDigest, ReadmeGenerationParams } from "@/types/repo-digest";
import { PERSONA_REGISTRY } from "@/lib/ai/personas";

let _genAI: GoogleGenerativeAI | null = null;

export function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "[GEMINI FATAL] GEMINI_API_KEY is not configured. " +
        "Add it to your .env file."
      );
    }
    _genAI = new GoogleGenerativeAI(apiKey);
  }
  return _genAI;
}

export const genAI = new Proxy({} as GoogleGenerativeAI, {
  get(_, prop: string | symbol) {
    return (getGenAI() as any)[prop];
  },
});

const CANDIDATE_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-3.5-flash",
];

/**
 * Robust content generation helper with model fallback list
 */
export async function generateContentWithFallback(prompt: string, systemInstruction?: string): Promise<string> {
  let lastError: unknown = null;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        ...(systemInstruction ? { systemInstruction } : {}),
      });

      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err: any) {
      console.warn(`[Gemini AI] Model '${modelName}' error, trying next candidate...`, err?.message || err);
      lastError = err;

      // If rate limited (429), pause briefly to let quota window cool down
      const isRateLimit = err?.status === 429 || String(err?.message || "").includes("429") || String(err?.message || "").includes("Quota exceeded");
      if (isRateLimit) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  }

  throw lastError || new Error("All Gemini model candidates failed.");
}

/**
 * Generates a comprehensive Enterprise SaaS README.md.
 */
export async function generateReadmeFromDigest(
  params: ReadmeGenerationParams
): Promise<string> {
  const {
    digest,
    teamName,
    demoUrl,
    customTitle,
    authorName,
    copyrightYear,
    collaborators = [],
  } = params;

  const effectiveAuthor = authorName || teamName || digest.repoName.split("/")[0] || "Repository Author";
  const effectiveYear = copyrightYear || new Date().getFullYear().toString();

  // ── Pre-build explicit field extractions for surgical prompt injection ──────
  const repoTitle = customTitle || digest.repoName;
  const repoDescription = digest.description ?? `Technical implementation repository for ${repoTitle}`;
  const licenseText = digest.license ?? "MIT";

  // Detect ecosystem & language
  const isPython = digest.techStack.language === "Python" || (digest.treePathsSample ?? []).some((p) => p.endsWith(".py"));
  const isRust = digest.techStack.language === "Rust" || (digest.treePathsSample ?? []).some((p) => p.endsWith(".rs"));
  const isGo = digest.techStack.language === "Go" || (digest.treePathsSample ?? []).some((p) => p.endsWith(".go"));

  // Tech stack: flatten all real deps into a single de-duplicated list
  const allDeps = [
    digest.techStack.language,
    ...digest.techStack.frameworks,
    ...digest.techStack.databases,
    ...Object.keys(digest.packageManifest?.dependencies ?? {}),
    ...Object.keys(digest.packageManifest?.devDependencies ?? {}),
  ].filter(Boolean);
  const uniqueDeps = [...new Set(allDeps)];

  // Build ecosystem-aware scripts list
  let scriptEntries = Object.entries(digest.packageManifest?.scripts ?? {});
  if (scriptEntries.length === 0) {
    if (isPython) {
      const isUv = (digest.treePathsSample ?? []).some((p) => p.endsWith("uv.lock"));
      scriptEntries = [
        ["install", isUv ? "uv sync" : "pip install -r requirements.txt"],
        ["run", isUv ? "uv run python main.py" : "python main.py"],
      ];
    } else if (isRust) {
      scriptEntries = [
        ["build", "cargo build --release"],
        ["run", "cargo run"],
      ];
    } else if (isGo) {
      scriptEntries = [
        ["build", "go build -o app ."],
        ["run", "go run ."],
      ];
    }
  }

  const declaredScripts = scriptEntries
    .map(([k, v]) => `  "${k}": "${v}"`)
    .join("\n");

  // Env vars
  const hasEnvVars = digest.envVars.length > 0;
  const envVarBlock = hasEnvVars
    ? digest.envVars.map((e) => `  - ${e.name} (required: ${e.required}) — ${e.description ?? "Configured in environment"}`).join("\n")
    : "  No custom environment variables required.";

  // API routes or CLI scripts
  const hasRoutes = digest.apiRoutes.length > 0;
  const routeBlock = hasRoutes
    ? digest.apiRoutes.map((r) => `  ${r.method} ${r.path} — ${r.description ?? "Route handler"}`).join("\n")
    : "  CLI / Script execution repository — no HTTP routes.";

  // Detect image assets in repository
  const assetPaths = (digest.treePathsSample ?? []).filter((p) =>
    /\.(png|jpg|jpeg|gif|svg)$/i.test(p)
  );

  // Modules
  const moduleBlock = digest.modules
    .map((m) => `  - ${m.name}: ${m.purpose} (exports/functions: ${m.keyExports.join(", ") || "core logic"})`)
    .join("\n");

  // Tree paths (cap at 60 for prompt size)
  const treeSample = (digest.treePathsSample ?? []).slice(0, 60).join("\n  ");

  // Collaborators
  const personaKey = params.persona || "ENTERPRISE";
  const personaConfig = PERSONA_REGISTRY[personaKey] || PERSONA_REGISTRY.ENTERPRISE;

  const collabList = collaborators.length > 0
    ? collaborators.map((c) => `  - ${c.name} (${c.role ?? "Contributor"})${c.githubHandle ? ` @${c.githubHandle}` : ""}`).join("\n")
    : "  Community Contributors";

  const masterSystemPrompt = `
ROLE & MANDATE
──────────────
You are a Principal Software Architect and Lead Technical Writer. Your mandate is to produce a
WORLD-CLASS, HUMAN-GRADE, HIGH-DENSITY README for "${repoTitle}" tailored to the "${personaConfig.label}" style.

STYLE & TONE DIRECTIVE:
${personaConfig.toneDirective}

════════════════════════════════════════════════════════════════════
STRICT ZERO-ROBOTIC-FLUFF & ANTI-HALLUCINATION RULES
════════════════════════════════════════════════════════════════════

RULE 1 · STRICT BAN ON ROBOTIC PLACEHOLDERS
  NEVER output any of the following robotic phrases:
    ❌ "Implementation details not determinable"
    ❌ "N/A — No public API endpoints declared"
    ❌ "No scripts declared in package.json"
    ❌ "Not specified in repository"
    ❌ "License not specified in repository"
  INSTEAD: Write substantive, human-grade technical descriptions, scripts, or appropriate CLI/execution guides.

RULE 2 · MULTI-ECOSYSTEM & SCRIPT EXECUTION SUPPORT
  • Python repos (requirements.txt / pyproject.toml / uv.lock): Render exact uv/pip commands.
    Installation: \`uv sync\` or \`pip install -r requirements.txt\`
    Execution: \`uv run python <script>.py\` or \`python <script>.py\`
  • Node.js repos: \`npm install\` and \`npm run dev\` / \`npm start\`.
  • Rust / Go repos: \`cargo run\` / \`go run .\`.

RULE 3 · ADAPTIVE API vs CLI/SCRIPT REFERENCE
  • If web API routes exist: Render a full HTTP API Endpoint Matrix.
  • If NO web API routes exist (CLI tool / Python / Data pipeline / Script repo):
    CONVERT into a rich "🖥️ CLI & Script Execution Matrix"
    listing exact CLI commands for running every script/file in the codebase (e.g., \`python main.py\`, \`npm run dev\`).

RULE 4 · TECHNOLOGY BADGES & ECOSYSTEM
  Generate Shields.io badges and ecosystem reference for parsed dependencies:
${uniqueDeps.slice(0, 15).map((d) => `    • ${d}`).join("\n")}

RULE 5 · HUMAN-GRADE NARRATIVE & VISUAL CLARITY
  • Include a clean progression flow diagram or Mermaid.js flowchart if relevant to this persona.
  • Embed preview image if detected: \`![Preview](${assetPaths[0] || "assets/preview.png"})\`.

RULE 6 · BANNED FLUFF WORDS
  Do NOT use vacuous buzzwords: "blazing fast", "revolutionary", "cutting-edge", "unmatched performance".
  Use precise, architectural, human-grade technical prose.
${
  digest.monorepo
    ? `
RULE 7 · MONOREPO WORKSPACE PACKAGES
  The repository is an active ${digest.monorepo.tool || "monorepo"} workspace containing ${digest.monorepo.packages.length} packages:
${digest.monorepo.packages.map((p) => `  • ${p.name} (\`${p.path}\`)${p.description ? `: ${p.description}` : ""}`).join("\n")}
  You MUST include a dedicated "📦 Workspace Packages" section detailing each package, its path, and its role, alongside workspace root execution scripts.
`
    : ""
}${
  digest.openApiSpec
    ? `
RULE 8 · FACTUAL OPENAPI SPECIFICATION REFERENCE
  The repository contains a verified OpenAPI specification ("${digest.openApiSpec.title}" v${digest.openApiSpec.version}) with ${digest.openApiSpec.endpointCount} endpoints.
  You MUST include the following pre-rendered API Reference section directly in the README:

${digest.openApiSpec.markdownReference}
`
    : ""
}

════════════════════════════════════════════════════════════════════
FULL REPOSITORY DIGEST (AUTHORITATIVE REPOSITORY EVIDENCE)
════════════════════════════════════════════════════════════════════
${JSON.stringify(digest, null, 2)}

ADDITIONAL METADATA
────────────────────
Custom Title     : ${repoTitle}
Target Persona   : ${personaConfig.label} (${personaConfig.description})
Primary Language : ${digest.techStack.language}
Team/Org         : ${teamName || "Engineering Team"}
Live Demo URL    : ${demoUrl || "N/A"}
Collaborators    :
${collabList}

════════════════════════════════════════════════════════════════════
MANDATORY README SECTIONS FOR ${personaConfig.label.toUpperCase()} (${personaConfig.maxSections} SECTIONS)
════════════════════════════════════════════════════════════════════
${
  personaKey === "MINIMALIST"
    ? `1. 🏷️ HERO HEADER: # ${repoTitle}, 1-sentence tagline, badges.
2. 🔍 OVERVIEW: 1 crisp, high-impact paragraph explaining what it does.
3. 🚀 REQUIREMENTS & QUICKSTART: Prerequisites + exact copy-pasteable bash commands to run:
\`\`\`bash
${declaredScripts}
\`\`\`
4. 📄 LICENSE: Standard ${licenseText} notice for ${effectiveYear} ${effectiveAuthor}.`
    : personaKey === "PORTFOLIO"
    ? `1. 🏷️ HERO HEADER: # ${repoTitle}, demo tagline, tech badges, live demo link (${demoUrl || "Live Demo"}), preview image.
2. 🔍 PROJECT OVERVIEW & HIGHLIGHTS: Compelling narrative of the problem solved, engineering decisions, and core features.
3. ✨ KEY CAPABILITIES & DEMO SHOWCASE: High-density bulleted achievements backed by real code modules.
4. 🛠️ TECH STACK & ARCHITECTURE: Shields.io badges + parsed dependencies table.
5. 🚀 LOCAL SETUP & REPRODUCTION: Prerequisites and exact run scripts:
\`\`\`bash
${declaredScripts}
\`\`\`
6. 📁 REPOSITORY STRUCTURE: Clean ASCII directory tree (${treeSample.split("\n").slice(0, 20).join("\n")}).
7. 👥 AUTHOR & CREDITS: Showcase of the author/team and collaborators.
8. 📄 LICENSE: Official ${licenseText} license block.`
    : personaKey === "OPEN_SOURCE"
    ? `1. 🏷️ HERO HEADER: # ${repoTitle}, tagline, build/license badges, preview image.
2. 📋 TABLE OF CONTENTS: Anchored links to all sections.
3. 🔍 OVERVIEW & VISION: Project goals and who it is for.
4. ✨ FEATURES: Modular capability list.
5. 🛠️ TECH STACK: Dependency matrix.
6. 🚀 GETTING STARTED: Prerequisites, installation, running tests, local environment setup.
7. 📁 PROJECT STRUCTURE: Annotated ASCII directory tree.
8. 🔌 API / CLI REFERENCE: Detailed matrix of endpoints or CLI script execution.
9. 🤝 CONTRIBUTING: Clear guide on how to contribute, code style, opening issues, and pull requests.
10. 👥 CONTRIBUTORS: Recognition of contributors and maintainers.
11. 📄 LICENSE: ${licenseText} license with summary table.`
    : `1. 🏷️ HERO HEADER: # ${repoTitle}, 1-sentence tagline, Shields.io badges, preview image: ![Preview](${assetPaths[0] || "assets/preview.png"})
2. 📋 TABLE OF CONTENTS: Anchored links to all 14 sections.
3. 🔍 OVERVIEW & ARCHITECTURAL INTENT: 2-3 detailed paragraphs explaining the engineering problem and design motivation.
4. 📌 ARCHITECTURE & WORKFLOW: ASCII progression flow diagram, Mermaid flowchart (graph TD), and ADR / Trade-offs table.
5. ✨ CORE FEATURES & CAPABILITIES: High-density bulleted list backed by code modules.
6. 🛠️ TECHNOLOGIES & ECOSYSTEM MATRIX: Full table listing parsed dependencies.
7. 📋 REQUIREMENTS & 🚀 INSTALLATION GUIDE: Prerequisites, .env setup, exact commands:
\`\`\`bash
${declaredScripts}
\`\`\`
8. 📁 PROJECT STRUCTURE: ASCII file tree with inline descriptions (${treeSample}).
9. 🧩 MAIN MODULES & TECHNICAL BREAKDOWN: Dedicated ### for EVERY module (${digest.modules.map((m) => m.name).join(", ")}).
10. 🔌 API REFERENCE OR 🖥️ SCRIPT EXECUTION MATRIX: Full endpoints or CLI script table.
11. 🛡️ SECURITY & CONFIGURATION ISOLATION: Environment secrets, input validation, boundaries.
12. 🚀 DEPLOYMENT & ENVIRONMENT MATRIX: Execution targets (Dev, Docker, Staging, Cloud).
13. 👥 AUTHORS & CONTRIBUTORS: Contributor table.
14. 📄 LICENSE: Professional ${licenseText} section with permissions/limitations table and (c) ${effectiveYear} ${effectiveAuthor}.`
}

════════════════════════════════════════════════════════════════════
OUTPUT FORMAT
════════════════════════════════════════════════════════════════════
Return ONLY valid GitHub-Flavored Markdown (GFM). Start directly with the # H1 heading.
`;

  const prompt = `Generate the complete, high-density, human-grade ${personaConfig.label} README.md for "${repoTitle}".

CRITICAL INSTRUCTIONS:
1. Ban ALL robotic placeholders ("Implementation details not determinable", "N/A", etc.).
2. Include multi-ecosystem install & run commands.
3. Align strictly with the ${personaConfig.label} section guidelines (${personaConfig.maxSections} sections).
4. Start directly with the # H1 heading.`;

  return await generateContentWithFallback(prompt, masterSystemPrompt);
}

export interface GeneratedMetadataResult {
  suggestedDescription: string;
  suggestedTopics: string[];
  releaseNotes: string;
}

/**
 * Generates punchy repo description (<250 chars), GitHub topics tags, and v1.0.0 Release Notes via Gemini.
 */
export async function generateRepoMetadata(
  digest: RepoDigest
): Promise<GeneratedMetadataResult> {
  const prompt = `Analyze this codebase digest for repository "${digest.repoName}":
Description: ${digest.description || "N/A"}
Tech Stack: Language: ${digest.techStack.language}, Frameworks: ${digest.techStack.frameworks.join(", ")}, Databases: ${digest.techStack.databases.join(", ")}
Modules: ${digest.modules.map((m) => m.name).join(", ")}

Generate a JSON object matching this EXACT structure:
{
  "suggestedDescription": "Punchy engineering description under 240 characters explaining what the repo does.",
  "suggestedTopics": ["4 to 8 lowercase tags, e.g. nextjs, typescript, developer-tools"],
  "releaseNotes": "Markdown formatted release notes for v1.0.0 Production Release highlighting main capabilities, setup, and features."
}

Return ONLY raw JSON, no markdown formatting ticks.`;

  try {
    const raw = await generateContentWithFallback(prompt);
    const cleaned = raw.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      suggestedDescription: parsed.suggestedDescription || `${digest.repoName} — High-performance technical implementation`,
      suggestedTopics: Array.isArray(parsed.suggestedTopics) ? parsed.suggestedTopics : [digest.techStack.language.toLowerCase(), "developer-tools"],
      releaseNotes: parsed.releaseNotes || `## 🚀 v1.0.0 Production Release\n\nInitial production release for **${digest.repoName}**.\n\n### Highlights\n- Complete codebase implementation in ${digest.techStack.language}.\n- Enterprise architecture and module structure.`,
    };
  } catch (err) {
    console.warn("[Gemini AI] Metadata generation fallback used:", err);
    // Fallback topics derived heuristically
    const heuristicTopics = [
      digest.techStack.language.toLowerCase(),
      ...digest.techStack.frameworks.map((f) => f.toLowerCase()),
      "developer-tools",
      "open-source",
    ].filter((t) => t && t.length < 30);

    return {
      suggestedDescription: digest.description || `Technical implementation repository for ${digest.repoName}`,
      suggestedTopics: Array.from(new Set(heuristicTopics)).slice(0, 8),
      releaseNotes: `## 🚀 v1.0.0 Production Release\n\nOfficial production release for **${digest.repoName}**.\n\n### Key Features\n- Complete AST-analyzed codebase architecture.\n- Production-ready documentation and automated setup.`,
    };
  }
}


