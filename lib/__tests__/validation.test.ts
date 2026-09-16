import { describe, it, expect } from "vitest";
import {
  generateRequestSchema,
  syncMetadataSchema,
  pushReadmeSchema,
  refineReadmeSchema,
} from "@/lib/validation/generate-schema";

describe("Validation Schemas", () => {
  describe("generateRequestSchema", () => {
    it("should accept a valid GitHub repository URL", () => {
      const valid = {
        repoUrl: "https://github.com/facebook/react",
        persona: "ENTERPRISE",
      };
      const result = generateRequestSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.persona).toBe("ENTERPRISE");
        expect(result.data.includeLicense).toBe(true);
        expect(result.data.collaborators).toEqual([]);
      }
    });

    it("should reject non-GitHub URLs or malformed URLs", () => {
      const invalidUrl = { repoUrl: "https://gitlab.com/owner/repo" };
      const result = generateRequestSchema.safeParse(invalidUrl);
      expect(result.success).toBe(false);

      const notUrl = { repoUrl: "not-a-url" };
      expect(generateRequestSchema.safeParse(notUrl).success).toBe(false);
    });

    it("should allow all valid personas", () => {
      const personas = ["PORTFOLIO", "OPEN_SOURCE", "MINIMALIST", "ENTERPRISE"] as const;
      for (const p of personas) {
        const res = generateRequestSchema.safeParse({
          repoUrl: "https://github.com/owner/repo",
          persona: p,
        });
        expect(res.success).toBe(true);
      }
    });

    it("should reject invalid persona values", () => {
      const res = generateRequestSchema.safeParse({
        repoUrl: "https://github.com/owner/repo",
        persona: "HACKER",
      });
      expect(res.success).toBe(false);
    });

    it("should validate collaborators structure", () => {
      const validCollabs = {
        repoUrl: "https://github.com/owner/repo",
        collaborators: [
          { name: "Alice", role: "Frontend Lead", githubHandle: "alice" },
          { name: "Bob", role: null, githubHandle: null },
        ],
      };
      const res = generateRequestSchema.safeParse(validCollabs);
      expect(res.success).toBe(true);
    });
  });

  describe("syncMetadataSchema", () => {
    it("should validate complete metadata sync payloads", () => {
      const payload = {
        repoUrl: "https://github.com/owner/repo",
        description: "AI-powered documentation engine",
        homepage: "https://example.com",
        topics: ["ai", "markdown", "nextjs"],
        publishRelease: true,
        releaseNotes: "## v1.0.0 Release",
        tagName: "v1.0.0",
      };
      const result = syncMetadataSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  describe("pushReadmeSchema", () => {
    it("should validate direct-commit and pull-request modes", () => {
      const prPayload = {
        repoUrl: "https://github.com/owner/repo",
        readmeContent: "# Test README",
        mode: "pull-request",
      };
      expect(pushReadmeSchema.safeParse(prPayload).success).toBe(true);

      const directPayload = {
        repoUrl: "https://github.com/owner/repo",
        readmeContent: "# Test README",
        licenseContent: "MIT License...",
        mode: "direct-commit",
        commitMessage: "docs: update docs",
      };
      expect(pushReadmeSchema.safeParse(directPayload).success).toBe(true);
    });

    it("should reject empty readmeContent", () => {
      const payload = {
        repoUrl: "https://github.com/owner/repo",
        readmeContent: "",
        mode: "direct-commit",
      };
      expect(pushReadmeSchema.safeParse(payload).success).toBe(false);
    });
  });

  describe("refineReadmeSchema", () => {
    it("should require non-empty currentMarkdown and instruction", () => {
      expect(
        refineReadmeSchema.safeParse({
          currentMarkdown: "# Hello",
          instruction: "Add Docker setup",
        }).success
      ).toBe(true);

      expect(
        refineReadmeSchema.safeParse({
          currentMarkdown: "",
          instruction: "Add Docker setup",
        }).success
      ).toBe(false);

      expect(
        refineReadmeSchema.safeParse({
          currentMarkdown: "# Hello",
          instruction: "",
        }).success
      ).toBe(false);
    });
  });
});
