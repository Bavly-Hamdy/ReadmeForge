# ReadmeForge — Architecture Blueprint & Implementation Plan

> AI-powered platform that analyzes a GitHub repository (or uploaded codebase) and generates a polished, tailored `README.md` — with team cards, tech-stack badges, Mermaid diagrams, and one-click GitHub commit.

---

## Section 1 — System Architecture Blueprint

### 1.1 High-Level Architecture: Hybrid Serverless + Worker

**Recommendation:** Next.js 14/15 (App Router) for the web app and lightweight API routes, paired with a **dedicated persistent worker service** for repo analysis. Not a pure monolith, not full microservices — a two-tier split driven by one constraint: analysis jobs are long-running and unpredictable in duration, while the web app needs to stay fast and cheap.

| Concern | Why it lives where it does |
|---|---|
| UI, auth, billing, CRUD (templates, history) | Next.js App Router — server components for data-heavy pages, edge-friendly, fast cold starts |
| Repo tree fetch, blob filtering, AST/manifest parsing, LLM map-reduce summarization | Separate Node.js **worker service** on a persistent runtime (Fly.io / Railway / Render / ECS) — because serverless functions (Vercel: 60s–900s depending on plan) will time out on large repos, and you don't want to architect around that ceiling |
| Job orchestration | BullMQ + Redis queue between the two — the web app enqueues an `AnalyzeRepo` job and returns immediately with a job ID; the client polls or subscribes via SSE/WebSocket for progress |

This isn't microservices in the "20 tiny services" sense — it's **two services**: a request/response app and a job-processing worker. That's the right granularity for an MVP-to-Series-A trajectory; splitting further too early just adds deployment overhead without buying you anything.

### 1.2 GitHub API Integration Strategy

The core risk here is naive full-clone or full-tree-download approaches blowing through rate limits (5,000 req/hr authenticated, 15,000/hr for GitHub Apps) or disk I/O on large monorepos.

**Strategy:**
1. **Git Trees API, recursive, single call** — `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1` returns the entire file tree in one request instead of walking directories. This is the single highest-leverage optimization.
2. **Never clone.** Fetch individual blobs only for files that pass a relevance filter (see 1.3). Use the Contents API or Blobs API for those specific paths.
3. **Conditional requests with ETags** — cache tree/blob responses keyed by commit SHA; re-analysis of an unchanged repo costs zero GitHub API calls.
4. **GraphQL for contributor/metadata-heavy queries** — a single GraphQL query can pull commit counts, contributor avatars, and language breakdown in one round trip instead of N REST calls.
5. **GitHub App over OAuth App where possible** — GitHub Apps get higher rate limits (up to 12,500–15,000/hr scaled by installation count) and installation tokens instead of user tokens, which matters once you have concurrent users analyzing repos simultaneously.
6. **Exponential backoff + `Retry-After` header respect** on secondary rate limits, with the job marked `queued-retry` rather than failed.

### 1.3 AI Context Window & Processing Pipeline

A flat "dump the repo into the prompt" approach breaks on anything beyond a small project. Use a **map-reduce pipeline**:

```
Stage 0 — Structural Extraction (no LLM)
  → Parse tree, identify manifests (package.json, requirements.txt,
    Cargo.toml, go.mod, pom.xml), detect monorepo workspaces

Stage 1 — Relevance Filtering (no LLM, heuristic)
  → Exclude: node_modules, vendor, dist/build, lockfiles, .env,
    binary/media assets, test snapshots, generated files
  → Prioritize: entry points (main.*, index.*, app/**), route/controller
    files, config files, top-level README/docs if present

Stage 2 — Per-Module Summarization (LLM, parallelized/batched)
  → Chunk filtered files into logical groups (by directory/module)
  → One LLM call per chunk → structured JSON summary
    { module, purpose, keyExports, dependencies }

Stage 3 — Reduce (LLM or deterministic merge)
  → Combine module summaries + manifest data + env var list +
    detected routes into a single "Repo Digest" JSON object

Stage 4 — Generation (LLM, single final call)
  → Repo Digest + persona/tone selection + template →
    final README.md markdown
```

