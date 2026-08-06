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
   * Stage 2 — Per-Module Summarization via Gemini with Fallback
   */
  public async runStage2(chunks: { moduleName: string; files: { path: string; content: string }[] }[]): Promise<ModuleSummary[]> {
    const summaries: ModuleSummary[] = [];

    for (const chunk of chunks) {
      const prompt = `
Analyze the following code files for module "${chunk.moduleName}" and return a JSON summary.
Files:
${chunk.files.map((f) => `--- File: ${f.path} ---\n${f.content.slice(0, 2000)}`).join("\n\n")}

Return JSON in this format:
{
  "name": "${chunk.moduleName}",
  "purpose": "1-2 sentence description of module purpose",
  "keyExports": ["export1", "export2"],
  "dependencies": ["dep1", "dep2"]
}
IMPORTANT: Return ONLY valid JSON.
`;
      try {
        const rawText = await generateContentWithFallback(prompt);
        const text = rawText.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
        const summary = JSON.parse(text) as ModuleSummary;
        summaries.push(summary);
      } catch (err) {
        console.warn(`[Stage 2] Summarization fallback used for module ${chunk.moduleName}`, err);
        summaries.push({
          name: chunk.moduleName,
          purpose: "Module analysis summary",
          keyExports: [],
          dependencies: [],
        });
      }
    }

    return summaries;
  }

  /**
   * Stage 3 — Reduce into a single RepoDigest JSON object
   */
  public async runStage3(
    repoName: string,
    description: string | null,
    moduleSummaries: ModuleSummary[],
    stage0: Stage0Result
  ): Promise<RepoDigest> {
    return {
      repoName,
      description,
      techStack: {
        language: stage0.ecosystems[0] || "TypeScript",
        frameworks: stage0.ecosystems,
        databases: [],
      },
      modules: moduleSummaries,
      envVars: [],
      apiRoutes: [],
      collaborators: [],
      license: "MIT",
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
