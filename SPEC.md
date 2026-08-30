# RepoPulse Lite — Technical Specification

## 1. Project Overview

RepoPulse Lite is a full-stack GitHub repository health analysis application.

The application accepts a public GitHub repository URL, retrieves recent repository and commit telemetry, evaluates the repository using a deterministic multi-dimensional heuristic engine, produces a 0–100 Repository Health Score, and uses an LLM to generate an executive risk report.

The deterministic heuristic engine is the source of truth for numerical scoring. The LLM is responsible for interpreting the calculated results and producing an executive-facing report.

---

## 2. Goals

### Primary Goals

1. Accept a public GitHub repository URL.
2. Validate and safely process the repository URL.
3. Retrieve repository and recent commit telemetry using the GitHub REST API.
4. Normalize GitHub API responses into an internal telemetry model.
5. Calculate deterministic repository health metrics.
6. Produce a final health score from 0–100.
7. Generate an executive risk report using an OpenAI-compatible LLM API.
8. Present the analysis through a responsive analytics dashboard.
9. Handle invalid input, missing repositories, API failures, rate limits, and timeouts gracefully.
10. Maintain clean, incremental Conventional Commit history.

### Non-Goals

The initial version will not include:

- User accounts
- Persistent repository history
- Database-backed storage
- Private repository analysis
- Repository modification capabilities

---

## 3. Technology Stack

### Frontend / Full Stack

- Next.js
- TypeScript
- React
- Tailwind CSS
- Recharts

### Backend

- Next.js Route Handlers
- GitHub REST API

### AI

- OpenAI-compatible LLM API
- Configurable API base URL
- Configurable model name
- API key supplied through environment configuration

### Deployment

- Vercel

### Development

- Git
- GitHub
- VS Code
- Antigravity
- GitHub Copilot
- ChatGPT
- Codex when useful

---

## 4. High-Level Architecture

```text
User
 |
 | GitHub Repository URL
 v
Next.js Frontend
 |
 | POST /api/analyze
 v
Analysis API Route
 |
 +--> URL Validation
 |
 +--> GitHub Service
 |       |
 |       +--> Repository API
 |       |
 |       +--> Commit List API
 |       |
 |       +--> Commit Detail API
 |
 v
Telemetry Normalizer
 |
 v
Deterministic Heuristic Engine
 |
 +--> Code Churn
 +--> Commit Hygiene
 +--> Commit Cadence
 +--> Author Entropy
 +--> Anomaly Detection
 |
 v
0–100 Health Score
 |
 +----------------------+
 |                      |
 v                      v
Dashboard             LLM Service
                          |
                          v
                  Executive Risk Report
```

---

## 5. Deterministic Heuristic Engine

### 5.1 Analysis Window

All scoring dimensions operate over the **latest 30 commits** retrieved from the repository's default branch. This is a fixed window, not a time-based window.

> **Important — cadence scoring constraint:** Because the analysis window contains a fixed number of commits (30), raw commit count cannot be used as a quality proxy. A repository that made 30 commits in one day and a repository that made 30 commits over two years both supply 30 data points. Cadence scoring must therefore measure the *timing and regularity* of commits, not their count.

---

### 5.2 Dimension Weights

| Dimension | Weight |
|---|---|
| Code Churn | 25% |
| Commit Hygiene | 20% |
| Commit Cadence / Velocity | 20% |
| Author Entropy | 15% |
| Anomaly Health | 20% |
| **Total** | **100%** |

Each dimension produces a score in **[0, 100]**. The final Health Score is the weighted sum of all five dimension scores.

---

### 5.3 Notation

| Symbol | Meaning |
|---|---|
| N | Number of commits in the analysis window (30) |
| aᵢ | Additions in commit i |
| dᵢ | Deletions in commit i |
| fᵢ | Files changed in commit i |
| mᵢ | Commit message for commit i |
| tᵢ | Timestamp (Unix seconds) of commit i, ordered newest → oldest |
| Δᵢ | Inter-commit gap: tᵢ₋₁ − tᵢ  (seconds), for i = 1 … N−1 |
| authorₖ | Distinct author (by email) k |
| cₖ | Number of commits by author k |
| H | Number of distinct authors |

---

### 5.4 Code Churn Score (weight: 25%)

Code churn measures the volume, balance, and concentration of file changes. High churn is not inherently bad; unbalanced or heavily concentrated churn is a risk signal.

#### 5.4.1 Inputs

```
totalAdditions  = Σ aᵢ  for i = 1 … N
totalDeletions  = Σ dᵢ  for i = 1 … N
totalChanges    = totalAdditions + totalDeletions
maxFilesInOne   = max(fᵢ)  for i = 1 … N
avgFilesPerCommit = (Σ fᵢ) / N
```

#### 5.4.2 Churn Balance

Measures whether additions and deletions are proportional. Perfectly balanced churn (equal adds and deletes) scores 1.0; entirely one-directional churn scores 0.0.