This bounds every individual LLM call to a fixed, predictable token budget regardless of repo size — a 50-file repo and a 5,000-file monorepo both flow through the same pipeline shape, just with more Stage 2 batches.

### 1.4 Database Schema (Prisma / PostgreSQL)

```prisma
model User {
  id            String    @id @default(cuid())
  githubId      String    @unique
  username      String
  email         String?
  avatarUrl     String?
  accessToken   String    // encrypted at rest
  refreshToken  String?
  plan          Plan      @default(FREE)
  repositories  Repository[]
  templates     CustomTemplate[]
  createdAt     DateTime  @default(now())
}

model Repository {
  id              String    @id @default(cuid())
  owner           String
  name            String
  fullName        String    @unique   // "owner/name"
  defaultBranch   String
  lastAnalyzedSha String?
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  readmes         GeneratedReadme[]
  collaborators   Collaborator[]
  createdAt       DateTime  @default(now())

  @@index([userId])
}

model GeneratedReadme {
  id           String     @id @default(cuid())
  repositoryId String
  repository   Repository @relation(fields: [repositoryId], references: [id])
  commitSha    String     // repo state this was generated from
  persona      Persona    // PORTFOLIO | OPEN_SOURCE | MINIMALIST | ENTERPRISE
  content      String     @db.Text
  qualityScore Int?       // 0-100 from scorecard engine
  pushedToRepo Boolean    @default(false)
  createdAt    DateTime   @default(now())

  @@index([repositoryId])
}

model CustomTemplate {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  name      String
  sections  Json     // ordered array of section blocks
  isPublic  Boolean  @default(false)
  createdAt DateTime @default(now())
}

model Collaborator {
  id            String     @id @default(cuid())
  repositoryId  String
  repository    Repository @relation(fields: [repositoryId], references: [id])
  githubHandle  String?
  name          String
  role          String?
  avatarUrl     String?
  commitCount   Int?       // null if manually entered
  socialLinks   Json?      // { twitter, linkedin, portfolio }

  @@index([repositoryId])
}

enum Plan {
  FREE
  PRO
  TEAM
}

enum Persona {
  PORTFOLIO
  OPEN_SOURCE
  MINIMALIST
  ENTERPRISE
}
```

**Design notes:**
- `lastAnalyzedSha` + `commitSha` on `GeneratedReadme` let you skip re-analysis when the repo hasn't changed and let users diff "README as of commit X vs current."
- `Collaborator.commitCount` nullable distinguishes GitHub-derived data from manually entered team members — important for the All-Contributors-spec formatting layer.
- `CustomTemplate.sections` as `Json` keeps the template engine flexible (reorderable blocks) without a rigid relational structure that becomes a migration headache.

---

## Section 2 — Tech Stack & Integrations

### Frontend
| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14/15, App Router | Server components for the dashboard (repo list, history) avoid client-side waterfalls; route handlers double as the thin API layer |
| Language | TypeScript, strict mode | Shared types between frontend and worker via a shared package (see 2.3) |
| State | Zustand | Editor state (live preview, template selection) is local-ish and doesn't need Redux-scale ceremony |
| UI | Tailwind + shadcn/ui | Fast to theme, accessible primitives, matches a dark/glassmorphic aesthetic without fighting a heavier component library |
| Markdown rendering | `react-markdown` + `remark-gfm` | GFM support for tables, task lists, badges |
| Diagram rendering | `mermaid` (client-side, dynamically imported) | Renders architecture/sequence diagrams live in the split preview |
| Code editor pane | CodeMirror 6 | Lighter than Monaco for a markdown-focused editor; syntax highlighting for the raw `.md` source view |

