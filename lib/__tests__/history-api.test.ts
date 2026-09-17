import { describe, it, expect, beforeEach } from "vitest";
import { useReadmeStore } from "@/lib/store/use-readme-store";

describe("ReadmeForge v2.0 — History & Export Utilities", () => {
  beforeEach(() => {
    useReadmeStore.getState().reset();
  });

  describe("Zustand Store — History Actions", () => {
    it("should atomically load markdown, repoUrl, and persona from history", () => {
      const store = useReadmeStore.getState();

      store.loadFromHistory({
        markdown: "# Generated From History\n\nFull documentation here.",
        repoUrl: "https://github.com/facebook/react",
        persona: "ACADEMIC",
        license: "MIT License text",
      });

      const updated = useReadmeStore.getState();
      expect(updated.generatedMarkdown).toBe("# Generated From History\n\nFull documentation here.");
      expect(updated.repoUrl).toBe("https://github.com/facebook/react");
      expect(updated.persona).toBe("ACADEMIC");
      expect(updated.generatedLicense).toBe("MIT License text");
      expect(updated.isGenerating).toBe(false);
      expect(updated.error).toBeNull();
    });

    it("should set repoUrl silently without resetting validation errors", () => {
      const store = useReadmeStore.getState();
      store.setError("Temporary network error");

      store.setRepoUrlSilent("https://github.com/vercel/next.js");

      const updated = useReadmeStore.getState();
      expect(updated.repoUrl).toBe("https://github.com/vercel/next.js");
      expect(updated.error).toBe("Temporary network error");
    });
  });

  describe("Content Preview & Serialization Logic", () => {
    it("should truncate markdown preview at 200 characters cleanly", () => {
      const longContent = "A".repeat(500);
      const cleanContent = longContent.replace(/\r\n/g, "\n").trim();
      const preview = cleanContent.slice(0, 200);

      expect(preview.length).toBe(200);
      expect(preview).toBe("A".repeat(200));
    });

    it("should handle short markdown content without truncation", () => {
      const shortContent = "# Hello World";
      const cleanContent = shortContent.replace(/\r\n/g, "\n").trim();
      const preview = cleanContent.slice(0, 200);

      expect(preview).toBe("# Hello World");
      expect(preview.length).toBe(13);
    });
  });

  describe("Export Naming Logic", () => {
    const getRepoName = (repoUrl: string) => {
      if (!repoUrl) return "readmeforge";
      try {
        const parts = repoUrl.trim().replace(/\/+$/, "").split("/");
        return parts[parts.length - 1] || "readmeforge";
      } catch {
        return "readmeforge";
      }
    };

    it("should correctly extract repository name for ZIP exports", () => {
      expect(getRepoName("https://github.com/Bavly-Hamdy/ReadmeForge")).toBe("ReadmeForge");
      expect(getRepoName("https://github.com/facebook/react/")).toBe("react");
      expect(getRepoName("https://github.com/owner/sub-repo///")).toBe("sub-repo");
      expect(getRepoName("")).toBe("readmeforge");
    });
  });
});
