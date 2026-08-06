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
  branch?: string;
  accessToken?: string;
}

export interface RepoTreeResponse {
  sha: string;
  tree: GitTreeItem[];
  truncated: boolean;
}

/**
 * Single-call recursive Git Trees API fetcher.
 * Uses `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1`
 */
export async function fetchRepoTree(
  octokit: Octokit,
  options: FetchRepoTreeOptions
): Promise<RepoTreeResponse> {
  const { owner, repo, branch = "main" } = options;

  // 1. Resolve branch to latest commit SHA if branch is provided
  let shaToFetch = branch;
  try {
    const branchRes = await octokit.rest.repos.getBranch({
      owner,
      repo,
      branch,
    });
    shaToFetch = branchRes.data.commit.sha;
  } catch (error) {
    // If branch doesn't match, fallback to ref head or provided sha directly
    console.warn(`[GitHub Tree] Could not resolve branch ${branch}, using directly as ref SHA.`, error);
  }

  // 2. Fetch recursive git tree
  const treeRes = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: shaToFetch,
    recursive: "1",
  });

  return {
    sha: treeRes.data.sha,
    tree: treeRes.data.tree as GitTreeItem[],
    truncated: Boolean(treeRes.data.truncated),
  };
}

/**
 * Single blob content fetcher for targeted files (never full clone).
 */
export async function fetchBlobContent(
  octokit: Octokit,
  owner: string,
  repo: string,
  fileSha: string
): Promise<string> {
  const blobRes = await octokit.rest.git.getBlob({
    owner,
    repo,
    file_sha: fileSha,
  });

  const content = blobRes.data.content;
  const encoding = blobRes.data.encoding;

  if (encoding === "base64") {
    return Buffer.from(content, "base64").toString("utf-8");
  }

  return content;
}