### Backend / AI Processing
| Layer | Choice | Why |
|---|---|---|
| Worker runtime | Node.js (TypeScript), long-running service | Handles Stage 0–4 of the analysis pipeline outside serverless time limits |
| Queue | BullMQ + Redis | Job retries, progress events, priority queues (Pro users jump the line) |
| GitHub client | Octokit (REST + GraphQL) | Official, typed, handles pagination and rate-limit headers |
| LLM provider layer | Provider-abstraction interface wrapping Claude and Gemini | `generateSummary()` / `generateReadme()` behind a common interface so you can A/B model quality or fail over on provider outage without touching pipeline code |
| ORM | Prisma | Matches schema above; type-safe queries shared between web and worker |
| Object storage | Cloudflare R2 (S3-compatible) | Cache repo tree JSON and filtered blob content, keyed by `owner/repo/sha`, to make repeat analysis near-instant and cheap |

### Authentication & GitHub OAuth
- **Auth.js (NextAuth)** with the GitHub provider.
- Scopes: `repo` (needed for both reading private repos and writing commits/PRs in Phase 3) and `user:email`.
- For users who only want read-only analysis of public repos, offer a **reduced-scope path** (`public_repo` only) — asking for full `repo` access up front for a feature they may never use (one-click commit) is a conversion killer. Prompt for the elevated scope only when they click "Push to GitHub."
- Store tokens encrypted (e.g., via `libsodium` sealed boxes or KMS-backed envelope encryption), never in plaintext, even in a private DB.

---

## Section 3 — Step-by-Step Implementation Plan

### Phase 1: MVP (Weeks 1–4)
**Goal:** A user can paste a public repo URL and get a generated README they can copy.

- Sprint 1: Next.js scaffold, GitHub OAuth (read-only scope), repo URL input → tree fetch via Octokit
- Sprint 2: Stage 0–1 pipeline (structure extraction + relevance filtering), manifest parsing for the top 5 ecosystems (npm, pip, cargo, go, maven)
- Sprint 3: Stage 2–4 LLM pipeline wired to one provider, single persona (Minimalist), markdown output rendered in a read-only preview
- Sprint 4: Copy/export button, basic error handling for private/huge repos, deploy worker as a separate service

**Exit criteria:** End-to-end flow works for repos up to ~500 files without manual intervention.

### Phase 2: Collaborator & Visual Layer (Weeks 5–8)
- Sprint 5: GraphQL contributor query + manual collaborator entry form, All-Contributors-spec table renderer
- Sprint 6: Shields.io badge builder driven by detected tech stack (auto-map detected frameworks → badge URLs)
- Sprint 7: Mermaid diagram generation — feed the Repo Digest's module/dependency graph into a templated Mermaid `graph TD` or `sequenceDiagram` block
- Sprint 8: Remaining 3 personas (Portfolio, Open Source, Enterprise) as distinct prompt templates + section toggles

**Exit criteria:** Generated READMEs include contributor tables, tech badges, and at least one auto-generated diagram.

### Phase 3: GitHub Integration & Real-Time Sync (Weeks 9–12)
- Sprint 9: Elevate OAuth scope flow, Contents API integration for direct commit
- Sprint 10: PR creation flow (branch + commit + PR) as an alternative to direct push
- Sprint 11: Split-screen live editor — CodeMirror source pane + live-rendered markdown/Mermaid preview, debounced re-render
- Sprint 12: Job progress streaming (SSE) so the analysis screen shows real-time stage progress instead of a spinner

**Exit criteria:** User can generate, edit live, and push directly to their repo without leaving the app.

### Phase 4: Optimization & Pro Features (Weeks 13–16)
- Sprint 13: README Health Scorecard — heuristic checks (missing license badge, no live demo link, no setup section) + LLM-assisted completeness scoring against the existing README
- Sprint 14: Custom template builder/marketplace (reorderable section blocks from the `CustomTemplate` model)
- Sprint 15: Caching layer maturity — R2-backed blob cache, SHA-based skip-reanalysis, worker autoscaling based on queue depth
- Sprint 16: Usage-based billing tiers (Free: public repos only, limited generations/month; Pro: private repos, unlimited; Team: shared templates, seats)

