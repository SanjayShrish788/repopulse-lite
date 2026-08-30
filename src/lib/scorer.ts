/**
 * Deterministic Heuristic Engine — calculates the Repository Health Score.
 *
 * SPEC.md section 5: The engine consumes normalized telemetry and produces a
 * composite 0–100 score across five dimensions:
 *
 *   - Code Churn        (weight: 25%)  ← implemented
 *   - Commit Hygiene    (weight: 20%)  ← implemented
 *   - Commit Cadence    (weight: 20%)  ← implemented
 *   - Author Entropy    (weight: 15%)  ← implemented
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
// §5.6 Commit Cadence / Velocity Score (weight: 20%)
// ---------------------------------------------------------------------------

/** Returns the median of a non-empty sorted (or unsorted) number array. */
function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Population standard deviation (÷ N).
 *
 * The task specification explicitly requires population std dev because the
 * gaps array is the complete observed population for the analysis window,
 * not a sample drawn from a larger dataset.
 *
 * (Note: SPEC.md §5.6.3 says "sample standard deviation"; the task
 * requirement overrides this to population std dev, divide by N.)
 */
function populationStdDev(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Computes the activity concentration score (§5.6.4).
 *
 * Measures whether commits are evenly spread across the total time window
 * or concentrated in a short burst. Uses the middle 50% of the chronologically
 * sorted commit sequence (indices floor(N/4) … floor(3N/4)).
 *
 * @param sortedTimestampsAsc - Commit timestamps in ascending order (seconds).
 * @returns activityConcentration ∈ [0, 1].
 */
function computeActivityConcentration(sortedTimestampsAsc: number[]): number {
  const N = sortedTimestampsAsc.length;
  const windowSeconds =
    sortedTimestampsAsc[N - 1] - sortedTimestampsAsc[0];

  // Zero-width window: all commits at the same instant — maximum burst,
  // minimum spread. Spec says activityConcentration = 0.0.
  if (windowSeconds === 0) return 0.0;

  const loIdx = Math.floor(N / 4);
  const hiIdx = Math.floor((3 * N) / 4);

  // innerWindow: time spanned by the middle 50% of the commit sequence.
  // When loIdx === hiIdx (e.g. N = 1 or 2), innerWindow = 0, which correctly
  // reflects that no spread can be measured within a single-point middle group.
  const innerWindow =
    sortedTimestampsAsc[hiIdx] - sortedTimestampsAsc[loIdx];

  return clamp(innerWindow / windowSeconds, 0, 1);
}

/**
 * Scores the Commit Cadence / Velocity dimension for the supplied commits.
 *
 * Implements SPEC.md §5.6 exactly.
 *
 * Sub-scores:
 *   velocity             (× 0.50) — median inter-commit gap vs. 7-day ceiling
 *   regularity           (× 0.30) — CV of gaps; low CV = high regularity
 *   activityConcentration (× 0.20) — middle-50% spread vs. total window
 *
 * N < 2 handling:
 *   The spec (SPEC.md §5.6.1) explicitly mandates: "If N < 2, cadence cannot
 *   be computed. Set cadenceScore = 50 (neutral)."
 *   50 is returned as the neutral score — it is spec-mandated, not invented.
 *
 * All gap calculations are done in seconds (milliseconds ÷ 1000) to match the
 * SPEC formulas. The original commits array is not mutated; a sorted copy is
 * used throughout.
 *
 * @param commits - Normalized commits from the analysis window (up to 30).
 * @returns A {@link DimensionScore} with name, score ∈ [0, 100], and weight 0.20.
 */
export function scoreCommitCadence(commits: NormalizedCommit[]): DimensionScore {
  const N = commits.length;

  // §5.6.1 — Insufficient data guard (spec-mandated neutral score)
  if (N < 2) {
    return { name: "Commit Cadence", score: 50, weight: 0.20 };
  }

  // Sort chronologically ascending (oldest first) without mutating the input.
  const sorted = [...commits].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  // Compute N−1 consecutive inter-commit gaps in seconds.
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const diffMs = sorted[i].date.getTime() - sorted[i - 1].date.getTime();
    gaps.push(diffMs / 1000); // convert to seconds
  }

  // §5.6.2 — Commit Velocity
  // velocity = clamp(1 − (medianGap / 604800), 0, 1)
  // 604800 s = 7 days — the zero-score ceiling for the median gap.
  const medianGap = medianOf(gaps);
  const velocity = clamp(1 - medianGap / 604800, 0, 1);

  // §5.6.3 — Inter-Commit Regularity (Coefficient of Variation)
  // regularity = clamp(1 − (CV / 2), 0, 1)
  // CV = stdGap / meanGap  (population std dev, per task requirement)
  // If meanGap = 0 (all commits at the same instant), CV = 0 → regularity = 1.
  const meanGap = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
  const stdGap = populationStdDev(gaps, meanGap);
  const CV = meanGap === 0 ? 0 : stdGap / meanGap;
  const regularity = clamp(1 - CV / 2, 0, 1);

  // §5.6.4 — Activity Concentration
  const timestampsAsc = sorted.map((c) => c.date.getTime() / 1000);
  const activityConcentration = computeActivityConcentration(timestampsAsc);

  // §5.6.5 — Composite Cadence Score
  const cadenceScore = Math.round(
    (velocity * 0.50 + regularity * 0.30 + activityConcentration * 0.20) * 100
  );

  return {
    name: "Commit Cadence",
    score: clamp(cadenceScore, 0, 100),
    weight: 0.20,
  };
}

