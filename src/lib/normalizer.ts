/**
 * Telemetry normalizer — transforms raw GitHub API responses into the
 * internal {@link RepositoryTelemetry} model.
 *
 * SPEC.md section 4: The Telemetry Normalizer sits between the GitHub Service
 * and the Deterministic Heuristic Engine.
 */

import type {
  GitHubRepository,
  GitHubCommitDetail,
  RepositoryTelemetry,
  NormalizedCommit,
} from "@/types";

/**
 * Normalizes a GitHub repository object and its commit details into the
 * internal telemetry representation.
 *
 * @param repo    - Raw GitHub repository object.
 * @param commits - Array of raw commit detail objects (with file stats).
 * @returns Normalized {@link RepositoryTelemetry}.
 */
export function normalizeTelemetry(
  repo: GitHubRepository,
  commits: GitHubCommitDetail[]
): RepositoryTelemetry {
  // TODO: implement normalization logic
  void repo;
  void commits;
  throw new Error("Not implemented");
}

/**
 * Normalizes a single commit detail object into a {@link NormalizedCommit}.
 *
 * @param commit - Raw GitHub commit detail object.
 * @returns Normalized commit.
 */
export function normalizeCommit(commit: GitHubCommitDetail): NormalizedCommit {
  // TODO: implement normalization logic
  void commit;
  throw new Error("Not implemented");
}
