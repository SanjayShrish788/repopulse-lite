/**
 * GitHub service — retrieves repository and commit telemetry from the
 * GitHub REST API.
 *
 * SPEC.md section 4: GitHub Service is responsible for:
 *   - Repository API  → repository metadata
 *   - Commit List API → list of recent commits
 *   - Commit Detail API → per-commit file stats
 *
 * All network calls are not yet implemented.
 */

import type {
  GitHubRepository,
  GitHubCommitListItem,
  GitHubCommitDetail,
} from "@/types";

/**
 * Fetches repository metadata from the GitHub REST API.
 *
 * @param owner - Repository owner (user or organization).
 * @param repo  - Repository name.
 * @returns GitHub repository object.
 */
export async function fetchRepository(
  owner: string,
  repo: string
): Promise<GitHubRepository> {
  // TODO: implement GitHub REST API call
  void owner;
  void repo;
  throw new Error("Not implemented");
}

/**
 * Fetches recent commits for the given repository.
 *
 * @param owner  - Repository owner.
 * @param repo   - Repository name.
 * @param branch - Branch to retrieve commits from.
 * @param perPage - Number of commits to retrieve (max 100 per GitHub API page).
 * @returns Array of commit list items.
 */
export async function fetchCommitList(
  owner: string,
  repo: string,
  branch: string,
  perPage = 30
): Promise<GitHubCommitListItem[]> {
  // TODO: implement GitHub REST API call
  void owner;
  void repo;
  void branch;
  void perPage;
  throw new Error("Not implemented");
}

/**
 * Fetches detailed commit information including file stats.
 *
 * @param owner - Repository owner.
 * @param repo  - Repository name.
 * @param sha   - Commit SHA.
 * @returns Full commit detail object.
 */
export async function fetchCommitDetail(
  owner: string,
  repo: string,
  sha: string
): Promise<GitHubCommitDetail> {
  // TODO: implement GitHub REST API call
  void owner;
  void repo;
  void sha;
  throw new Error("Not implemented");
}
