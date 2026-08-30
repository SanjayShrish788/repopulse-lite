/**
 * GitHub repository URL validation utilities.
 *
 * Safely parses and validates a GitHub repository URL, extracting the
 * owner and repository name without making any network calls.
 *
 * SPEC.md section 4: URL Validation is the first step in the analysis pipeline.
 */

/** Result of a successful URL parse. */
export interface ParsedRepoUrl {
  owner: string;
  repo: string;
  /** Canonical form: https://github.com/{owner}/{repo} */
  canonical: string;
}

/** Result of URL validation. */
export type UrlValidationResult =
  | { valid: true; parsed: ParsedRepoUrl }
  | { valid: false; error: string };

/**
 * Validates and parses a GitHub repository URL.
 *
 * Accepts URLs in these forms:
 *   - https://github.com/owner/repo
 *   - https://github.com/owner/repo/
 *   - https://github.com/owner/repo.git
 *
 * Rejects:
 *   - Non-HTTPS URLs (http://, git://, ssh://, etc.)
 *   - Non-GitHub hosts (gitlab.com, bitbucket.org, etc.)
 *   - Paths with fewer than 2 segments (missing owner or repo)
 *   - Paths with more than 2 non-empty segments (subdirectories, tree refs, etc.)
 *   - Query strings (?foo=bar)
 *   - Fragments (#section)
 *   - Empty owner or repository name after stripping .git
 *   - Malformed strings that cannot be parsed as a URL
 *
 * @param input - Raw URL string provided by the user.
 * @returns A {@link UrlValidationResult} indicating success or failure.
 */
export function validateRepoUrl(input: string): UrlValidationResult {
  const trimmed = input.trim();

  // Step 1 — Parse the URL; catch malformed input without throwing.
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: "Invalid URL: could not be parsed." };
  }

  // Step 2 — Protocol must be HTTPS. The URL constructor lowercases the protocol.
  if (parsed.protocol !== "https:") {
    return {
      valid: false,
      error: `Invalid URL: only HTTPS URLs are accepted (got "${parsed.protocol.replace(":", "://")}"…).`,
    };
  }

  // Step 3 — Host must be exactly github.com. The URL constructor already
  // lowercases the hostname, so a case-insensitive comparison is redundant but
  // we compare against the already-lowercased value for clarity.
  if (parsed.hostname !== "github.com") {
    return {
      valid: false,
      error: `Invalid URL: only github.com repositories are supported (got "${parsed.hostname}").`,
    };
  }

  // Step 4 — Reject query strings and fragments.
  // These never form part of a valid repository URL and indicate either a
  // deep-link (e.g. ?tab=readme-ov-file) or a copy-paste from a browser.
  if (parsed.search) {
    return {
      valid: false,
      error: "Invalid URL: query strings are not allowed in a repository URL.",
    };
  }
  if (parsed.hash) {
    return {
      valid: false,
      error: "Invalid URL: URL fragments are not allowed in a repository URL.",
    };
  }

  // Step 5 — Extract path segments.
  // parsed.pathname always starts with "/". Split, remove the leading empty
  // string, and drop a trailing empty string produced by a trailing slash.
  const rawSegments = parsed.pathname.split("/").slice(1);
  const segments =
    rawSegments[rawSegments.length - 1] === ""
      ? rawSegments.slice(0, -1)   // drop the trailing empty segment
      : rawSegments;

  // Exactly two non-empty segments required: [owner, repo].
  if (segments.length < 2) {
    return {
      valid: false,
      error: "Invalid URL: a repository URL must contain both an owner and a repository name.",
    };
  }
  if (segments.length > 2) {
    return {
      valid: false,
      error: "Invalid URL: URL contains extra path segments beyond /owner/repo.",
    };
  }

  const owner = segments[0];
  let repo = segments[1];

  // Step 6 — Strip the optional .git suffix.
  if (repo.endsWith(".git")) {
    repo = repo.slice(0, -4);
  }

  // Step 7 — Both owner and repo must be non-empty after stripping.
  if (!owner) {
    return { valid: false, error: "Invalid URL: repository owner is empty." };
  }
  if (!repo) {
    return {
      valid: false,
      error: "Invalid URL: repository name is empty after stripping .git suffix.",
    };
  }

  const canonical = `https://github.com/${owner}/${repo}`;

  return {
    valid: true,
    parsed: { owner, repo, canonical },
  };
}
