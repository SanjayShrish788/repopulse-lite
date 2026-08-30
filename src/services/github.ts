/**
 * GitHub service — retrieves repository and commit telemetry from the
 * GitHub REST API.
 *
 * SPEC.md section 4: GitHub Service is responsible for:
 *   - Repository API  → repository metadata      ← implemented
 *   - Commit List API → list of recent commits   ← implemented here
 *   - Commit Detail API → per-commit file stats  ← implemented here
 *
 * Environment variables:
 *   GITHUB_TOKEN  (optional) Personal Access Token.
 *                 Omitting it uses unauthenticated access (60 req/hr).
 *                 Providing it raises the limit to 5,000 req/hr.
 */

import type {
  GitHubRepository,
  GitHubCommitListItem,
  GitHubCommitDetail,
} from "@/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GITHUB_API_BASE = "https://api.github.com";

/**
 * Identifies this application to GitHub per their API requirements.
 * https://docs.github.com/en/rest/using-the-rest-api/getting-started-with-the-rest-api#user-agent
 */
const USER_AGENT = "repopulse-lite/1.0 (https://github.com/SanjayShrish788/repopulse-lite)";

/** Request timeout in milliseconds. Avoids hanging the analysis pipeline. */
const REQUEST_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Builds the standard headers for every GitHub REST API request.
 * Adds Authorization only when GITHUB_TOKEN is present in the environment;
 * never throws or logs the token value.
 */
function buildHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": USER_AGENT,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Performs a fetch with a timeout and consistent error handling.
 *
 * Error taxonomy:
 *   - Network / AbortError                        → GitHubNetworkError
 *   - HTTP 401                                    → GitHubAuthError (token problem)
 *   - HTTP 403 + X-RateLimit-Remaining: 0         → GitHubRateLimitError (secondary rate limit)
 *   - HTTP 403 (other)                            → GitHubAuthError (forbidden / scope issue)
 *   - HTTP 404                                    → GitHubNotFoundError (repo not found / private)
 *   - HTTP 429                                    → GitHubRateLimitError (primary rate limit)
 *   - HTTP 5xx                                    → GitHubServerError (GitHub-side problem)
 *   - Other non-2xx                               → GitHubApiError (generic)
 *
 * Secrets are never included in thrown error messages.
 *
 * @param url - Full GitHub API URL.
 * @returns Parsed JSON body of the successful response.
 */
async function githubFetch<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(url, {
      headers: buildHeaders(),
      signal: controller.signal,
      // Opt out of Next.js server-side caching — analysis results must always
      // reflect the current state of the repository.
      cache: "no-store",
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new GitHubNetworkError(
        `GitHub API request timed out after ${REQUEST_TIMEOUT_MS}ms.`
      );
    }
    // Do not include the original error message — it may contain the URL
    // with embedded secrets in query params in future usage.
    throw new GitHubNetworkError("GitHub API request failed due to a network error.");
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.ok) {
    return response.json() as Promise<T>;
  }

  // --- HTTP error handling ---

  if (response.status === 401) {
    throw new GitHubAuthError(
      "GitHub API returned 401. Check GITHUB_TOKEN if set."
    );
  }

  if (response.status === 403) {
    // GitHub uses HTTP 403 for both auth failures and secondary rate limits.
    // Distinguish them via X-RateLimit-Remaining before classifying.
    if (response.headers.get("X-RateLimit-Remaining") === "0") {
      const resetAt = response.headers.get("X-RateLimit-Reset");
      const retryMsg = resetAt
        ? ` Rate limit resets at ${new Date(Number(resetAt) * 1000).toISOString()}.`
        : "";
      throw new GitHubRateLimitError(`GitHub API rate limit exceeded (HTTP 403).${retryMsg}`);
    }
    throw new GitHubAuthError(
      "GitHub API returned 403. Check GITHUB_TOKEN scope or repository access."
    );
  }

  if (response.status === 404) {
    throw new GitHubNotFoundError(
      `Repository not found or is private (HTTP 404).`
    );
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    const resetAt = response.headers.get("X-RateLimit-Reset");
    const retryMsg = retryAfter
      ? ` Retry after ${retryAfter} seconds.`
      : resetAt
      ? ` Rate limit resets at ${new Date(Number(resetAt) * 1000).toISOString()}.`
      : "";
    throw new GitHubRateLimitError(`GitHub API rate limit exceeded.${retryMsg}`);
  }

  if (response.status >= 500) {
    throw new GitHubServerError(
      `GitHub API server error (HTTP ${response.status}).`
    );
  }

  throw new GitHubApiError(
    `GitHub API returned unexpected status ${response.status}.`
  );
}

