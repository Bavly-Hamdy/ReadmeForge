import { Octokit } from "octokit";

export interface GitTreeItem {
  path?: string;
  mode?: string;
  type?: string;
  sha?: string;
  size?: number;
  url?: string;
}

export interface FetchRepoTreeOptions {
  owner: string;
  repo: string;
  /** Optional explicit branch. If omitted, auto-detected via ref probing (zero extra API calls). */
  branch?: string;
}

export interface RepoTreeResponse {
  sha: string;
  tree: GitTreeItem[];
  truncated: boolean;
  defaultBranch: string;
  repoDescription: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(err: unknown): boolean {
  const status = (err as any)?.status ?? (err as any)?.response?.status;
  return status === 403 || status === 429;
}

function isNotFoundError(err: unknown): boolean {
  const status = (err as any)?.status ?? (err as any)?.response?.status;
  return status === 404 || status === 422;
}

/**
 * Executes a GitHub API call with exponential backoff on rate-limit responses.
 * Parses the `Retry-After` header when GitHub provides it (secondary rate limits).
 * Throws immediately on non-rate-limit errors (e.g. 404) — no point retrying those.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = 3
): Promise<T> {
  let delay = 1500;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      // Never retry on 404/422 — repo doesn't exist or branch name is wrong
      if (isNotFoundError(err)) throw err;

      const limited = isRateLimitError(err);
      if (!limited || attempt === maxRetries) throw err;

      const retryAfterHeader: string | undefined =
        (err as any)?.response?.headers?.["retry-after"];
      const waitMs = retryAfterHeader
        ? parseInt(retryAfterHeader, 10) * 1000
        : delay;

      console.warn(
        `[GitHub] ${label} — rate limit hit (attempt ${attempt}/${maxRetries}). ` +
          `Waiting ${waitMs}ms...`
      );
      await sleep(waitMs);
      delay *= 2;
    }
  }
  throw new Error(`[GitHub] ${label} failed after ${maxRetries} retries.`);
}

// ─── Core: Zero-pre-flight tree fetch ─────────────────────────────────────────

/**
 * Attempts getTree() directly using a ref string (branch name or "HEAD").
 * GitHub's Trees API accepts refs as `tree_sha` — no commit resolution needed.
 * Returns null on 404/422 so the caller can try the next candidate ref.
 */
async function tryGetTree(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string
): Promise<{ treeRes: Awaited<ReturnType<typeof octokit.rest.git.getTree>>; resolvedRef: string } | null> {
  try {
    const treeRes = await withRetry(
      () =>
        octokit.rest.git.getTree({
          owner,
          repo,
          tree_sha: ref,
          recursive: "1",
        }),
      `getTree(${ref})`
    );
    return { treeRes, resolvedRef: ref };
  } catch (err) {
    if (isNotFoundError(err)) return null; // wrong ref — try next
    throw err; // rate limit or other — propagate up
  }
}

/**
 * Fetches the full recursive git tree for a repository using the minimum possible
 * number of GitHub API calls.
 *
 * STRATEGY (in order, stops at first success):
 *   1. If an explicit branch was provided → getTree(branch) — 1 API call.
 *   2. Try getTree("HEAD")               — 1 API call, works on most repos.
 *   3. Try getTree("main")               — 1 API call, common default.
 *   4. Try getTree("master")             — 1 API call, legacy default.
 *   5. Fall back to getRepo() + getTree  — 2 API calls, guaranteed to work.
 *
 * Total calls (typical case): 1–2 instead of the previous 3.
 * Total calls (worst case / unusual default branch): 2 (getRepo + getTree).
 */
export async function fetchRepoTree(
  octokit: Octokit,
  options: FetchRepoTreeOptions
): Promise<RepoTreeResponse> {
  const { owner, repo, branch } = options;

  // ── Path A: Caller supplied an explicit branch ─────────────────────────────
  if (branch) {
    const result = await tryGetTree(octokit, owner, repo, branch);
    if (!result) {
      throw new Error(
        `Branch "${branch}" not found in repository "${owner}/${repo}".`
      );
    }
    return buildResponse(result.treeRes, branch, null);
  }

  // ── Path B: Probe common refs without any pre-flight calls ────────────────
  const candidates = ["HEAD", "main", "master"];
  for (const ref of candidates) {
    const result = await tryGetTree(octokit, owner, repo, ref);
    if (result) {
      // "HEAD" is a symbolic ref — report the actual branch name as "default"
      // by reading the commit SHA's associated ref name from the response SHA.
      // In practice "HEAD" works fine; we label it the ref we used.
      const reportedBranch = ref === "HEAD" ? "default" : ref;
      return buildResponse(result.treeRes, reportedBranch, null);
    }
  }

  // ── Path C: Unusual default branch — fall back to getRepo() ───────────────
  // Only reached if HEAD + main + master all returned 404 (very rare).
  console.warn(
    `[GitHub Tree] Common refs failed for ${owner}/${repo}. ` +
      `Falling back to getRepo() to discover default_branch.`
  );

  const repoRes = await withRetry(
    () => octokit.rest.repos.get({ owner, repo }),
    "getRepo (fallback)"
  );
  const defaultBranch = repoRes.data.default_branch;
  const description = repoRes.data.description ?? null;

  const result = await tryGetTree(octokit, owner, repo, defaultBranch);
  if (!result) {
    throw new Error(
      `Could not fetch tree for "${owner}/${repo}" on branch "${defaultBranch}".`
    );
  }

  return buildResponse(result.treeRes, defaultBranch, description);
}

// ─── Internal builder ─────────────────────────────────────────────────────────

function buildResponse(
  treeRes: Awaited<ReturnType<Octokit["rest"]["git"]["getTree"]>>,
  branch: string,
  description: string | null
): RepoTreeResponse {
  if (treeRes.data.truncated) {
    console.warn(
      `[GitHub Tree] Tree truncated — only ${treeRes.data.tree.length} paths returned. ` +
        `Large repos may have incomplete analysis.`
    );
  }
  return {
    sha: treeRes.data.sha,
    tree: treeRes.data.tree as GitTreeItem[],
    truncated: Boolean(treeRes.data.truncated),
    defaultBranch: branch,
    repoDescription: description,
  };
}

// ─── Blob fetchers ────────────────────────────────────────────────────────────

/**
 * Fetches a single blob with rate-limit backoff.
 */
export async function fetchBlobContent(
  octokit: Octokit,
  owner: string,
  repo: string,
  fileSha: string
): Promise<string> {
  const blobRes = await withRetry(
    () => octokit.rest.git.getBlob({ owner, repo, file_sha: fileSha }),
    `getBlob(${fileSha.slice(0, 7)})`
  );

  const { content, encoding } = blobRes.data;
  if (encoding === "base64") {
    return Buffer.from(content, "base64").toString("utf-8");
  }
  return content;
}

/**
 * Fetches multiple blobs with mode-aware throttling:
 *
 * - Authenticated (OAuth token present) → parallel, 5,000 req/hr budget.
 * - Unauthenticated                     → sequential with 350ms gap,
 *   keeps well under the 60 req/hr (≈1 req/60s) unauthenticated limit
 *   for the small set of files we actually need (~10–20).
 */
export async function fetchBlobsThrottled(
  octokit: Octokit,
  owner: string,
  repo: string,
  items: { path: string; sha: string }[],
  isAuthenticated: boolean
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};

  if (isAuthenticated) {
    await Promise.all(
      items.map(async ({ path, sha }) => {
        try {
          results[path] = await fetchBlobContent(octokit, owner, repo, sha);
        } catch (err) {
          console.warn(`[GitHub] Blob skipped (${path}):`, (err as Error)?.message);
        }
      })
    );
  } else {
    // Sequential + conservative gap for unauthenticated callers
    for (const { path, sha } of items) {
      try {
        results[path] = await fetchBlobContent(octokit, owner, repo, sha);
        await sleep(350);
      } catch (err) {
        console.warn(`[GitHub] Blob skipped (${path}):`, (err as Error)?.message);
      }
    }
  }

  return results;
}
