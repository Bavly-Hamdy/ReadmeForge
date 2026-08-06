import { Octokit } from "octokit";

export function getOctokitClient(accessToken?: string): Octokit {
  return new Octokit({
    auth: accessToken || process.env.GITHUB_TOKEN,
  });
}
