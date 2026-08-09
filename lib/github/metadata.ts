import { Octokit } from "octokit";

export interface RepoDetailsUpdate {
  owner: string;
  repo: string;
  description: string;
  homepage?: string;
  topics: string[];
}

/**
 * Updates GitHub repository metadata: Description, Homepage/Website, and Topics.
 */
export async function updateRepoDetails(
  octokit: Octokit,
  details: RepoDetailsUpdate
): Promise<void> {
  const { owner, repo, description, homepage, topics } = details;

  // 1. Update Repo Description & Homepage
  await octokit.rest.repos.update({
    owner,
    repo,
    description: description.slice(0, 350), // Cap at 350 chars
    homepage: homepage || "",
  });

  // 2. Replace Repository Topics (topics must be lowercase alphanumeric with hyphens, max 50 chars each)
  const cleanTopics = topics
    .map((t) => t.toLowerCase().trim().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""))
    .filter((t) => t.length >= 1 && t.length <= 50)
    .slice(0, 20);

  if (cleanTopics.length > 0) {
    await octokit.rest.repos.replaceAllTopics({
      owner,
      repo,
      names: cleanTopics,
    });
  }
}

/**
 * Publishes an official production release on GitHub (e.g. v1.0.0).
 */
export async function createInitialRelease(
  octokit: Octokit,
  owner: string,
  repo: string,
  releaseNotes: string,
  tagName: string = "v1.0.0"
): Promise<{ id: number; html_url: string }> {
  const response = await octokit.rest.repos.createRelease({
    owner,
    repo,
    tag_name: tagName,
    name: `${repo} ${tagName} — Production Release`,
    body: releaseNotes,
    draft: false,
    prerelease: false,
  });

  return {
    id: response.data.id,
    html_url: response.data.html_url,
  };
}