```
If totalChanges = 0:
    churnBalance = 1.0

Else:
    minSide      = min(totalAdditions, totalDeletions)
    churnBalance = (2 × minSide) / totalChanges
    churnBalance ∈ [0, 1]
```

#### 5.4.3 Churn Intensity

Measures whether the average commit size is within a healthy range. The reference ceiling is **500 changed lines per commit**; anything at or above that ceiling scores 0.

```
avgLinesPerCommit = totalChanges / N

churnIntensity = clamp(1 − (avgLinesPerCommit / 500), 0, 1)
```

#### 5.4.4 Churn Concentration

Measures whether change is evenly spread across commits. A single commit containing many files relative to the average is a risk signal.

```
If avgFilesPerCommit = 0:
    churnConcentration = 1.0

Else:
    ratio              = maxFilesInOne / avgFilesPerCommit
    churnConcentration = clamp(1 − ((ratio − 1) / 9), 0, 1)
    -- ratio = 1  → perfectly even → score 1.0
    -- ratio = 10 → 10× the average → score 0.0
```

#### 5.4.5 Composite Churn Score

```
churnScore = round(
    (churnBalance × 0.40 + churnIntensity × 0.35 + churnConcentration × 0.25) × 100
)
churnScore ∈ [0, 100]
```

---

### 5.5 Commit Hygiene Score (weight: 20%)