// ---------------------------------------------------------------------------
// Typed error classes
// ---------------------------------------------------------------------------

/** Base class for all GitHub service errors. */
export class GitHubApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubApiError";
  }
}

/** Thrown when a network request fails or times out. */
export class GitHubNetworkError extends GitHubApiError {
  constructor(message: string) {
    super(message);
    this.name = "GitHubNetworkError";
  }
}

/** Thrown on HTTP 401/403 — bad or missing token. */
export class GitHubAuthError extends GitHubApiError {
  constructor(message: string) {
    super(message);
    this.name = "GitHubAuthError";
  }
}

/** Thrown on HTTP 404 — repository does not exist or is private. */
export class GitHubNotFoundError extends GitHubApiError {
  constructor(message: string) {
    super(message);
    this.name = "GitHubNotFoundError";
  }
}

/** Thrown on HTTP 429 — API rate limit exceeded. */
export class GitHubRateLimitError extends GitHubApiError {
  constructor(message: string) {
    super(message);
    this.name = "GitHubRateLimitError";
  }
}

/** Thrown on HTTP 5xx — GitHub-side server error. */
export class GitHubServerError extends GitHubApiError {
  constructor(message: string) {
    super(message);
    this.name = "GitHubServerError";
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches repository metadata from the GitHub REST API.
 *
 * Endpoint: GET /repos/{owner}/{repo}
 * Docs: https://docs.github.com/en/rest/repos/repos#get-a-repository
 *
 * @param owner - Repository owner (user or organization).
 * @param repo  - Repository name.
 * @returns Typed {@link GitHubRepository} object.
 *
 * @throws {GitHubNotFoundError}   Repository not found or is private.
 * @throws {GitHubRateLimitError}  API rate limit exceeded.
 * @throws {GitHubAuthError}       Token is invalid or missing required scope.
 * @throws {GitHubServerError}     GitHub returned a 5xx response.
 * @throws {GitHubNetworkError}    Request timed out or failed at the network layer.
 */
export async function fetchRepository(
  owner: string,
  repo: string
): Promise<GitHubRepository> {
  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  return githubFetch<GitHubRepository>(url);
}

/**
 * Fetches recent commits for the given repository.
 *
 * Endpoint: GET /repos/{owner}/{repo}/commits
 * Docs: https://docs.github.com/en/rest/commits/commits#list-commits
 *
 * The branch is passed via the `sha` query parameter, which GitHub accepts as
 * either a branch name, tag name, or full commit SHA. Using `sha` (rather than
 * `ref`) is the documented approach for selecting the branch on this endpoint.
 *
 * perPage is clamped to [1, 100] — GitHub's hard maximum for a single page.
 * The initial analysis requests 30 commits; pagination is not implemented.
 *
 * @param owner   - Repository owner (user or organization).
 * @param repo    - Repository name.
 * @param branch  - Branch name to retrieve commits from (e.g. "main").
 * @param perPage - Number of commits to retrieve. Clamped to [1, 100].
 * @returns Array of {@link GitHubCommitListItem} objects, newest first.
 *
 * @throws {GitHubNotFoundError}   Repository or branch not found.
 * @throws {GitHubRateLimitError}  API rate limit exceeded.
 * @throws {GitHubAuthError}       Token is invalid or missing required scope.
 * @throws {GitHubServerError}     GitHub returned a 5xx response.
 * @throws {GitHubNetworkError}    Request timed out or failed at the network layer.
 * @throws {GitHubApiError}        Response shape is not a non-empty array.
 */
export async function fetchCommitList(
  owner: string,
  repo: string,
  branch: string,
  perPage = 30
): Promise<GitHubCommitListItem[]> {
  // Clamp perPage: GitHub's API enforces a maximum of 100 per page.
  const safePerPage = Math.min(Math.max(perPage, 1), 100);

  const params = new URLSearchParams({
    sha: branch,
    per_page: String(safePerPage),
  });

  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?${params.toString()}`;

  const data = await githubFetch<unknown>(url);

  // Structural validation: GitHub must return an array for a valid branch/repo.
  // A non-array response (e.g. a JSON error object that slipped past HTTP error
  // handling) would corrupt downstream normalization silently without this check.
  if (!Array.isArray(data)) {
    throw new GitHubApiError(
      "GitHub commits endpoint returned an unexpected response shape (expected an array)."
    );
  }

  return data as GitHubCommitListItem[];
}

/**
 * Fetches detailed commit information including file-level change stats.
 *
 * Endpoint: GET /repos/{owner}/{repo}/commits/{sha}
 * Docs: https://docs.github.com/en/rest/commits/commits#get-a-commit
 *
 * The commit SHA is passed as a URL path component encoded with
 * encodeURIComponent. A valid Git SHA is 40 hex characters and contains no
 * characters that require encoding, but encoding is applied unconditionally for
 * consistency with the other path components and to guard against future callers
 * passing abbreviated SHAs or non-standard refs.
 *
 * GitHub omits the `stats` object for commits that touch more than 3,000 files,
 * and the `files` array may be absent or empty on certain merge commits. Both
 * cases are treated as an unrecoverable validation failure: the normalizer
 * requires real numeric values and must not receive invented defaults.
 *
 * @param owner - Repository owner (user or organization).
 * @param repo  - Repository name.
 * @param sha   - Full 40-character commit SHA.
 * @returns Typed {@link GitHubCommitDetail} object.
 *
 * @throws {GitHubNotFoundError}   Commit SHA not found in the repository.
 * @throws {GitHubRateLimitError}  API rate limit exceeded.
 * @throws {GitHubAuthError}       Token is invalid or missing required scope.
 * @throws {GitHubServerError}     GitHub returned a 5xx response.
 * @throws {GitHubNetworkError}    Request timed out or failed at the network layer.
 * @throws {GitHubApiError}        Response is missing required stats or files fields.
 */
export async function fetchCommitDetail(
  owner: string,
  repo: string,
  sha: string
): Promise<GitHubCommitDetail> {
  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(sha)}`;

  const data = await githubFetch<unknown>(url);

  // The response must be a plain object — not an array, null, or primitive.
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new GitHubApiError(
      `GitHub commit detail endpoint returned an unexpected response shape for SHA ${sha}.`
    );
  }

  const raw = data as Record<string, unknown>;

  // Validate `stats` — GitHub omits this object for oversized commits (>3,000
  // files). Without real stats we cannot compute additions/deletions/total, so
  // we refuse to return a partially populated object.
  if (
    typeof raw["stats"] !== "object" ||
    raw["stats"] === null ||
    typeof (raw["stats"] as Record<string, unknown>)["additions"] !== "number" ||
    typeof (raw["stats"] as Record<string, unknown>)["deletions"] !== "number" ||
    typeof (raw["stats"] as Record<string, unknown>)["total"] !== "number"
  ) {
    throw new GitHubApiError(
      `GitHub commit detail for SHA ${sha} is missing required stats (additions/deletions/total). ` +
      "This can happen for commits that touch more than 3,000 files."
    );
  }

  // Validate `files` — must be an array (may be empty for root merge commits).
  if (!Array.isArray(raw["files"])) {
    throw new GitHubApiError(
      `GitHub commit detail for SHA ${sha} is missing the required files array.`
    );
  }

  return data as GitHubCommitDetail;
}
