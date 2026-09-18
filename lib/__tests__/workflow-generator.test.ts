import { describe, it, expect } from "vitest";
import { generateWorkflowYaml } from "../cicd/workflow-generator";

describe("CI/CD Workflow Generator", () => {
  it("generates valid GitHub Actions workflow YAML for push and manual triggers", () => {
    const yaml = generateWorkflowYaml({
      repoFullName: "facebook/react",
      triggerBranch: "main",
      persona: "ENTERPRISE",
      includeTests: true,
      nodeVersion: "20",
    });

    expect(yaml).toContain("name: ReadmeForge Documentation Sync");
    expect(yaml).toContain("branches:\n      - main");
    expect(yaml).toContain("workflow_dispatch:");
    expect(yaml).toContain("node-version: '20'");
    expect(yaml).toContain("Run Test Suite Verification");
    expect(yaml).toContain("git commit -m \"docs: auto-sync architecture documentation via ReadmeForge [skip ci]\"");
    expect(yaml).toContain("git push origin main");
  });

  it("includes cron schedule when configured", () => {
    const yaml = generateWorkflowYaml({
      repoFullName: "owner/repo",
      triggerBranch: "master",
      schedule: "0 0 * * 1",
    });

    expect(yaml).toContain("schedule:\n    - cron: '0 0 * * 1'");
    expect(yaml).toContain("branches:\n      - master");
  });
});
