import { GoogleGenerativeAI } from "@google/generative-ai";
import { RepoDigest, ReadmeGenerationParams } from "@/types/repo-digest";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("[Gemini AI] Warning: GEMINI_API_KEY environment variable is missing.");
}

export const genAI = new GoogleGenerativeAI(apiKey || "dummy-key");

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
  const collabList = collaborators.length > 0
    ? collaborators.map((c) => `  - ${c.name} (${c.role ?? "Contributor"})${c.githubHandle ? ` @${c.githubHandle}` : ""}`).join("\n")
    : "  Community Contributors";

  const masterSystemPrompt = `
ROLE & MANDATE
──────────────
You are a Principal Software Architect and Lead Technical Writer. Your mandate is to produce a
WORLD-CLASS, HUMAN-GRADE, HIGH-DENSITY ENTERPRISE README for "${repoTitle}".

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
  INSTEAD: Write substantive, human-grade technical descriptions, scripts, or appropriate CLI/Homework execution guides.

RULE 2 · MULTI-ECOSYSTEM & SCRIPT EXECUTION SUPPORT
  • Python repos (requirements.txt / pyproject.toml / uv.lock): Render exact uv/pip commands.
    Installation: \`uv sync\` or \`pip install -r requirements.txt\`
    Execution: \`uv run python <script>.py\` or \`python <script>.py\`
  • Node.js repos: \`npm install\` and \`npm run dev\` / \`npm start\`.
  • Rust / Go repos: \`cargo run\` / \`go run .\`.

RULE 3 · ADAPTIVE API vs CLI/SCRIPT REFERENCE (SECTION 10)
  • If web API routes exist: Render a full HTTP API Endpoint Matrix.
  • If NO web API routes exist (CLI tool / Python homework / Data pipeline / Script repo):
    CONVERT Section 10 into a rich "🖥️ CLI & Script Execution Matrix" or "📋 Module & Homework Execution Guide"
    listing exact CLI commands for running every script/file in the codebase (e.g., \`python q1.py\`, \`python rag.py\`).

RULE 4 · TECHNOLOGY BADGES & ECOSYSTEM TABLE (SECTION 6)
  Generate Shields.io badges and full ecosystem table for ALL parsed dependencies:
${uniqueDeps.map((d) => `    • ${d}`).join("\n")}

RULE 5 · HUMAN-GRADE NARRATIVE & CONCEPTUAL FLOWS (SECTION 4)
  • Include a clean horizontal/vertical ASCII Progression Flow Diagram representing conceptual pipeline steps
    (e.g., \`Document Parsing ──► Chunking / Vector Index ──► Query Engine ──► LLM Synthesis ──► UI Output\`).
  • Include a comprehensive Mermaid.js flowchart (graph TD) mapping real modules.
  • Include a Feature & Architecture Comparison Table (e.g., "Plain RAG vs Agentic RAG" or "Implementation Comparison").

RULE 6 · DETAILED MODULE WALKTHROUGHS (SECTION 9)
  Write deep, technical explanations for EVERY module/script listed in RULE 6 below.
  Detail exact operational mechanics (parameters, chunking logic, models used, exported functions, and data transformations).

RULE 7 · VISUAL ASSETS & DEMO EMBEDS (SECTION 1)
  Asset images detected in repository: ${assetPaths.length > 0 ? assetPaths.join(", ") : "assets/preview.png"}
  Embed markdown images directly where applicable: \`![Preview](${assetPaths[0] || "assets/preview.png"})\`.

RULE 8 · BANNED FLUFF WORDS
  Do NOT use vacuous buzzwords: "blazing fast", "revolutionary", "cutting-edge", "unmatched performance".
  Use precise, architectural, human-grade technical prose.

════════════════════════════════════════════════════════════════════
FULL REPOSITORY DIGEST (AUTHORITATIVE REPOSITORY EVIDENCE)
════════════════════════════════════════════════════════════════════
${JSON.stringify(digest, null, 2)}

ADDITIONAL METADATA
────────────────────
Custom Title     : ${repoTitle}
Primary Language : ${digest.techStack.language}
Team/Org         : ${teamName || "Engineering Team"}
Live Demo URL    : ${demoUrl || "N/A"}
Collaborators    :
${collabList}

════════════════════════════════════════════════════════════════════
MANDATORY ENTERPRISE README STRUCTURE (14 SECTIONS)
════════════════════════════════════════════════════════════════════

1. 🏷️ HERO HEADER
   • # ${repoTitle}
   • 1-sentence human technical tagline based on: "${repoDescription}"
   • Shields.io badges for detected tech stack (style=for-the-badge)
   • Embedded preview image: \`![Preview](${assetPaths[0] || "assets/preview.png"})\`

2. 📋 TABLE OF CONTENTS
   • Anchored links to all 14 sections below

3. 🔍 OVERVIEW & ARCHITECTURAL INTENT
   • 2–3 detailed paragraphs explaining what the project builds, the underlying engineering problem, and design motivation.

4. 📌 ARCHITECTURE & WORKFLOW
   • ASCII Pipeline Flow Diagram (conceptual progression)
   • Mermaid.js Flowchart (\`\`\`mermaid graph TD ... \`\`\`)
   • Architectural Decision Records (ADR) or Feature Comparison Table (e.g., Plain RAG vs Agentic RAG / Module Trade-offs)

5. ✨ CORE FEATURES & CAPABILITIES
   • High-density bulleted list detailing every key capability backed by actual code modules.

6. 🛠️ TECHNOLOGIES & ECOSYSTEM MATRIX
   • Full Markdown Table listing parsed dependencies:
     | Technology | Purpose | Category |
     (Populate with all detected libraries like ${uniqueDeps.slice(0, 8).join(", ")})

7. 📋 REQUIREMENTS & 🚀 INSTALLATION GUIDE
   • Prerequisites table (Python/Node version, Package Manager like uv/pip/npm)
   • Environment Configuration (\`.env\` setup block with comments)
   • Exact Install & Run commands:
     \`\`\`bash
${declaredScripts}
     \`\`\`

8. 📁 PROJECT STRUCTURE
   • ASCII file tree with inline descriptions for key files:
     ${treeSample}

9. 🧩 MAIN MODULES & TECHNICAL BREAKDOWN
   • Dedicated \`### <module_name>\` for EVERY module in the digest.
   • Detail exact operational mechanics, exported functions, parameters, and algorithms.
   • Include an Implementation Comparison Table at the end of this section.

10. 🔌 API REFERENCE OR 🖥️ SCRIPT EXECUTION MATRIX
    • If HTTP API endpoints exist → Full API Table (| Method | Endpoint | Auth | Description |).
    • If Script / CLI repo → Full Script Execution Matrix (| Script / Command | Purpose | Input / Args | Output |).

11. 🛡️ SECURITY & CONFIGURATION ISOLATION
    • Details on environment variable management, API key protection, input validation, and secure execution boundaries.

12. 🚀 DEPLOYMENT & ENVIRONMENT MATRIX
    • Table listing execution targets (Local Dev, Docker, Staging, Cloud/Production).

13. 👥 AUTHORS & CONTRIBUTORS
    • Contributor table featuring GitHub dynamic avatars or team roles.

14. 📄 LICENSE
    Output the complete pro-grade License section:
    ## 📄 License
    This project is licensed under the **${licenseText} License** — see the [LICENSE](./LICENSE) file for full details.

    [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

    ### Summary of Rights & Permissions
    | 🟢 Permissions | 🟡 Conditions | 🔴 Limitations |
    | :--- | :--- | :--- |
    | **Commercial use** | **License and copyright notice** | **Liability** |
    | **Modification** | | **Warranty** |
    | **Distribution** | | |
    | **Private use** | | |

    ---
    > **Copyright (c) ${effectiveYear} ${effectiveAuthor}**

════════════════════════════════════════════════════════════════════
OUTPUT FORMAT
════════════════════════════════════════════════════════════════════
Return ONLY valid GitHub-Flavored Markdown (GFM). Start directly with the # H1 heading.
`;

  const prompt = `Generate the complete, high-density, human-grade Enterprise README.md for "${repoTitle}".

CRITICAL INSTRUCTIONS:
1. Ban ALL robotic placeholders ("Implementation details not determinable", "N/A", etc.).
2. Include Python/Node multi-ecosystem install & run commands (uv sync, pip install, python <script>.py).
3. Include ASCII progression flow diagram AND Mermaid flowchart.
4. Include rich technical walkthroughs in Section 9 for EVERY module (${digest.modules.map((m) => m.name).slice(0, 5).join(", ")}).
5. Convert Section 10 to a Script Execution Matrix if no HTTP API endpoints exist.
6. Start directly with the # H1 heading.`;

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


