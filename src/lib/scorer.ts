/**
 * Deterministic Heuristic Engine — calculates the Repository Health Score.
 *
 * SPEC.md section 5: The engine consumes normalized telemetry and produces a
 * composite 0–100 score across five dimensions:
 *
 *   - Code Churn        (weight: 25%)  ← implemented
 *   - Commit Hygiene    (weight: 20%)  ← implemented
 *   - Commit Cadence    (weight: 20%)  ← not yet implemented
 *   - Author Entropy    (weight: 15%)  ← not yet implemented
 *   - Anomaly Detection (weight: 20%)  ← not yet implemented
 *
 * The LLM is NOT involved in scoring. The deterministic engine is the sole
 * source of truth for numerical output.
 *
 * Implementation strategy:
 *   Each dimension is implemented as a standalone exported function returning
 *   a DimensionScore. scoreRepository() will assemble them once all five are
 *   ready. Until then, scoreRepository() remains a stub so that no dimension
 *   is invented or approximated.
 */

import type {
  NormalizedCommit,
  RepositoryTelemetry,
  DimensionScore,
  ScoringResult,
} from "@/types";

// ---------------------------------------------------------------------------
// Shared utility
// ---------------------------------------------------------------------------

/**
 * Clamps a value to [min, max].
 * Used throughout the scoring engine to enforce [0, 1] bounds before scaling.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ---------------------------------------------------------------------------
// §5.4 Code Churn Score (weight: 25%)
// ---------------------------------------------------------------------------

/**
 * Scores the Code Churn dimension for the supplied commits.
 *
 * Implements SPEC.md §5.4 exactly. The composite is:
 *
 *   churnScore = round(
 *       (churnBalance × 0.40 + churnIntensity × 0.35 + churnConcentration × 0.25) × 100
 *   )
 *
 * @param commits - Normalized commits from the analysis window (up to 30).
 * @returns A {@link DimensionScore} with name, score ∈ [0, 100], and weight 0.25.
 */
export function scoreCodeChurn(commits: NormalizedCommit[]): DimensionScore {
  const N = commits.length;

  // §5.4.1 — Inputs
  // -----------------------------------------------------------------------

  const totalAdditions = commits.reduce((sum, c) => sum + c.additions, 0);
  const totalDeletions = commits.reduce((sum, c) => sum + c.deletions, 0);
  const totalChanges = totalAdditions + totalDeletions;

  // max files touched in any single commit; 0 when the window is empty
  const maxFilesInOne =
    N === 0 ? 0 : Math.max(...commits.map((c) => c.filesChanged));

  // average files touched per commit across the window
  const avgFilesPerCommit =
    N === 0 ? 0 : commits.reduce((sum, c) => sum + c.filesChanged, 0) / N;

  // §5.4.2 — Churn Balance
  // -----------------------------------------------------------------------
  // Measures proportionality between additions and deletions.
  //   totalChanges = 0  → perfectly clean window → balance = 1.0
  //   all adds/no dels  → entirely one-directional → balance = 0.0
  //   equal adds & dels → perfectly balanced → balance = 1.0

  let churnBalance: number;
  if (totalChanges === 0) {
    churnBalance = 1.0;
  } else {
    const minSide = Math.min(totalAdditions, totalDeletions);
    churnBalance = (2 * minSide) / totalChanges;
  }

  // §5.4.3 — Churn Intensity
  // -----------------------------------------------------------------------
  // Measures average commit size against a universal ceiling of 500 lines.
  //   avgLinesPerCommit = 0   → intensity = 1.0 (very small commits)
  //   avgLinesPerCommit = 500 → intensity = 0.0 (at the ceiling)
  //   avgLinesPerCommit > 500 → clamped to 0.0

  const avgLinesPerCommit = N === 0 ? 0 : totalChanges / N;
  const churnIntensity = clamp(1 - avgLinesPerCommit / 500, 0, 1);

  // §5.4.4 — Churn Concentration
  // -----------------------------------------------------------------------
  // Measures whether file changes are spread evenly or dominated by one commit.
  //   avgFilesPerCommit = 0   → nothing to compare → concentration = 1.0
  //   ratio = 1 (perfectly even) → concentration = 1.0
  //   ratio = 10 (worst is 10× the average) → concentration = 0.0
  //   ratio > 10 → clamped to 0.0

  let churnConcentration: number;
  if (avgFilesPerCommit === 0) {
    churnConcentration = 1.0;
  } else {
    const ratio = maxFilesInOne / avgFilesPerCommit;
    churnConcentration = clamp(1 - (ratio - 1) / 9, 0, 1);
  }

  // §5.4.5 — Composite Churn Score
  // -----------------------------------------------------------------------

  const churnScore = Math.round(
    (churnBalance * 0.40 + churnIntensity * 0.35 + churnConcentration * 0.25) *
      100
  );

  return {
    name: "Code Churn",
    score: clamp(churnScore, 0, 100), // guard against any floating-point edge
    weight: 0.25,
  };
}

