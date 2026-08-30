/**
 * LLM service — generates an executive risk report from the scoring output.
 *
 * SPEC.md section 3 (AI):
 *   - OpenAI-compatible LLM API
 *   - Configurable API base URL  → OPENAI_BASE_URL env var
 *                                   (default: https://api.openai.com/v1)
 *   - Configurable model name    → OPENAI_MODEL env var
 *                                   (default: gpt-4o)
 *   - API key                    → OPENAI_API_KEY env var (required)
 *
 * The LLM interprets the deterministic scoring results and produces a
 * human-readable executive risk report. It does NOT perform scoring.
 * All numerical scores are computed by the deterministic heuristic engine
 * (src/lib/scorer.ts) and are supplied to the model as authoritative facts.
 */

import type { ScoringResult } from "@/types";

// ---------------------------------------------------------------------------
// Configuration defaults (documented in .env.example)
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o";

// ---------------------------------------------------------------------------
// Prompt templates
// ---------------------------------------------------------------------------

/**
 * System message sent to the model.
 *
 * Explicitly prohibits the model from recalculating scores or inventing data.
 * Frames the model strictly as an interpreter of provided authoritative scores.
 */
const SYSTEM_MESSAGE = `\
You are an expert software engineering analyst. Your task is to write a concise, \
executive-level risk report for a GitHub repository based on its health analysis results.

Rules you must follow without exception:
- The health score and all dimension scores supplied to you are AUTHORITATIVE. \
Do not recalculate, adjust, or contradict them.
- Do not invent or assume any facts, metrics, or telemetry not present in the data provided.
- Do not perform mathematical calculations. Only interpret the numbers given.
- Write in clear, professional English suitable for a non-technical executive audience.
- Format the report in Markdown with concise sections.
- Keep the entire report under 500 words.`;

/**
 * Constructs the user message from the repository name and scoring result.
 *
 * All numerical values come exclusively from the authoritative ScoringResult;
 * none are calculated or modified here.
 */
