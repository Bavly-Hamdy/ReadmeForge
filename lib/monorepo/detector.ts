export interface PackageInfo {
  name: string;
  path: string;
  hasOwnReadme: boolean;
  manifestPath: string;
  description?: string;
}

export interface MonorepoInfo {
  isMonorepo: boolean;
  tool: "turborepo" | "nx" | "lerna" | "pnpm-workspaces" | "npm-workspaces" | "cargo-workspaces" | "go-workspace" | null;
  packages: PackageInfo[];
  rootManifest: string | null;
}

/**
 * Detects whether the given file tree / manifests belong to a monorepo workspace
 * and discovers all child packages.
 */
export function detectMonorepo(
  treePaths: string[],
  manifests: Record<string, string> = {}
): MonorepoInfo {
  const pathSet = new Set(treePaths.map((p) => p.replace(/\\/g, "/")));

  let tool: MonorepoInfo["tool"] = null;
  let rootManifest: string | null = null;

  if (pathSet.has("turbo.json")) {
    tool = "turborepo";
    rootManifest = "turbo.json";
  } else if (pathSet.has("nx.json")) {
    tool = "nx";
    rootManifest = "nx.json";
  } else if (pathSet.has("lerna.json")) {
    tool = "lerna";
    rootManifest = "lerna.json";
  } else if (pathSet.has("pnpm-workspace.yaml") || pathSet.has("pnpm-workspace.yml")) {
    tool = "pnpm-workspaces";
    rootManifest = pathSet.has("pnpm-workspace.yaml") ? "pnpm-workspace.yaml" : "pnpm-workspace.yml";
  } else if (pathSet.has("go.work")) {
    tool = "go-workspace";
    rootManifest = "go.work";
  } else if (pathSet.has("Cargo.toml")) {
    const cargoContent = manifests["Cargo.toml"] || "";
    if (/\[workspace\]/i.test(cargoContent)) {
      tool = "cargo-workspaces";
      rootManifest = "Cargo.toml";
    }
  }

  // Also check root package.json for "workspaces" field if tool is not yet set or is turborepo/lerna
  if (pathSet.has("package.json") && !tool) {
    const pkgContent = manifests["package.json"];
    if (pkgContent) {
      try {
        const parsed = JSON.parse(pkgContent);
        if (parsed.workspaces && (Array.isArray(parsed.workspaces) || Array.isArray(parsed.workspaces.packages))) {
          tool = "npm-workspaces";
          rootManifest = "package.json";
        }
      } catch {
        // Ignore JSON parse errors on partial or invalid json
      }
    }
  }

  if (!tool) {
    return {
      isMonorepo: false,
      tool: null,
      packages: [],
      rootManifest: null,
    };
  }

  // Identify sub-packages by locating package manifests in subdirectories
  const packages: PackageInfo[] = [];
  const packageManifestPattern = /^(?:packages|apps|services|libs|modules|crates)\/([^/]+)\/(package\.json|Cargo\.toml|go\.mod)$/;

  for (const p of pathSet) {
    const match = p.match(packageManifestPattern);
    if (match) {
      const dir = p.substring(0, p.lastIndexOf("/"));
      const pkgFolder = match[1];
      const manifestFile = match[2];

      let pkgName = pkgFolder;
      let description: string | undefined;

      const rawManifest = manifests[p];
      if (rawManifest && manifestFile === "package.json") {
        try {
          const parsed = JSON.parse(rawManifest);
          if (parsed.name) pkgName = parsed.name;
          if (parsed.description) description = parsed.description;
        } catch {
          // fallback to folder name
        }
      } else if (rawManifest && manifestFile === "Cargo.toml") {
        const nameMatch = rawManifest.match(/name\s*=\s*["']([^"']+)["']/);
        if (nameMatch) pkgName = nameMatch[1];
        const descMatch = rawManifest.match(/description\s*=\s*["']([^"']+)["']/);
        if (descMatch) description = descMatch[1];
      }

      const hasOwnReadme =
        pathSet.has(`${dir}/README.md`) ||
        pathSet.has(`${dir}/readme.md`) ||
        pathSet.has(`${dir}/README.MD`);

      // Avoid duplicates if multiple manifests match
      if (!packages.some((item) => item.path === dir)) {
        packages.push({
          name: pkgName,
          path: dir,
          hasOwnReadme,
          manifestPath: p,
          description,
        });
      }
    }
  }

  // Sort packages by path for deterministic ordering
  packages.sort((a, b) => a.path.localeCompare(b.path));

  return {
    isMonorepo: true,
    tool,
    packages,
    rootManifest,
  };
}