// ---------------------------------------------------------------------------
// §5.5 Commit Hygiene Score (weight: 20%)
// ---------------------------------------------------------------------------

/**
 * Conventional Commits pattern (SPEC.md §5.5.1).
 *
 * Matches the first line of a commit message against:
 *   <type>[optional scope]: <description>
 *
 * Rules:
 *   - type       : one of the 11 allowed lowercase keywords
 *   - scope      : optional, wrapped in parentheses, one or more non-")" chars
 *   - ": "       : literal colon + single space (required by CC spec)
 *   - description: one or more characters (non-empty, enforced by ".+")
 *
 * Anchored with ^ and $ so the full first line must match; no partial matches.
 */
const CONVENTIONAL_COMMIT_RE =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([^)]+\))?: .+$/;

/**
 * Scores the Commit Hygiene dimension for the supplied commits.
 *
 * Implements SPEC.md §5.5 exactly.
 *
 * Per-commit scoring (first line of message only):
 *   - Matches Conventional Commit pattern → 1.0
 *   - Does not match, but first line ≥ 20 chars  → 0.5 (substantive free-form)
 *   - Otherwise                                   → 0.0 (trivial / empty)
 *
 * Composite:
 *   hygieneScore = round((Σ hygieneᵢ / N) × 100)
 *
 * N === 0 handling:
 *   An empty commit window means there is no hygiene data to evaluate.
 *   The function returns score 0 rather than a neutral 50, because an
 *   analysis with zero commits represents a genuinely unknown / empty
 *   repository state. Callers that receive 0 from every dimension will
 *   produce a 0 composite, which correctly signals "no data" rather than
 *   "average quality".
 *
 * @param commits - Normalized commits from the analysis window (up to 30).
 * @returns A {@link DimensionScore} with name, score ∈ [0, 100], and weight 0.20.
 */
export function scoreCommitHygiene(commits: NormalizedCommit[]): DimensionScore {
  const N = commits.length;

  if (N === 0) {
    return { name: "Commit Hygiene", score: 0, weight: 0.20 };
  }

  // §5.5.2 — Per-commit hygiene score
  let hygieneSum = 0;

  for (const commit of commits) {
    // Evaluate only the first line; ignore body and footer.
    const firstLine = commit.message.split("\n")[0];

    if (CONVENTIONAL_COMMIT_RE.test(firstLine)) {
      // Full credit: conventional commit
      hygieneSum += 1.0;
    } else if (firstLine.length >= 20) {
      // Partial credit: substantive free-form message
      hygieneSum += 0.5;
    }
    // else: 0.0 — trivial or empty message; nothing added
  }

  // §5.5.3 — Composite hygiene score
  const hygieneScore = Math.round((hygieneSum / N) * 100);

  return {
    name: "Commit Hygiene",
    score: clamp(hygieneScore, 0, 100),
    weight: 0.20,
  };
}

// ---------------------------------------------------------------------------
// Public API — full pipeline (not yet complete)
// ---------------------------------------------------------------------------

/**
 * Runs the full heuristic scoring pipeline over normalized telemetry.
 *
 * NOT YET IMPLEMENTED — requires all five dimensions.
 * scoreCodeChurn() is available as a standalone function in the interim.
 *
 * @param telemetry - Normalized repository telemetry.
 * @returns A {@link ScoringResult} containing the composite health score
 *          and all individual dimension scores.
 */
export function scoreRepository(
  telemetry: RepositoryTelemetry
): ScoringResult {
  // TODO: wire up all five dimension scorers and the weighted composite (§5.9)
  void telemetry;
  throw new Error("Not implemented");
}
