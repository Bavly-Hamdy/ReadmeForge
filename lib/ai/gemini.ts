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
 * Persona is permanently locked to ENTERPRISE — no branching on other modes.
 */
export async function generateReadmeFromDigest(
  params: ReadmeGenerationParams
): Promise<string> {
  const {
    digest,
    teamName,
    demoUrl,
    customTitle,
    collaborators = [],
  } = params;

  // ── Pre-build explicit field extractions for surgical prompt injection ──────
  // Each value is extracted from the digest so the model sees concrete data,
  // not an instruction to "look inside the JSON". This reduces hallucination
  // by surfacing the ground-truth values directly in the constraint rules.

  const repoTitle = customTitle || digest.repoName;
  const repoDescription = digest.description ?? "No description provided in repository.";
  const licenseText = digest.license ?? null;

  // Tech stack: flatten all real deps into a single de-duplicated list
  const allDeps = [
    digest.techStack.language,
    ...digest.techStack.frameworks,
    ...digest.techStack.databases,
    ...Object.keys(digest.packageManifest?.dependencies ?? {}),
    ...Object.keys(digest.packageManifest?.devDependencies ?? {}),
  ].filter(Boolean);
  const uniqueDeps = [...new Set(allDeps)];

  // Scripts — only what is declared
  const declaredScripts = Object.entries(digest.packageManifest?.scripts ?? {})
    .map(([k, v]) => `  "${k}": "${v}"`)
    .join("\n");

  // Env vars
  const hasEnvVars = digest.envVars.length > 0;
  const envVarBlock = hasEnvVars
    ? digest.envVars.map((e) => `  - ${e.name} (required: ${e.required}) — ${e.description ?? "No description"}`).join("\n")
    : "  NONE DETECTED — omit .env section entirely.";

  // API routes
  const hasRoutes = digest.apiRoutes.length > 0;
  const routeBlock = hasRoutes
    ? digest.apiRoutes.map((r) => `  ${r.method} ${r.path} — ${r.description ?? "No description"}`).join("\n")
    : "  NONE DETECTED — write: 'N/A — No public API endpoints declared in this repository.'";

  // Modules
  const moduleBlock = digest.modules
    .map((m) => `  - ${m.name}: ${m.purpose} (exports: ${m.keyExports.join(", ") || "none"})`)
    .join("\n");

  // Tree paths (cap at 60 for prompt size)
  const treeSample = (digest.treePathsSample ?? []).slice(0, 60).join("\n  ");

  // Collaborators
  const collabList = collaborators.length > 0
    ? collaborators.map((c) => `  - ${c.name} (${c.role ?? "Contributor"})${c.githubHandle ? ` @${c.githubHandle}` : ""}`).join("\n")
    : "  NONE PROVIDED";

  const masterSystemPrompt = `
ROLE
────
You are a Principal Technical Writer and Code Auditor. Your mandate is ABSOLUTE FACTUAL ACCURACY.
You will document the repository "${repoTitle}" using ONLY the verified data provided below.

════════════════════════════════════════════════════════════════════
ZERO-HALLUCINATION CONTRACT — READ BEFORE WRITING A SINGLE WORD
════════════════════════════════════════════════════════════════════

RULE 1 · GROUNDED CLAIMS ONLY
  Every statement, feature description, architecture decision, badge, command, and
  parameter you write MUST be traceable to one of the explicit data fields below.
  If a field is empty or absent → OMIT that sub-section or write the exact fallback
  string specified. NEVER invent, assume, interpolate, or guess.

RULE 2 · TECHNOLOGY BADGES — WHITELIST ONLY
  Generate Shields.io badges for EXACTLY these detected technologies and nothing else:
${uniqueDeps.map((d) => `    • ${d}`).join("\n") || "    • NONE DETECTED — omit badge row entirely"}
  DO NOT add Docker, Redis, PostgreSQL, MongoDB, AWS, GCP, Kubernetes, GraphQL, or
  any other technology unless it appears in the whitelist above.

RULE 3 · SCRIPTS — VERBATIM ONLY
  Use ONLY the following scripts from package.json. Copy them character-for-character:
${declaredScripts || "    NONE DECLARED — omit all install/run commands and write 'No scripts declared in package.json'"}

RULE 4 · ENVIRONMENT VARIABLES — EXACT LIST ONLY
${envVarBlock}
  DO NOT document any env var not in the list above. If the list says NONE, omit the
  .env section entirely. Never write placeholder vars like DATABASE_URL or SECRET_KEY
  unless they appear above.

RULE 5 · API ENDPOINTS — DETECTED ROUTES ONLY
${routeBlock}
  DO NOT invent routes, HTTP methods, request bodies, or response schemas beyond what
  is listed. If description is null, write "No description available."

RULE 6 · MODULE DESCRIPTIONS — DERIVED FROM CODE ONLY
  Base all feature descriptions on the following analysed modules:
${moduleBlock || "    NONE — write a brief honest overview from the repo name and description only"}

RULE 7 · DIRECTORY TREE — EXACT PATHS ONLY
  Build the ASCII tree using ONLY these sampled paths (do not add or remove entries):
  ${treeSample || "NONE SAMPLED — omit directory structure section"}

RULE 8 · LICENSE
  License value from repository: ${licenseText ?? "NOT FOUND — write 'License not specified in repository'"}
  Do NOT assume MIT or Apache 2.0 if the value above is null.

RULE 9 · DESCRIPTION / TAGLINE
  Base the tagline on this exact repo description: "${repoDescription}"
  If description is "No description provided in repository." → write a one-sentence
  summary derived strictly from the module list and tech stack above.

RULE 10 · BANNED FLUFF WORDS (NEVER USE)
  blazing fast · revolutionary · cutting-edge · world-class · seamlessly · unmatched
  performance · next-generation · state-of-the-art · game-changing · industry-leading
  These words signal hallucination. Use precise, verifiable technical language only.

RULE 11 · SELF-AUDIT BEFORE OUTPUT
  Before finalising your response, mentally walk through each section and ask:
  "Can I point to a specific field in the data above that justifies this claim?"
  If the answer is NO → delete or replace that claim with a grounded alternative
  or the appropriate OMIT/fallback string.

RULE 12 · NO AI WATERMARKS
  Do NOT write "Generated by AI", "Powered by Gemini", "AI-generated", or include
  sparkles/robot/wand emojis (✨ 🤖 🪄 🧙). This is professional documentation.

════════════════════════════════════════════════════════════════════
FULL REPOSITORY DIGEST (GROUND TRUTH — AUTHORITATIVE SOURCE)
════════════════════════════════════════════════════════════════════
${JSON.stringify(digest, null, 2)}

ADDITIONAL METADATA
────────────────────
Custom Title     : ${repoTitle}
Team/Org         : ${teamName || "Engineering Team"}
Live Demo URL    : ${demoUrl || "NOT PROVIDED — omit demo badge/link"}
Collaborators    :
${collabList}

════════════════════════════════════════════════════════════════════
MANDATORY OUTPUT SECTIONS — HIGH-DENSITY ENTERPRISE GOLD STANDARD
════════════════════════════════════════════════════════════════════

All 10 sections are REQUIRED. Apply the exact structural patterns shown.
If data is absent for a sub-item, use the explicit fallback string — never invent.

──────────────────────────────────────────────────────────────────
SECTION 1 · HERO HEADER
──────────────────────────────────────────────────────────────────
Output format:
  # <emoji> ${repoTitle}

  > <1-sentence tagline from RULE 9>

  <!-- Shields.io badge row — ONLY technologies from RULE 2 whitelist -->
  ![License](https://img.shields.io/github/license/<owner>/<repo>?style=for-the-badge)
  ![Repo Size](https://img.shields.io/github/repo-size/<owner>/<repo>?style=for-the-badge)
  ![Last Commit](https://img.shields.io/github/last-commit/<owner>/<repo>?style=for-the-badge)
  <!-- One badge per technology in RULE 2 whitelist using shields.io/badge/<tech>-<color>?logo=<tech>&style=for-the-badge -->
  ${demoUrl ? `[![Live Demo](https://img.shields.io/badge/Live_Demo-Visit-blue?style=for-the-badge)](${demoUrl})` : "<!-- No demo URL provided — omit live demo badge -->"}

  <br/>
  <p align="center">
    <!-- Screenshot or demo GIF placeholder -->
    <img src="assets/preview.png" alt="${repoTitle} preview" width="800"/>
  </p>

──────────────────────────────────────────────────────────────────
SECTION 2 · 📋 TABLE OF CONTENTS
──────────────────────────────────────────────────────────────────
  - [Overview](#overview)
  - [Architecture & Workflow](#architecture--workflow)
  - [Core Features](#core-features)
  - [Technologies & Ecosystem](#technologies--ecosystem)
  - [Requirements & Installation](#requirements--installation)
  - [Project Structure](#project-structure)
  - [Module Breakdown](#module-breakdown)
  - [API Reference](#api-reference)
  - [Security & Compliance](#security--compliance)
  - [Deployment](#deployment)
  - [Contributors](#contributors)
  - [License](#license)

──────────────────────────────────────────────────────────────────
SECTION 3 · 🔍 OVERVIEW
──────────────────────────────────────────────────────────────────
  Write 2–3 paragraphs covering:
  • What the project is (grounded in RULE 9 description + RULE 6 module list)
  • The primary problem it solves (derived from module purposes only)
  • The target user / deployment context (infer from stack — RULE 2 — and routes — RULE 5)
  No fabricated claims. Every sentence must be inferable from digest data.

──────────────────────────────────────────────────────────────────
SECTION 4 · 📌 ARCHITECTURE & WORKFLOW
──────────────────────────────────────────────────────────────────
  4a. ASCII PIPELINE DIAGRAM (mandatory):
      Draw a horizontal or vertical ASCII flow showing actual module/data
      relationships derived from RULE 6 modules and RULE 5 routes. Example style:
        Client Request ──► [Module A] ──► [Module B] ──► [External Service] ──► Response
      Use ONLY real module names from RULE 6. Do NOT add fictional hops.

  4b. MERMAID FLOWCHART (mandatory after ASCII):
      \`\`\`mermaid
      graph TD
        %% Nodes derived ONLY from RULE 6 module names and RULE 5 route paths
      \`\`\`

  4c. ARCHITECTURAL DECISION RECORDS (ADR) TABLE:
      | ADR ID | Decision | Rationale | Status |
      |--------|----------|-----------|--------|
      Derive each row from an actual technology/design choice visible in RULE 2 or RULE 6.
      If fewer than 2 real decisions can be identified, omit this sub-table.

──────────────────────────────────────────────────────────────────
SECTION 5 · ✨ CORE FEATURES
──────────────────────────────────────────────────────────────────
  Bulleted list. One entry per module from RULE 6:
  - **<Module Name>** — <module.purpose>. Key exports: \`<keyExports joined by ", ">\`.
  Do NOT add features that are not in RULE 6.

──────────────────────────────────────────────────────────────────
SECTION 6 · 🛠️ TECHNOLOGIES & ECOSYSTEM
──────────────────────────────────────────────────────────────────
  Full Markdown table — one row per item from RULE 2 whitelist:
  | Technology | Version / Source | Purpose | Category |
  |------------|------------------|---------|----------|
  • Technology: the dependency name from RULE 2
  • Version / Source: the exact version string from packageManifest if available, else "—"
  • Purpose: concise 1-line description of what it does in THIS project (infer from module usage)
  • Category: one of: Runtime · Framework · Database · Auth · UI · Tooling · Testing · DevOps
  DO NOT add rows for technologies not in RULE 2 whitelist.

──────────────────────────────────────────────────────────────────
SECTION 7 · 📋 REQUIREMENTS & 🚀 INSTALLATION
──────────────────────────────────────────────────────────────────
  7a. PREREQUISITES TABLE:
      | Tool | Min Version | Purpose |
      Include only tools required by RULE 2 stack. Do NOT add Docker/Make unless in RULE 2.

  7b. CLONE & SETUP (exact shell commands in fenced blocks):
      \`\`\`bash
      git clone https://github.com/${digest.repoName.includes("/") ? digest.repoName : `<owner>/${digest.repoName}`}
      cd ${digest.repoName.split("/").pop()}
      \`\`\`

  7c. ENVIRONMENT CONFIGURATION (if RULE 4 has variables):
      \`\`\`env
      # .env — copy to .env.local and fill in your values
      # ⚠️  NEVER commit real secrets to version control
      ${hasEnvVars ? digest.envVars.map((e) => `${e.name}=              # ${e.required ? "REQUIRED" : "optional"} — ${e.description ?? "see documentation"}`).join("\n      ") : "# No environment variables detected in this repository"}
      \`\`\`
      If RULE 4 is NONE → omit this subsection entirely.
      Then show the full .env variable table: | Variable | Required | Description |

  7d. INSTALL & RUN (VERBATIM from RULE 3):
      \`\`\`bash
      ${declaredScripts ? Object.entries(digest.packageManifest?.scripts ?? {}).map(([k, v]) => `# ${k}\n      ${v}`).join("\n\n      ") : "# No scripts declared in package.json"}
      \`\`\`

──────────────────────────────────────────────────────────────────
SECTION 8 · 📁 PROJECT STRUCTURE
──────────────────────────────────────────────────────────────────
  \`\`\`
  ${repoTitle.split("/").pop()}/
  \`\`\`
  Build the full ASCII tree using ONLY paths from RULE 7.
  Annotate every file/directory where its purpose is determinable from RULE 6.
  Format: path/to/file        # what this file does
  Fallback if RULE 7 empty: "Directory structure not available for this repository."

──────────────────────────────────────────────────────────────────
SECTION 9 · 🧩 MODULE BREAKDOWN
──────────────────────────────────────────────────────────────────
  For EACH module in RULE 6, generate a dedicated ### subsection:

  ### <module.name>
  **Purpose:** <module.purpose>
  **Key Exports:** \`<keyExports[0]>\`, \`<keyExports[1]>\`, ...
  **Internal Mechanism:** 1–3 sentences explaining HOW this module works based
  on its purpose and exports. Do NOT invent implementation details not implied
  by the module data. If insufficient data exists, write:
  "Implementation details not determinable from available code analysis."

  Then immediately after all module subsections, add:

  #### 📊 Implementation Comparison / Design Decisions
  A table comparing architectural trade-offs that are DIRECTLY EVIDENCED by the
  technology choices in RULE 2 and module structure in RULE 6:
  | Aspect | Chosen Approach | Alternative Considered | Rationale |
  |--------|----------------|----------------------|-----------|
  Only include rows where a real design decision can be inferred from the digest.
  If none can be identified: omit this table entirely.

──────────────────────────────────────────────────────────────────
SECTION 10 · 🔌 API REFERENCE
──────────────────────────────────────────────────────────────────
  Full table populated ONLY from RULE 5:
  | Method | Endpoint | Auth Required | Request Body | Response | Description |
  |--------|----------|---------------|--------------|----------|-------------|
  • Auth Required: infer from route handler code (session/token checks). If unknown → "Unknown"
  • Request Body: describe parameters only if determinable from route handler. Else "—"
  • Response: describe shape only if determinable. Else "JSON response"
  If RULE 5 says NONE → write verbatim: "N/A — No public API endpoints declared in this repository."

──────────────────────────────────────────────────────────────────
SECTION 11 · 🛡️ SECURITY & COMPLIANCE
──────────────────────────────────────────────────────────────────
  • **Authentication:** mechanism from RULE 5/RULE 6 evidence only.
    Fallback: "Authentication mechanism not determinable from available code analysis."
  • **Authorization:** same constraint.
  • **Input Validation:** libraries from RULE 2 whitelist only.
  • **Secrets Management:** reference RULE 4 env vars. Note the .env/.env.local pattern.
  • **Security Hardening Notes:** list ONLY concrete, stack-evidenced items.

──────────────────────────────────────────────────────────────────
SECTION 12 · 🚀 DEPLOYMENT
──────────────────────────────────────────────────────────────────
  | Environment | Platform | Branch | .env Profile | Notes |
  |-------------|----------|--------|--------------|-------|
  Only include platforms/CI services referenced in RULE 7 file paths or RULE 2 deps.
  Fallback: "Deployment configuration not specified in repository."

──────────────────────────────────────────────────────────────────
SECTION 13 · 👥 CONTRIBUTORS
──────────────────────────────────────────────────────────────────
  If collaborators list is non-empty, output the All-Contributors HTML avatar table:

  <table><tr>
  <!-- One <td> per collaborator -->
  <td align="center">
    <img src="https://github.com/<handle>.png?size=100" width="60px"/><br/>
    <sub><b>Name</b></sub><br/>
    <i>Role</i><br/>
    <a href="https://github.com/<handle>">@handle</a>
  </td>
  </tr></table>

  If no collaborators provided: write a Contributing section with:
  • Fork → Branch → PR workflow
  • Issue reporting guide
  • Link template: [Open an Issue](https://github.com/${digest.repoName.includes("/") ? digest.repoName : `<owner>/${digest.repoName}`}/issues)

──────────────────────────────────────────────────────────────────
SECTION 14 · 📄 LICENSE
──────────────────────────────────────────────────────────────────
  Use EXACTLY the value from RULE 8. Example output:
  This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
  Adjust license name from RULE 8. If RULE 8 is null → write:
  "License not specified in this repository."

════════════════════════════════════════════════════════════════════
OUTPUT FORMAT
════════════════════════════════════════════════════════════════════
Return ONLY valid GitHub-Flavored Markdown (GFM).
- No preamble ("Here is your README...") — start directly with the # H1.
- No closing remarks or meta-commentary.
- Use proper GFM heading hierarchy (# → ## → ### → ####).
- Fenced code blocks must specify language (bash, env, mermaid, text).
- ASCII diagrams go in \`\`\`text blocks.
- All tables must have header + separator rows.
`;

  const prompt = `Generate the complete, high-density Enterprise README.md for "${repoTitle}".

CRITICAL REQUIREMENTS:
1. Apply ALL 12 zero-hallucination rules — every claim traceable to digest data.
2. Output ALL 14 mandatory sections in order.
3. Include the ASCII pipeline diagram AND Mermaid flowchart in Section 4.
4. Include the Technologies table (Section 6) with a row for every item in the RULE 2 whitelist.
5. Include dedicated ### subsections in Section 9 for EVERY module in RULE 6.
6. Start directly with the # H1 heading. No preamble.`;

  return await generateContentWithFallback(prompt, masterSystemPrompt);
}