Commit hygiene evaluates message quality using the [Conventional Commits](https://www.conventionalcommits.org/) specification.

#### 5.5.1 Conventional Commit Pattern

A message is **conventional** if its first line matches:

```
<type>[optional scope]: <description>
```

Where `type` is one of: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

A message receives a **partial credit** of 0.5 if it does not match the Conventional Commit pattern but its first line is at least 20 characters long (substantive free-form message).

A message scores 0.0 if its first line is fewer than 20 characters and does not match the Conventional Commit pattern (trivial or empty message).

#### 5.5.2 Per-Commit Score

```
For each commit i:
    If firstLine(mᵢ) matches Conventional Commit pattern:
        hygieneᵢ = 1.0
    Else if length(firstLine(mᵢ)) ≥ 20:
        hygieneᵢ = 0.5
    Else:
        hygieneᵢ = 0.0
```

#### 5.5.3 Composite Hygiene Score

```
hygieneScore = round((Σ hygieneᵢ / N) × 100)
hygieneScore ∈ [0, 100]
```

---

### 5.6 Commit Cadence / Velocity Score (weight: 20%)

Cadence scoring measures the *timing and regularity* of commits, not their count. Raw commit count is explicitly excluded as a quality proxy (see §5.1).

#### 5.6.1 Inter-Commit Gaps

Compute the N−1 time gaps between consecutive commits (newest to oldest):

```
Δᵢ = tᵢ₋₁ − tᵢ   seconds,  for i = 1 … N−1
```

If N < 2, cadence cannot be computed. Set `cadenceScore = 50` (neutral).

#### 5.6.2 Commit Velocity

Measures the median inter-commit gap on a linear scale. Shorter median gaps receive higher velocity scores; a median gap of 7 days (604,800 seconds) or more receives a score of 0.

```
medianGap = median(Δ₁ … ΔN₋₁)   seconds

velocity = clamp(1 − (medianGap / 604800), 0, 1)
           -- 604800 = 7 days in seconds
           -- medianGap = 0       → velocity = 1.0
           -- medianGap = 604800  → velocity = 0.0
```

#### 5.6.3 Inter-Commit Regularity (Coefficient of Variation)

Regularity penalizes bursty or irregular commit patterns. It uses the **coefficient of variation (CV)** of the inter-commit gaps.

```
meanGap = mean(Δ₁ … ΔN₋₁)
stdGap  = sample standard deviation of (Δ₁ … ΔN₋₁)

If meanGap = 0:
    CV = 0

Else:
    CV = stdGap / meanGap

regularity = clamp(1 − (CV / 2), 0, 1)
             -- CV = 0   → perfectly regular → regularity = 1.0
             -- CV ≥ 2   → highly irregular  → regularity = 0.0
```

#### 5.6.4 Activity Concentration

Measures whether commits are spread across the available time window or are concentrated in a single burst.

```
windowSeconds = t₀ − t_(N-1)   (newest timestamp − oldest timestamp)

If windowSeconds = 0:
    activityConcentration = 0.0

Else:
    -- Compute the fraction of the window occupied by the densest half of commits.
    -- Sort commits by timestamp. Take the middle 50% (indices N/4 … 3N/4).
    -- Measure that sub-window as a fraction of the total window.
    innerWindow = t_(N/4) − t_(3N/4)
    concentration = innerWindow / windowSeconds

    activityConcentration = clamp(concentration, 0, 1)
```

> A repository where all commits cluster in a short burst has a low `activityConcentration` score. Evenly distributed commits score near 1.0.

#### 5.6.5 Composite Cadence Score

```
cadenceScore = round(
    (velocity × 0.50 + regularity × 0.30 + activityConcentration × 0.20) × 100
)
cadenceScore ∈ [0, 100]
```

---

### 5.7 Author Entropy Score (weight: 15%)

Author entropy measures contributor diversity using **normalized Shannon entropy**. A repository dominated by a single author is a bus-factor risk; a healthy repository has distributed contribution.

#### 5.7.1 Commit Share Per Author

```
pₖ = cₖ / N    for each distinct author k  (k = 1 … H)
```

#### 5.7.2 Shannon Entropy

```
If H = 1:
    rawEntropy = 0    (single author → zero entropy)

Else:
    rawEntropy = − Σ (pₖ × log₂(pₖ))   for k = 1 … H
```

#### 5.7.3 Normalized Entropy

Normalize against the maximum possible entropy for H authors (uniform distribution):

```
maxEntropy = log₂(H)

If maxEntropy = 0:
    normalizedEntropy = 0

Else:
    normalizedEntropy = rawEntropy / maxEntropy
    normalizedEntropy ∈ [0, 1]
```

#### 5.7.4 Composite Entropy Score

```
entropyScore = round(normalizedEntropy × 100)
entropyScore ∈ [0, 100]
```

> A score of 100 means all N commits come from H different authors with equal contribution. A score of 0 means a single author made all commits.

---

### 5.8 Anomaly Health Score (weight: 20%)

Anomaly scoring detects statistical outliers and structural anti-patterns within the commit window. Higher scores mean fewer anomalies.

#### 5.8.1 Oversized Commit Anomaly

A commit is **oversized** if its total changed lines exceed **3× the median** total changes across all commits. The median is used as the baseline rather than the mean because the mean is disproportionately inflated by the very outlier being detected, making it a less stable reference point.

```
medianChanges = median(aᵢ + dᵢ)   for i = 1 … N

oversizedCount = count of commits i where (aᵢ + dᵢ) > 3 × medianChanges

oversizedRatio = oversizedCount / N
oversizedHealth = clamp(1 − (oversizedRatio / 0.20), 0, 1)
                  -- ≥20% of commits oversized → score 0
```

#### 5.8.2 Empty or Trivial Commit Anomaly

A commit is **trivial** if it has zero additions, zero deletions, and zero files changed.

```
trivialCount = count of commits i where (aᵢ + dᵢ + fᵢ) = 0

trivialRatio = trivialCount / N
trivialHealth = clamp(1 − (trivialRatio / 0.10), 0, 1)
                -- ≥10% trivial → score 0
```

#### 5.8.3 Burst Anomaly

A **burst** is a sequence of 3 or more consecutive commits all within **1 hour (3,600 seconds)** of each other.

```
burstCount = number of commits that belong to at least one such burst sequence

burstRatio = burstCount / N
burstHealth = clamp(1 − (burstRatio / 0.30), 0, 1)
              -- ≥30% of commits inside bursts → score 0
```

#### 5.8.4 Archived Repository Penalty

If the repository is archived (`archived = true`), the anomaly health score is **capped at 40** regardless of the other signals. An archived repository is not under active development.

#### 5.8.5 Composite Anomaly Health Score

```
rawAnomalyHealth = round(
    (oversizedHealth × 0.40 + trivialHealth × 0.30 + burstHealth × 0.30) × 100
)

If archived:
    anomalyScore = min(rawAnomalyHealth, 40)
Else:
    anomalyScore = rawAnomalyHealth

anomalyScore ∈ [0, 100]
```

---

### 5.9 Final Weighted Health Score

```
healthScore = round(
    churnScore   × 0.25 +
    hygieneScore × 0.20 +
    cadenceScore × 0.20 +
    entropyScore × 0.15 +
    anomalyScore × 0.20
)
healthScore ∈ [0, 100]
```

#### Score Interpretation

| Range | Label |
|---|---|
| 80 – 100 | Healthy |
| 60 – 79 | Moderate |
| 40 – 59 | At Risk |
| 0 – 39 | Critical |

---

### 5.10 Normalization Philosophy

This engine uses **two distinct normalization strategies**:

**Repository-relative normalization** is used where the meaningful reference is the repository's own data:
- Churn concentration compares the worst commit to the average within the window.
- Anomaly ratios (oversized, trivial, burst) compare counts to N.
- Author entropy normalizes against log₂(H) — the maximum for this repository's contributor count.

**Universal fixed thresholds** are used where an external reference is more meaningful than the repository's own data:
- Churn intensity: 500 changed lines per commit is the universal ceiling.
- Cadence velocity: 7 days between commits is the universal floor.
- Cadence regularity: CV ≥ 2 is the universal irregularity ceiling.
- Hygiene: The Conventional Commits specification is an external standard.

Mixing both strategies prevents gaming: a repository cannot score well on a relative measure by simply having uniformly bad data.