/**
 * LLM service — generates an executive risk report from the scoring output.
 *
 * SPEC.md section 3 (AI):
 *   - OpenAI-compatible LLM API
 *   - Configurable API base URL  → OPENAI_BASE_URL env var
 *   - Configurable model name    → OPENAI_MODEL env var
 *   - API key                    → OPENAI_API_KEY env var
 *
 * The LLM interprets the deterministic scoring results and produces a
 * human-readable executive risk report. It does NOT perform scoring.
 */

import type { ScoringResult } from "@/types";

/**
 * Generates an executive risk report using an OpenAI-compatible LLM.
 *
 * @param repoFullName - Full repository name (owner/repo).
 * @param scoring      - Deterministic scoring result from the heuristic engine.
 * @returns A markdown-formatted executive risk report string.
 */
export async function generateReport(
  repoFullName: string,
  scoring: ScoringResult
): Promise<string> {
  // TODO: implement LLM integration
  void repoFullName;
  void scoring;
  throw new Error("Not implemented");
}
