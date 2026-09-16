import { Octokit } from "octokit";

export interface FileToCommit {
  path: string;
  content: string;
}

export interface CommitParams {
  owner: string;
  repo: string;
  branch?: string;
  files: FileToCommit[];
  commitMessage: string;
}

export interface PullRequestParams {
  owner: string;
  repo: string;
  baseBranch?: string;
  files: FileToCommit[];
  prTitle: string;
  prBody: string;
}

/**
 * Gets file SHA if it already exists in the target branch
 */
async function getFileShaIfExists(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  branch: string
): Promise<string | undefined> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });

    if (!Array.isArray(data) && "sha" in data) {
      return data.sha;
    }
  } catch (err: any) {
    if (err.status === 404) {
      return undefined;
    }
    console.warn(`[GitHub Push] Could not check existing sha for ${path}:`, err?.message || err);
  }
  return undefined;
}

/**
 * Commits one or more files directly to a repository branch
 */
export async function commitFilesToRepo(
  octokit: Octokit,
  params: CommitParams
): Promise<{ commitSha: string; htmlUrl: string }> {
  const { owner, repo, files, commitMessage } = params;

  // Resolve target branch (default branch if not specified)
  let branch = params.branch;
  if (!branch) {
    const repoInfo = await octokit.rest.repos.get({ owner, repo });
    branch = repoInfo.data.default_branch || "main";
  }

  let lastCommitSha = "";

  for (const file of files) {
    const sha = await getFileShaIfExists(octokit, owner, repo, file.path, branch);
    const contentBase64 = Buffer.from(file.content, "utf-8").toString("base64");

    const res = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: file.path,
      message: `${commitMessage} (${file.path})`,
      content: contentBase64,
      branch,
      sha,
    });

    lastCommitSha = res.data.commit.sha || "";
  }

  const htmlUrl = `https://github.com/${owner}/${repo}/blob/${branch}/${files[0]?.path || "README.md"}`;

  return {
    commitSha: lastCommitSha,
    htmlUrl,
  };
}

/**
 * Creates a new branch, commits files, and opens a Pull Request
 */
export async function createPullRequestWithFiles(
  octokit: Octokit,
  params: PullRequestParams
): Promise<{ prNumber: number; htmlUrl: string }> {
  const { owner, repo, files, prTitle, prBody } = params;

  // 1. Resolve base branch
  let baseBranch = params.baseBranch;
  if (!baseBranch) {
    const repoInfo = await octokit.rest.repos.get({ owner, repo });
    baseBranch = repoInfo.data.default_branch || "main";
  }

  // 2. Get the latest commit SHA of the base branch
  const refData = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${baseBranch}`,
  });
  const baseSha = refData.data.object.sha;

  // 3. Create a unique feature branch
  const branchName = `chore/update-readme-${Date.now()}`;
  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: baseSha,
  });

  // 4. Commit files to the new branch
  for (const file of files) {
    const sha = await getFileShaIfExists(octokit, owner, repo, file.path, branchName);
    const contentBase64 = Buffer.from(file.content, "utf-8").toString("base64");

    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: file.path,
      message: `docs: update ${file.path} via ReadmeForge`,
      content: contentBase64,
      branch: branchName,
      sha,
    });
  }

  // 5. Open Pull Request
  const pr = await octokit.rest.pulls.create({
    owner,
    repo,
    title: prTitle,
    head: branchName,
    base: baseBranch,
    body: prBody,
  });

  return {
    prNumber: pr.data.number,
    htmlUrl: pr.data.html_url,
  };
}