function buildUserMessage(repoFullName: string, scoring: ScoringResult): string {
  const { healthScore, dimensions } = scoring;

  const dimLines = [
    `- Code Churn:          ${dimensions.codeChurn.score}/100 (weight: ${Math.round(dimensions.codeChurn.weight * 100)}%)`,
    `- Commit Hygiene:      ${dimensions.commitHygiene.score}/100 (weight: ${Math.round(dimensions.commitHygiene.weight * 100)}%)`,
    `- Commit Cadence:      ${dimensions.commitCadence.score}/100 (weight: ${Math.round(dimensions.commitCadence.weight * 100)}%)`,
    `- Author Entropy:      ${dimensions.authorEntropy.score}/100 (weight: ${Math.round(dimensions.authorEntropy.weight * 100)}%)`,
    `- Anomaly Detection:   ${dimensions.anomalyDetection.score}/100 (weight: ${Math.round(dimensions.anomalyDetection.weight * 100)}%)`,
  ].join("\n");

  return `\
Produce an executive risk report for the GitHub repository: ${repoFullName}

AUTHORITATIVE HEALTH ANALYSIS RESULTS (do not recalculate or modify these values):

Overall Health Score: ${healthScore}/100

Dimension scores:
${dimLines}

Using ONLY the information above, write the executive risk report. Include:
1. A brief summary of the overall health score and what it signals.
2. The strongest dimension(s) and why they are positive.
3. The weakest dimension(s) and the risks they indicate.
4. Two or three concrete, actionable recommendations.

Do not mention any scores, data, or repository characteristics that are not present above.`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates an executive risk report using an OpenAI-compatible LLM.
 *
 * Configuration (from environment variables, documented in .env.example):
 *   OPENAI_API_KEY   — required; the API key. Never logged or forwarded to clients.
 *   OPENAI_BASE_URL  — optional; defaults to https://api.openai.com/v1
 *   OPENAI_MODEL     — optional; defaults to gpt-4o
 *
 * Endpoint construction:
 *   The chat completion endpoint is:
 *     <OPENAI_BASE_URL with trailing slash removed>/chat/completions
 *   This follows the standard OpenAI API path and is compatible with any
 *   OpenAI-compatible provider (Azure OpenAI, Ollama, Anthropic via proxy, etc.)
 *   that uses the same convention.
 *
 * @param repoFullName - Full repository name (owner/repo).
 * @param scoring      - Deterministic scoring result from the heuristic engine.
 * @returns A markdown-formatted executive risk report string.
 *
 * @throws {Error} If required environment variables are missing.
 * @throws {Error} If the LLM API returns a non-2xx response.
 * @throws {Error} If the model response content is empty or missing.
 */
export async function generateReport(
  repoFullName: string,
  scoring: ScoringResult
): Promise<string> {
  // -------------------------------------------------------------------------
  // Step 1 — Read and validate configuration
  // -------------------------------------------------------------------------

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "LLM configuration error: OPENAI_API_KEY is not set. " +
      "Set it in .env.local to enable report generation."
    );
  }

  // Apply defaults for optional variables (documented in .env.example).
  const rawBaseUrl = process.env.OPENAI_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;

  // Strip trailing slash so the endpoint path can always be appended cleanly.
  const baseUrl = rawBaseUrl.replace(/\/+$/, "");
  const endpoint = `${baseUrl}/chat/completions`;

  // -------------------------------------------------------------------------
  // Step 2 — Build the chat completion request
  // -------------------------------------------------------------------------

  const requestBody = {
    model,
    messages: [
      { role: "system", content: SYSTEM_MESSAGE },
      { role: "user", content: buildUserMessage(repoFullName, scoring) },
    ],
    // Temperature 0.3: low enough for consistent, professional executive prose;
    // not zero, which can produce formulaic repetition across analyses.
    temperature: 0.3,
    // Generous upper bound for the report; the prompt asks for ≤500 words.
    max_tokens: 1024,
  };

  // -------------------------------------------------------------------------
  // Step 3 — Call the LLM API
  // -------------------------------------------------------------------------

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // API key is sent only as a header and is never reflected in error messages.
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });
  } catch {
    // Network-level failure. Do not include the endpoint URL (it may reflect
    // internal infrastructure); a generic message is sufficient.
    throw new Error("LLM request failed due to a network error.");
  }

  // -------------------------------------------------------------------------
  // Step 4 — Validate the HTTP response
  // -------------------------------------------------------------------------

  if (!response.ok) {
    // Do not forward the raw response body — it may contain internal provider
    // details. Surface the HTTP status only.
    throw new Error(
      `LLM API returned an error (HTTP ${response.status}). ` +
      "Check OPENAI_API_KEY, OPENAI_BASE_URL, and OPENAI_MODEL configuration."
    );
  }

  // -------------------------------------------------------------------------
  // Step 5 — Extract and validate the assistant message content
  // -------------------------------------------------------------------------

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error("LLM API returned a response that could not be parsed as JSON.");
  }

  // Navigate the standard OpenAI chat completion response shape:
  //   { choices: [{ message: { role: "assistant", content: string } }] }
  const content =
    typeof data === "object" &&
    data !== null &&
    "choices" in data &&
    Array.isArray((data as Record<string, unknown>)["choices"]) &&
    (data as { choices: unknown[] }).choices.length > 0 &&
    typeof (data as { choices: unknown[] }).choices[0] === "object" &&
    (data as { choices: unknown[] }).choices[0] !== null &&
    "message" in ((data as { choices: unknown[] }).choices[0] as object) &&
    typeof (
      (data as { choices: { message: unknown }[] }).choices[0].message
    ) === "object" &&
    (data as { choices: { message: unknown }[] }).choices[0].message !== null &&
    "content" in (
      (data as { choices: { message: unknown }[] }).choices[0].message as object
    )
      ? (
          data as {
            choices: { message: { content: unknown } }[];
          }
        ).choices[0].message.content
      : undefined;

  if (typeof content !== "string" || content.trim() === "") {
    throw new Error(
      "LLM API returned a successful response but the report content was empty or missing."
    );
  }

  return content.trim();
}
