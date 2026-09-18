import { describe, it, expect } from "vitest";
import { detectMonorepo } from "../monorepo/detector";

describe("Monorepo Workspace Detector", () => {
  it("identifies Turborepo monorepos and discovers child packages", () => {
    const treePaths = [
      "turbo.json",
      "package.json",
      "packages/ui/package.json",
      "packages/ui/README.md",
      "apps/web/package.json",
      "apps/web/src/index.ts",
    ];

    const manifests = {
      "packages/ui/package.json": JSON.stringify({
        name: "@repo/ui",
        description: "Shared React component library",
      }),
      "apps/web/package.json": JSON.stringify({
        name: "web-app",
        description: "Customer-facing web portal",
      }),
    };

    const info = detectMonorepo(treePaths, manifests);
    expect(info.isMonorepo).toBe(true);
    expect(info.tool).toBe("turborepo");
    expect(info.packages.length).toBe(2);

    const uiPkg = info.packages.find((p) => p.name === "@repo/ui");
    expect(uiPkg).toBeDefined();
    expect(uiPkg?.path).toBe("packages/ui");
    expect(uiPkg?.hasOwnReadme).toBe(true);
    expect(uiPkg?.description).toBe("Shared React component library");
  });

  it("identifies pnpm workspaces", () => {
    const treePaths = [
      "pnpm-workspace.yaml",
      "package.json",
      "packages/core/package.json",
    ];

    const info = detectMonorepo(treePaths, {});
    expect(info.isMonorepo).toBe(true);
    expect(info.tool).toBe("pnpm-workspaces");
    expect(info.packages.length).toBe(1);
    expect(info.packages[0].name).toBe("core");
  });

  it("identifies Cargo workspaces", () => {
    const treePaths = [
      "Cargo.toml",
      "crates/parser/Cargo.toml",
    ];

    const manifests = {
      "Cargo.toml": `[workspace]\nmembers = ["crates/*"]`,
      "crates/parser/Cargo.toml": `[package]\nname = "rust-parser"\ndescription = "AST parsing engine"`,
    };

    const info = detectMonorepo(treePaths, manifests);
    expect(info.isMonorepo).toBe(true);
    expect(info.tool).toBe("cargo-workspaces");
    expect(info.packages.length).toBe(1);
    expect(info.packages[0].name).toBe("rust-parser");
  });

  it("returns false for standard single-package repositories", () => {
    const treePaths = [
      "package.json",
      "src/index.ts",
      "README.md",
    ];

    const info = detectMonorepo(treePaths, {});
    expect(info.isMonorepo).toBe(false);
    expect(info.tool).toBeNull();
    expect(info.packages.length).toBe(0);
  });
});