**Exit criteria:** Product is monetizable, returning users get faster re-analysis, and the scorecard gives a concrete "why regenerate" hook.

---

## Section 4 — Production Master Prompt (Final Generation Stage)

This is the system prompt the worker sends to the LLM at **Stage 4** (final generation), after the Repo Digest has already been assembled. It intentionally does *not* re-ask the model to parse code — that work is already done by Stages 0–3, which keeps this call fast and cheap.

```
SYSTEM PROMPT — README GENERATION (Stage 4)

You are a senior technical writer producing a production-ready README.md
for a software repository. You will receive a structured JSON object
called REPO_DIGEST containing pre-extracted facts about the codebase.
Do not invent facts not present in REPO_DIGEST — if information is
missing (e.g., no license detected, no deploy URL provided), omit that
section rather than fabricating content.

INPUT SCHEMA (REPO_DIGEST):
{
  "repoName": string,
  "description": string | null,
  "techStack": { language: string, frameworks: string[], databases: string[] },
  "modules": [{ name: string, purpose: string, keyExports: string[] }],
  "envVars": [{ name: string, required: boolean, description: string | null }],
  "apiRoutes": [{ method: string, path: string, description: string | null }],
  "collaborators": [{ name: string, role: string | null, githubHandle: string | null }],
  "license": string | null,
  "existingReadmeSummary": string | null
}

PARAMETERS:
- persona: one of PORTFOLIO | OPEN_SOURCE | MINIMALIST | ENTERPRISE
- customSections: ordered array of section names to include/exclude/reorder

PERSONA BEHAVIOR:
- PORTFOLIO: Lead with a problem statement and outcome. Include an
  "Architecture Decisions" section explaining *why* key tech choices
  were made. Emphasize live demo / screenshots placeholders.
- OPEN_SOURCE: Include Contributing guidelines, Code of Conduct link,
  Issue/PR templates reference, and a clear "Getting Started" for
  first-time contributors, not just end users.
- MINIMALIST: Strip to: one-line description, install, run, license.
  No badges beyond build status. Target: under 60 lines.
- ENTERPRISE: Full API reference table (from apiRoutes), security
  considerations section, deployment/environment matrix, versioning
  policy placeholder.

OUTPUT REQUIREMENTS:
1. Valid GitHub-Flavored Markdown only. No commentary outside the
   markdown itself.
2. Tech stack badges as Shields.io markdown image links, generated
   from techStack — do not hardcode badge URLs not derivable from
   the provided stack.
3. If apiRoutes is non-empty, include a Markdown table: Method | Path
   | Description.
4. If envVars is non-empty, include a ".env Configuration" section
   listing each variable, whether required, and description if present.
5. If collaborators is non-empty, format as an All-Contributors-style
   table (name, role, GitHub handle as a linked @mention).
6. Include one Mermaid diagram (```mermaid fenced block) summarizing
   module relationships from `modules`, using a graph TD layout.
7. Respect customSections ordering if provided; otherwise use the
   default section order for the given persona.

Return only the final README.md content.
```

**Why this design:** separating "understand the code" (Stages 0–3) from "write the document" (Stage 4) means the generation prompt is deterministic and cheap to iterate on — you can tune tone, section order, and formatting without re-running the expensive summarization pipeline against GitHub's API.

---

## Open Questions Worth Deciding Early
- **LLM provider default:** Claude vs. Gemini as primary — affects the abstraction layer's default routing and cost model per analysis.
- **Monorepo handling:** does Phase 1 detect workspace packages (`pnpm-workspace.yaml`, `turbo.json`) and offer per-package READMEs, or treat the whole repo as one unit until Phase 2+?
- **Self-serve vs. GitHub App install flow:** a GitHub App (installable from the Marketplace) vs. OAuth App changes both the rate-limit ceiling (1.3) and the distribution/discovery story — worth deciding before Phase 3's write-scope work, since switching later means re-onboarding users.