// ---------------------------------------------------------------------------
// §5.7 Author Entropy Score (weight: 15%)
// ---------------------------------------------------------------------------

/**
 * Scores the Author Entropy dimension for the supplied commits.
 *
 * Implements SPEC.md §5.7 exactly using normalized Shannon entropy (base-2).
 *
 * Author identity:
 *   authorEmail is used as the unique author key, not authorName.
 *   Names are mutable (display name changes, multiple spellings) while email
 *   addresses are a stable, de-duplicatable identity within a commit history.
 *
 * Entropy and normalization:
 *   1. Count commits per author (by email) to get c_k for each author k.
 *   2. Compute the commit share:  p_k = c_k / N
 *   3. Raw Shannon entropy:       H = -Σ(p_k × log₂(p_k))
 *   4. Maximum entropy:           maxEntropy = log₂(K)   (uniform distribution)
 *   5. Normalized:                normalizedEntropy = H / maxEntropy
 *   6. Score:                     round(normalizedEntropy × 100)
 *
 * Edge cases (all follow SPEC §5.7 exactly):
 *   N = 0 — no commits, no authors. Returns score 0 (no data).
 *   K = 1 — single author. SPEC §5.7.2 sets rawEntropy = 0;
 *            SPEC §5.7.3 guards maxEntropy = log₂(1) = 0 → normalizedEntropy = 0.
 *            Score = 0 (maximum bus-factor risk).
 *   K ≥ 2 — normal path; both guards pass, entropy is meaningful.
 *
 * @param commits - Normalized commits from the analysis window (up to 30).
 * @returns A {@link DimensionScore} with name, score ∈ [0, 100], and weight 0.15.
 */
export function scoreAuthorEntropy(commits: NormalizedCommit[]): DimensionScore {
  const N = commits.length;

  // N = 0: no commits, no distribution to compute.
  if (N === 0) {
    return { name: "Author Entropy", score: 0, weight: 0.15 };
  }

  // §5.7.1 — Commit share per author (keyed by authorEmail)
  const commitsByAuthor = new Map<string, number>();
  for (const commit of commits) {
    const prev = commitsByAuthor.get(commit.authorEmail) ?? 0;
    commitsByAuthor.set(commit.authorEmail, prev + 1);
  }

  const K = commitsByAuthor.size; // number of distinct authors

  // §5.7.2 — Shannon entropy
  // Special case: H = 1 → rawEntropy = 0 (spec mandated).
  let rawEntropy = 0;
  if (K > 1) {
    for (const count of commitsByAuthor.values()) {
      const p = count / N;
      // p ≥ 1/N > 0, so log2(p) is always finite here; no log(0) risk.
      rawEntropy -= p * Math.log2(p);
    }
  }

  // §5.7.3 — Normalized entropy
  // maxEntropy = log₂(K); when K = 1, log₂(1) = 0 → guard returns 0.
  const maxEntropy = Math.log2(K);
  const normalizedEntropy = maxEntropy === 0 ? 0 : rawEntropy / maxEntropy;

  // §5.7.4 — Composite entropy score
  const entropyScore = Math.round(normalizedEntropy * 100);

  return {
    name: "Author Entropy",
    score: clamp(entropyScore, 0, 100),
    weight: 0.15,
  };
}

// ---------------------------------------------------------------------------
// Public API — full pipeline (not yet complete)
// ---------------------------------------------------------------------------

/**
 * Runs the full heuristic scoring pipeline over normalized telemetry.
 *
 * NOT YET IMPLEMENTED — requires all five dimensions.
 * scoreCodeChurn(), scoreCommitHygiene(), scoreCommitCadence(), and
 * scoreAuthorEntropy() are available as standalone functions in the interim.
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
