/**
 * Telemetry normalizer — transforms raw GitHub API responses into the
 * internal {@link RepositoryTelemetry} model.
 *
 * SPEC.md section 4: The Telemetry Normalizer sits between the GitHub Service
 * and the Deterministic Heuristic Engine.
 *
 * This module is a pure transformation layer:
 *   - No network calls.
 *   - No scoring logic.
 *   - No invented fallback values for missing required fields.
 *
 * Malformed input is surfaced as {@link NormalizationError} so the API route
 * can classify it and return a clear error to the caller.
 */

import type {
  GitHubRepository,
  GitHubCommitDetail,
  RepositoryTelemetry,
  NormalizedCommit,
} from "@/types";

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

/**
 * Thrown when required telemetry data is malformed or missing.
 *
 * Distinct from GitHub service errors — by the time normalization runs, the
 * HTTP layer has already succeeded. A NormalizationError indicates the payload
 * was structurally invalid rather than a network or auth problem.
 */
export class NormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NormalizationError";
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Parses an ISO 8601 timestamp string into a JavaScript {@link Date}.
 *
 * Throws {@link NormalizationError} rather than returning an invalid Date when
 * the string is empty, missing, or does not parse to a finite timestamp. The
 * scoring engine must not receive NaN-valued Dates.
 *
 * @param value   - Raw timestamp string from the GitHub API.
 * @param field   - Field name, used in the error message for diagnostics.
 * @returns A valid, finite {@link Date}.
 */
function parseRequiredDate(value: string, field: string): Date {
  if (!value) {
    throw new NormalizationError(
      `Required timestamp field "${field}" is empty or missing.`
    );
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new NormalizationError(
      `Required timestamp field "${field}" could not be parsed as a valid date: "${value}".`
    );
  }
  return date;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalizes a single raw GitHub commit detail object into a
 * {@link NormalizedCommit}.
 *
 * Raw-to-normalized field mapping:
 *
 * | Raw (GitHubCommitDetail)          | Normalized (NormalizedCommit) | Notes                                    |
 * |-----------------------------------|-------------------------------|------------------------------------------|
 * | `sha`                             | `sha`                         | Passed through unchanged                 |
 * | `commit.author.name`              | `authorName`                  | Passed through unchanged                 |
 * | `commit.author.email`             | `authorEmail`                 | Passed through unchanged                 |
 * | `commit.author.date`              | `date`                        | ISO 8601 string → JavaScript Date        |
 * | `commit.message`                  | `message`                     | Passed through unchanged                 |
 * | `stats.additions`                 | `additions`                   | Passed through unchanged                 |
 * | `stats.deletions`                 | `deletions`                   | Passed through unchanged                 |
 * | `stats.total`                     | `totalChanges`                | Rename only                              |
 * | `files.length`                    | `filesChanged`                | Derived: count of entries in files array |
 *
 * The GitHub service layer (`fetchCommitDetail`) has already validated that
 * `stats` and `files` are present. This function treats those fields as
 * guaranteed by that contract, but validates the date string defensively.
 *
 * @param commit - Raw GitHub commit detail object (stats and files validated).
 * @returns Normalized {@link NormalizedCommit}.
 * @throws {NormalizationError} If the commit author date cannot be parsed.
 */
export function normalizeCommit(commit: GitHubCommitDetail): NormalizedCommit {
  const date = parseRequiredDate(
    commit.commit.author.date,
    `commit.${commit.sha}.commit.author.date`
  );

  return {
    sha: commit.sha,
    authorName: commit.commit.author.name,
    authorEmail: commit.commit.author.email,
    date,
    message: commit.commit.message,
    additions: commit.stats.additions,
    deletions: commit.stats.deletions,
    totalChanges: commit.stats.total,
    // Derived from the files array rather than stats.total to give the scoring
    // engine an accurate count of distinct files touched, not change-line totals.
    filesChanged: commit.files.length,
  };
}

/**
 * Normalizes a raw GitHub repository object and its commit details into the
 * internal {@link RepositoryTelemetry} model consumed by the scoring engine.
 *
 * Raw-to-normalized field mapping — repository summary:
 *
 * | Raw (GitHubRepository)            | Normalized (repository shape) | Notes                             |
 * |-----------------------------------|-------------------------------|-----------------------------------|
 * | `full_name`                       | `fullName`                    | Rename only                       |
 * | `description`                     | `description`                 | Passed through (string \| null)   |
 * | `stargazers_count`                | `stars`                       | Rename only                       |
 * | `forks_count`                     | `forks`                       | Rename only                       |
 * | `open_issues_count`               | `openIssues`                  | Rename only                       |
 * | `default_branch`                  | `defaultBranch`               | Rename only                       |
 * | `pushed_at`                       | `pushedAt`                    | ISO 8601 string → JavaScript Date |
 * | `created_at`                      | `createdAt`                   | ISO 8601 string → JavaScript Date |
 * | `updated_at`                      | `updatedAt`                   | ISO 8601 string → JavaScript Date |
 * | `archived`                        | `archived`                    | Passed through unchanged          |
 *
 * Each raw commit detail is converted via {@link normalizeCommit}. The
 * resulting commits array preserves the order supplied by the GitHub service
 * (newest first from the API).
 *
 * No additional API calls are made; all data comes from the supplied arguments.
 *
 * @param repo    - Raw GitHub repository object.
 * @param commits - Array of raw commit detail objects (stats and files validated).
 * @returns Normalized {@link RepositoryTelemetry} ready for the scoring engine.
 * @throws {NormalizationError} If any required timestamp is missing or unparseable.
 */
export function normalizeTelemetry(
  repo: GitHubRepository,
  commits: GitHubCommitDetail[]
): RepositoryTelemetry {
  const pushedAt = parseRequiredDate(repo.pushed_at, "repository.pushed_at");
  const createdAt = parseRequiredDate(repo.created_at, "repository.created_at");
  const updatedAt = parseRequiredDate(repo.updated_at, "repository.updated_at");

  return {
    repository: {
      fullName: repo.full_name,
      description: repo.description,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      openIssues: repo.open_issues_count,
      defaultBranch: repo.default_branch,
      pushedAt,
      createdAt,
      updatedAt,
      archived: repo.archived,
    },
    // normalizeCommit is called per-commit so each failure pinpoints its SHA.
    commits: commits.map(normalizeCommit),
  };
}
