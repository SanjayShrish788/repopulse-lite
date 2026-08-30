import { NextRequest, NextResponse } from "next/server";

import { validateRepoUrl } from "@/lib/validateUrl";
import {
  fetchRepository,
  fetchCommitList,
  fetchCommitDetail,
  GitHubNotFoundError,
  GitHubAuthError,
  GitHubRateLimitError,
  GitHubServerError,
  GitHubNetworkError,
} from "@/services/github";
import { normalizeTelemetry, NormalizationError } from "@/lib/normalizer";
import { scoreRepository } from "@/lib/scorer";
import { generateReport } from "@/services/llm";
import type { AnalysisResult, AnalysisError } from "@/types";

// ---------------------------------------------------------------------------
// POST /api/analyze
// ---------------------------------------------------------------------------

/**
 * POST /api/analyze
 *
 * Accepts a JSON body: { repoUrl: string }
 *
 * Orchestrates the full analysis pipeline:
 *   1. Parse and validate request body
 *   2. Validate GitHub repository URL → owner + repo
 *   3. Fetch repository metadata from GitHub API
 *   4. Fetch the 30 most recent commits (list)
 *   5. Fetch per-commit detail for all 30 commits (parallel)
 *   6. Normalize raw GitHub data → RepositoryTelemetry
 *   7. Run deterministic scoring engine → ScoringResult
 *   8. Generate executive risk report via LLM → string
 *   9. Return AnalysisResult
 *
 * Error responses follow the AnalysisError type: { error, code? }
 */
export async function POST(request: NextRequest): Promise<NextResponse<AnalysisResult | AnalysisError>> {
  // -------------------------------------------------------------------------
  // Step 1 — Parse request body
  // -------------------------------------------------------------------------

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<AnalysisError>(
      { error: "Request body is not valid JSON.", code: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("repoUrl" in body) ||
    typeof (body as Record<string, unknown>)["repoUrl"] !== "string"
  ) {
    return NextResponse.json<AnalysisError>(
      {
        error: 'Request body must contain a "repoUrl" string field.',
        code: "INVALID_REQUEST",
      },
      { status: 400 }
    );
  }

  const repoUrl = (body as { repoUrl: string }).repoUrl;

  // -------------------------------------------------------------------------
  // Step 2 — Validate GitHub repository URL
  // -------------------------------------------------------------------------

  const validation = validateRepoUrl(repoUrl);

  if (!validation.valid) {
    return NextResponse.json<AnalysisError>(
      { error: validation.error, code: "INVALID_URL" },
      { status: 400 }
    );
  }

  // Discriminated union narrowed — validation.parsed is now available.
  const { owner, repo } = validation.parsed;

  // -------------------------------------------------------------------------
  // Steps 3–8 — GitHub API + normalization + scoring + LLM report (all errors caught below)
  // -------------------------------------------------------------------------

  try {
    // Step 3 — Fetch repository metadata
    const repository = await fetchRepository(owner, repo);

    // Step 4 — Fetch the most recent 30 commits (list items contain SHA only;
    // additions/deletions/files require a separate detail request per commit).
    const commitList = await fetchCommitList(
      owner,
      repo,
      repository.default_branch,
      30
    );

    // Step 5 — Fetch per-commit detail in parallel.
    // The requests are independent so Promise.all is appropriate. With 30
    // commits this is 30 parallel GitHub API requests, well within the
    // authenticated limit (5,000 req/hr) and the unauthenticated limit
    // (60 req/hr — the full analysis consumes ≤32 requests).
    const commitDetails = await Promise.all(
      commitList.map((item) => fetchCommitDetail(owner, repo, item.sha))
    );

    // Step 6 — Normalize raw GitHub data into the internal telemetry model.
    const telemetry = normalizeTelemetry(repository, commitDetails);

    // Step 7 — Run the deterministic scoring engine.
    const scoring = scoreRepository(telemetry);

    // Step 8 — Generate the executive risk report via the LLM service.
    // generateReport() throws on missing config, API errors, or empty responses.
    // Any such error propagates to the catch block below, which returns
    // HTTP 500 / INTERNAL_ERROR without exposing API keys or provider details.
    const report = await generateReport(repository.full_name, scoring);

    // -----------------------------------------------------------------------
    // Success — return AnalysisResult
    // -----------------------------------------------------------------------

    const result: AnalysisResult = {
      repoFullName: repository.full_name,
      scoring,
      report,
      analyzedAt: new Date().toISOString(),
    };

    return NextResponse.json<AnalysisResult>(result, { status: 200 });

  } catch (err) {
    // -----------------------------------------------------------------------
    // Error taxonomy — map known error classes to HTTP status codes.
    // Error messages are preserved (they contain no secrets; github.ts ensures
    // that tokens are never embedded in error messages).
    // Stack traces are never forwarded to the client.
    // -----------------------------------------------------------------------

    if (err instanceof GitHubNotFoundError) {
      return NextResponse.json<AnalysisError>(
        { error: err.message, code: "REPO_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (err instanceof GitHubAuthError) {
      return NextResponse.json<AnalysisError>(
        { error: err.message, code: "AUTH_ERROR" },
        { status: 401 }
      );
    }

    if (err instanceof GitHubRateLimitError) {
      return NextResponse.json<AnalysisError>(
        { error: err.message, code: "RATE_LIMIT" },
        { status: 429 }
      );
    }

    if (err instanceof GitHubServerError) {
      return NextResponse.json<AnalysisError>(
        { error: err.message, code: "GITHUB_ERROR" },
        { status: 502 }
      );
    }

    if (err instanceof GitHubNetworkError) {
      return NextResponse.json<AnalysisError>(
        { error: err.message, code: "NETWORK_ERROR" },
        { status: 504 }
      );
    }

    if (err instanceof NormalizationError) {
      return NextResponse.json<AnalysisError>(
        { error: err.message, code: "NORMALIZATION_ERROR" },
        { status: 422 }
      );
    }

    // Unknown error — do not expose internal details.
    return NextResponse.json<AnalysisError>(
      {
        error: "An unexpected internal error occurred.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
