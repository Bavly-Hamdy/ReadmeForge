export type Persona = "PORTFOLIO" | "OPEN_SOURCE" | "MINIMALIST" | "ENTERPRISE";

export interface TechStack {
  language: string;
  frameworks: string[];
  databases: string[];
}

export interface ModuleSummary {
  name: string;
  purpose: string;
  keyExports: string[];
  dependencies?: string[];
}

export interface EnvVariable {
  name: string;
  required: boolean;
  description: string | null;
}

export interface ApiRoute {
  method: string;
  path: string;
  description: string | null;
}

export interface CollaboratorInfo {
  id?: string;
  name: string;
  role: string | null;
  githubHandle: string | null;
  avatarUrl?: string | null;
  commitCount?: number | null;
  socialLinks?: Record<string, string> | null;
}

export interface RepoDigest {
  repoName: string;
  description: string | null;
  techStack: TechStack;
  modules: ModuleSummary[];
  envVars: EnvVariable[];
  apiRoutes: ApiRoute[];
  collaborators: CollaboratorInfo[];
  license: string | null;
  existingReadmeSummary: string | null;
}

export interface ReadmeGenerationParams {
  digest: RepoDigest;
  persona: Persona;
  customSections?: string[];
  teamName?: string;
  demoUrl?: string;
  customTitle?: string;
  collaborators?: CollaboratorInfo[];
}

export interface Stage0Result {
  manifests: Record<string, string>;
  ecosystems: string[];
  detectedWorkspaces?: string[];
  treePaths: string[];
}

export interface Stage1Result {
  filteredPaths: string[];
  prioritizedFiles: { path: string; category: "entry" | "route" | "config" | "docs" }[];
}

export interface PipelineProgress {
  stage: 0 | 1 | 2 | 3 | 4;
  progressPercent: number;
  message: string;
  error?: string;
}
