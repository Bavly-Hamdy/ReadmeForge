import { describe, it, expect } from "vitest";
import { AnalysisPipeline } from "../pipeline";

describe("AnalysisPipeline (Deterministic Stages)", () => {
  const pipeline = new AnalysisPipeline();

  describe("Stage 0: Structural Extraction", () => {
    it("should detect Node ecosystem from package.json", async () => {
      const treePaths = ["package.json", "src/index.ts", "README.md"];
      const fileContents = {
        "package.json": JSON.stringify({ name: "my-app", version: "1.0.0" }),
      };

      const result = await pipeline.runStage0(treePaths, fileContents);
      expect(result.ecosystems).toContain("npm/node");
      expect(result.manifests["package.json"]).toBeDefined();
    });

    it("should detect Python, Rust, and Go manifests", async () => {
      const treePaths = ["requirements.txt", "Cargo.toml", "go.mod"];
      const fileContents = {
        "requirements.txt": "flask>=2.0.0\nrequests",
        "Cargo.toml": '[package]\nname = "test"',
        "go.mod": "module test\ngo 1.21",
      };

      const result = await pipeline.runStage0(treePaths, fileContents);
      expect(result.ecosystems).toContain("python");
      expect(result.ecosystems).toContain("rust");
      expect(result.ecosystems).toContain("golang");
    });
  });

  describe("Stage 1: Relevance Filtering", () => {
    it("should filter out node_modules, build artifacts, and binary assets", async () => {
      const treePaths = [
        "node_modules/react/index.js",
        "dist/bundle.js",
        ".next/server/page.js",
        ".git/HEAD",
        "assets/logo.png",
        "src/main.ts",
        "app/api/users/route.ts",
        "package.json",
      ];

      const result = await pipeline.runStage1(treePaths);
      expect(result.filteredPaths).not.toContain("node_modules/react/index.js");
      expect(result.filteredPaths).not.toContain("dist/bundle.js");
      expect(result.filteredPaths).not.toContain(".next/server/page.js");
      expect(result.filteredPaths).not.toContain(".git/HEAD");
      expect(result.filteredPaths).not.toContain("assets/logo.png");
      expect(result.filteredPaths).toContain("src/main.ts");
      expect(result.filteredPaths).toContain("app/api/users/route.ts");
    });

    it("should categorize prioritized files correctly", async () => {
      const treePaths = [
        "src/main.ts",
        "app/api/generate/route.ts",
        "tsconfig.json",
        "README.md",
      ];

      const result = await pipeline.runStage1(treePaths);
      const entry = result.prioritizedFiles.find((f) => f.path === "src/main.ts");
      const route = result.prioritizedFiles.find((f) => f.path === "app/api/generate/route.ts");
      const config = result.prioritizedFiles.find((f) => f.path === "tsconfig.json");
      const docs = result.prioritizedFiles.find((f) => f.path === "README.md");

      expect(entry?.category).toBe("entry");
      expect(route?.category).toBe("route");
      expect(config?.category).toBe("config");
      expect(docs?.category).toBe("docs");
    });
  });

  describe("Stage 3: RepoDigest Reduction", () => {
    it("should parse Node package.json dependencies and scripts", async () => {
      const stage0 = {
        manifests: {
          "package.json": JSON.stringify({
            name: "test-pkg",
            description: "A test package",
            license: "MIT",
            dependencies: { react: "^18.0.0", next: "14.2.5" },
            devDependencies: { typescript: "^5.0.0" },
            scripts: { dev: "next dev", build: "next build" },
          }),
        },
        ecosystems: ["npm/node"],
        treePaths: ["package.json", "src/index.ts"],
      };

      const digest = await pipeline.runStage3("owner/test-pkg", null, [], stage0);

      expect(digest.repoName).toBe("owner/test-pkg");
      expect(digest.description).toBe("A test package");
      expect(digest.license).toBe("MIT");
      expect(digest.techStack.frameworks).toContain("Next.js");
      expect(digest.packageManifest?.dependencies).toHaveProperty("next");
      expect(digest.packageManifest?.scripts?.["dev"]).toBe("next dev");
    });

    it("should parse Python requirements.txt dependencies", async () => {
      const stage0 = {
        manifests: {
          "requirements.txt": "fastapi==0.100.0\nuvicorn>=0.22.0\npydantic\n# a comment",
        },
        ecosystems: ["python"],
        treePaths: ["requirements.txt", "main.py"],
      };

      const digest = await pipeline.runStage3("owner/py-service", null, [], stage0);

      expect(digest.techStack.language).toBe("Python");
      expect(digest.techStack.frameworks).toContain("FastAPI");
      expect(digest.packageManifest?.dependencies).toHaveProperty("fastapi");
      expect(digest.packageManifest?.scripts?.["install"]).toBe("pip install -r requirements.txt");
    });
  });
});
