import {
  RepoDigest,
  Stage0Result,
  Stage1Result,
  ModuleSummary,
  ReadmeGenerationParams,
} from "../types/repo-digest";
import { generateReadmeFromDigest, generateContentWithFallback } from "../lib/ai/gemini";

export class AnalysisPipeline {
  /**
   * Stage 0 — Structural Extraction (no LLM)
   */
  public async runStage0(treePaths: string[], fileContents: Record<string, string>): Promise<Stage0Result> {
    const manifests: Record<string, string> = {};
    const ecosystems: string[] = [];

    const manifestPatterns: Record<string, string> = {
      "package.json": "npm/node",
      "requirements.txt": "python",
      "Pipfile": "python",
      "pyproject.toml": "python",
      "Cargo.toml": "rust",
      "go.mod": "golang",
      "pom.xml": "java/maven",
      "build.gradle": "java/gradle",
    };

    for (const path of treePaths) {
      const fileName = path.split("/").pop();
      if (fileName && manifestPatterns[fileName]) {
        manifests[path] = fileContents[path] || "";
        const eco = manifestPatterns[fileName];
        if (!ecosystems.includes(eco)) {
          ecosystems.push(eco);
        }
      }
    }

    return {
      manifests,
      ecosystems,
      treePaths,
    };
  }

  /**
   * Stage 1 — Relevance Filtering (no LLM heuristic)
   */
  public async runStage1(treePaths: string[]): Promise<Stage1Result> {
    const excludeRegex = /(node_modules|vendor|dist|build|\.next|\.git|lock|\.png|\.jpg|\.jpeg|\.svg|\.ico|\.zip|\.tar|\.gz)$/i;

    const filteredPaths = treePaths.filter((path) => !excludeRegex.test(path));

    const prioritizedFiles: Stage1Result["prioritizedFiles"] = [];

    for (const path of filteredPaths) {
      const lower = path.toLowerCase();
      if (lower.includes("main") || lower.includes("index") || lower.startsWith("app/") || lower.startsWith("src/")) {
        prioritizedFiles.push({ path, category: "entry" });
      } else if (lower.includes("route") || lower.includes("api") || lower.includes("controller")) {
        prioritizedFiles.push({ path, category: "route" });
      } else if (lower.includes("config") || lower.endsWith(".json") || lower.endsWith(".toml") || lower.endsWith(".yaml")) {
        prioritizedFiles.push({ path, category: "config" });
      } else if (lower.includes("readme") || lower.includes("doc")) {
        prioritizedFiles.push({ path, category: "docs" });
      }
    }

    return {
      filteredPaths,
      prioritizedFiles,
    };
  }

  /**
   * Stage 2 — Batch Module Summarization via Gemini (Single LLM Call)
   */
  public async runStage2(chunks: { moduleName: string; files: { path: string; content: string }[] }[]): Promise<ModuleSummary[]> {
    if (!chunks || chunks.length === 0) return [];

    const prompt = `
Analyze the following top code files/modules in this repository and return a JSON array of concise summaries.
Modules:
${chunks.map((c) => `--- Module: ${c.moduleName} ---\n${c.files.map((f) => f.content.slice(0, 1200)).join("\n")}`).join("\n\n")}

Return ONLY valid JSON matching this exact structure array:
[
  {
    "name": "module name or file path",
    "purpose": "1-2 sentence description of module purpose",
    "keyExports": ["export1", "export2"],
    "dependencies": ["dep1"]
  }
]
`;
    try {
      const rawText = await generateContentWithFallback(prompt);
      const cleaned = rawText.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
      const parsed = JSON.parse(cleaned) as ModuleSummary[];
      if (Array.isArray(parsed)) return parsed;
    } catch (err) {
      console.warn("[Stage 2] Batch summarization fallback used", err);
    }

    return chunks.map((c) => ({
      name: c.moduleName,
      purpose: `Module ${c.moduleName}`,
      keyExports: [],
      dependencies: [],
    }));
  }

  /**
   * Stage 3 — Reduce into a single RepoDigest JSON object with factual manifest parsing
   */
  public async runStage3(
    repoName: string,
    description: string | null,
    moduleSummaries: ModuleSummary[],
    stage0: Stage0Result
  ): Promise<RepoDigest> {
    let parsedDeps: Record<string, string> = {};
    let parsedDevDeps: Record<string, string> = {};
    let parsedScripts: Record<string, string> = {};
    let manifestDesc: string | null = null;
    let manifestLicense: string | null = null;

    // 1. Parse package.json if present
    const pkgContent = stage0.manifests["package.json"] || stage0.manifests["/package.json"];
    if (pkgContent) {
      try {
        const pkg = JSON.parse(pkgContent);
        parsedDeps = pkg.dependencies || {};
        parsedDevDeps = pkg.devDependencies || {};
        parsedScripts = pkg.scripts || {};
        if (pkg.description) manifestDesc = pkg.description;
        if (pkg.license) manifestLicense = pkg.license;
      } catch (e) {
        console.warn("[Pipeline Stage 3] Failed to parse package.json JSON", e);
      }
    }

    // 2. Extract detected API routes from treePaths
    const apiRoutes = stage0.treePaths
      .filter((p) => /(app\/api\/|pages\/api\/|routes\/|controllers\/|api\/)/i.test(p))
      .map((p) => {
        let cleanPath = p;
        if (p.startsWith("app/api/")) {
          cleanPath = "/api/" + p.replace("app/api/", "").replace(/\/route\.(ts|js)$/, "");
        } else if (p.startsWith("pages/api/")) {
          cleanPath = "/api/" + p.replace("pages/api/", "").replace(/\.(ts|js)$/, "");
        }
        return {
          method: "GET / POST",
          path: cleanPath,
          description: `API Handler in ${p}`,
        };
      });

    // 3. Build accurate tech stack list from actual dependencies
    const allDepNames = [...Object.keys(parsedDeps), ...Object.keys(parsedDevDeps)];
    const frameworks = Array.from(
      new Set([
        ...stage0.ecosystems,
        ...allDepNames.filter((d) =>
          ["next", "react", "tailwindcss", "express", "prisma", "@prisma/client", "fastapi", "django", "vue", "svelte", "typescript", "zustand"].includes(d)
        ),
      ])
    );

    return {
      repoName,
      description: manifestDesc || description,
      techStack: {
        language: stage0.ecosystems[0] || "TypeScript",
        frameworks,
        databases: allDepNames.filter((d) => ["prisma", "@prisma/client", "pg", "mysql2", "mongodb", "mongoose", "sqlite3"].includes(d)),
      },
      packageManifest: {
        dependencies: parsedDeps,
        devDependencies: parsedDevDeps,
        scripts: parsedScripts,
      },
      modules: moduleSummaries,
      envVars: [],
      apiRoutes,
      collaborators: [],
      license: manifestLicense || "MIT",
      treePathsSample: stage0.treePaths.slice(0, 100),
      existingReadmeSummary: null,
    };
  }

  /**
   * Stage 4 — Generation via Gemini
   */
  public async runStage4(params: ReadmeGenerationParams): Promise<string> {
    return await generateReadmeFromDigest(params);
  }
}
