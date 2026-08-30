# RepoPulse Lite

RepoPulse Lite is a full-stack Next.js application that provides instantaneous, read-only health and risk analysis for public GitHub repositories.

It solves the problem of assessing a repository's engineering practices, contributor distribution, and commit hygiene at a glance. By combining a deterministic heuristic engine with an OpenAI-compatible LLM, RepoPulse Lite delivers a 0–100 numerical health score and a concise, evidence-based executive risk report without requiring deep manual codebase audits.

### Key Capabilities
- **URL Validation**: Safely parse and extract GitHub owner and repository names.
- **Data Retrieval**: Fetch recent commits and detailed diff telemetry from the GitHub REST API.
- **Deterministic Scoring**: Evaluate repository health across five dimensions using fixed heuristics.
- **LLM Executive Report**: Generate a human-readable summary that interprets the scores under strict evidence-based constraints.
- **Interactive Dashboard**: A responsive visual dashboard showcasing the overall score, radar charts, and the final executive report.

## Features

- **GitHub Repository URL Validation**: Extracts valid owner/repo details and handles malformed inputs.
- **Repository/Commit Data Retrieval**: Connects to the GitHub API to fetch repository metadata and the last 30 commits.
- **Deterministic Repository Health Scoring**: Fully deterministic logic built in TypeScript ensuring consistent, reproducible scores.
- **Five Health Dimensions**: Evaluates Code Churn, Commit Hygiene, Commit Cadence, Author Entropy, and Anomaly Detection.
- **LLM Executive Risk Report**: Integrates an OpenAI-compatible LLM strictly constrained to explain the deterministic scores without hallucinating causes or behaviors.
- **Interactive Dashboard**: A frontend built with React, Tailwind CSS, and Recharts to visualize health metrics clearly.
- **Error Handling**: Graceful API error surfacing (400 Invalid URL, 404 Not Found, 429 Rate Limited).

## Architecture

Data flows through the system in a unidirectional pipeline:

User
→ Frontend (`src/app/page.tsx` & `src/components/AnalysisForm.tsx`)
→ POST `/api/analyze` (`src/app/api/analyze/route.ts`)
→ Repository URL validation (`src/lib/validateUrl.ts`)
→ GitHub API (`src/services/github.ts`)
→ Telemetry normalization (`src/lib/normalizer.ts`)
→ Heuristic scoring engine (`src/lib/scorer.ts`)
→ Overall health score
→ LLM report generation (`src/services/llm.ts`)
→ Dashboard response (`src/components/Dashboard.tsx`)

## Health Dimensions

All dimensions evaluate the **latest 30 commits** on the default branch.

### 1. Code Churn
- **What it measures**: The volume, balance, and concentration of file changes. High churn is fine; heavily concentrated or entirely one-directional churn is a risk.
- **Formula/Heuristic**: A composite of Churn Balance (additions vs. deletions), Churn Intensity (average lines changed compared against a 500-line ceiling), and Churn Concentration (max files changed vs. the average).
- **Result**: 0–100 score. 100 means balanced, evenly spread, moderately-sized commits.

### 2. Commit Hygiene
- **What it measures**: Evaluates commit message quality against the Conventional Commits specification.
- **Formula/Heuristic**: Full credit (1.0) for conventional patterns (e.g., `feat: message`). Partial credit (0.5) for long but non-conventional messages (≥20 chars). Zero credit for empty/trivial messages.
- **Result**: 0–100 score representing the percentage of clean commits.

### 3. Commit Cadence
- **What it measures**: The timing and regularity of commits, penalized for extreme bursts or long stagnant periods.
- **Formula/Heuristic**: A composite of Velocity (median gap between commits, scaled against a 7-day floor), Regularity (coefficient of variation of time gaps), and Activity Concentration (fraction of the time window occupied by the middle 50% of commits).
- **Result**: 0–100 score. 100 means steady, regular, ongoing commits.

### 4. Author Entropy
- **What it measures**: Contributor diversity and distribution to assess bus-factor risk.
- **Formula/Heuristic**: Normalized Shannon Entropy based on commit share per author.
- **Result**: 0–100 score. 100 means all commits were evenly distributed among all authors. 0 means a single author made all commits.

### 5. Anomaly Detection
- **What it measures**: Detects statistical outliers and anti-patterns.
- **Formula/Heuristic**: Penalizes based on the ratio of oversized commits (changes > 3× the median), empty/trivial commits, and bursts (3+ commits within a 1-hour window). Caps the score at 40 if the repository is archived.
- **Result**: 0–100 score. 100 means no anomalies detected.

## Score Weights

The final composite Health Score (0–100) is the weighted sum of the five dimension scores:
- **Code Churn**: 25%
- **Commit Hygiene**: 20%
- **Commit Cadence**: 20%
- **Author Entropy**: 15%
- **Anomaly Detection**: 20%

## LLM Executive Report

The application uses an OpenAI-compatible LLM to summarize the analysis results for executive consumption.
- **Input**: The LLM receives ONLY the repository name, overall health score, and the five dimension names, scores, and weights.
- **Authoritative Deterministic Scoring**: The LLM does **not** calculate, reinterpret, or override the numerical scores.
- **Evidence-Discipline Constraints**: The LLM is strictly prompted to use purely score-relative language (e.g. "Code Churn is a relative weakness"). It is prohibited from inferring underlying repository behaviors, causes, developer practices, or making claims about commit magnitude, quality, or maintainability. Recommendations are limited only to reviewing or tracking a dimension.
- **Purpose**: To provide a clean, readable Markdown report consisting of a Summary, Strengths, Weaknesses/Risks, and Recommendations based solely on the heuristic output.

## API

### POST `/api/analyze`

**Example Request:**
```json
{
  "repoUrl": "https://github.com/owner/repository"
}
```

**Successful Response (200 OK):**
```json
{
  "repoFullName": "owner/repository",
  "scoring": {
    "healthScore": 75,
    "dimensions": {
      "codeChurn": { "name": "Code Churn", "score": 80, "weight": 0.25 },
      "commitHygiene": { "name": "Commit Hygiene", "score": 90, "weight": 0.2 },
      "commitCadence": { "name": "Commit Cadence", "score": 60, "weight": 0.2 },
      "authorEntropy": { "name": "Author Entropy", "score": 50, "weight": 0.15 },
      "anomalyDetection": { "name": "Anomaly Detection", "score": 85, "weight": 0.2 }
    }
  },
  "report": "## Summary\n...",
  "analyzedAt": "2026-08-31T00:00:00.000Z"
}
```

**Error Cases:**
- `400 Bad Request`: Invalid or malformed GitHub URL.
- `404 Not Found`: Repository not found or is private.
- `429 Too Many Requests`: GitHub API rate limit exceeded.
- `500 Internal Server Error`: LLM configuration failure or unhandled exception.

## Setup

1. **Clone repository:**
   ```bash
   git clone <repo-url>
   cd RepoPulse-Lite
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure environment variables:**
   ```bash
   cp .env.example .env.local
   ```
4. **Edit `.env.local`:**
   - `OPENAI_API_KEY` (Required): Your LLM API key.
   - `OPENAI_BASE_URL` (Optional): API base URL for compatible providers.
   - `OPENAI_MODEL` (Optional): Model name (defaults to `gpt-4o`).
   - `GITHUB_TOKEN` (Optional): Personal access token to avoid rate limits (60 req/hr unauthenticated vs 5,000 req/hr).
5. **Run the development server:**
   ```bash
   npm run dev
   ```
6. **Open [http://localhost:3000](http://localhost:3000)**

## Development Commands

- `npm run dev`: Starts the Next.js development server.
- `npm run build`: Creates an optimized production build.
- `npm run start`: Starts the application in production mode (requires build first).
- `npm run lint`: Runs ESLint against the codebase.

## Limitations

- **Public Repositories Only**: Private repositories will return a 404 Not Found.
- **Read-Only Analysis**: The system observes telemetry but cannot modify or interact with repositories.
- **GitHub/API Rate Limits**: Unauthenticated GitHub API calls are heavily rate-limited to 60 requests per hour.
- **LLM Dependency**: Generating the final report requires an active, configured LLM API.
- **Heuristic Assessment**: Scores are deterministic heuristic assessments based on a 30-commit fixed window. They are comparative proxy signals, not absolute measures of codebase quality.

## Technology Stack

- **Next.js** (App Router)
- **React**
- **TypeScript**
- **Tailwind CSS** (v4)
- **Recharts**
- **react-markdown**
- **GitHub REST API**
- **OpenAI-compatible LLM API**

## Project Structure

```text
src/
├── app/
│   ├── api/analyze/route.ts   # Main analysis pipeline API handler
│   ├── globals.css            # Tailwind and global styles
│   ├── layout.tsx             # Root layout and fonts
│   └── page.tsx               # Main UI view (orchestrator)
├── components/
│   ├── AnalysisForm.tsx       # Repository input form & loading state
│   ├── Dashboard.tsx          # Analytics results orchestrator
│   ├── DimensionCards.tsx     # Dimension score breakdown cards
│   ├── HealthScore.tsx        # Overall health SVG gauge
│   ├── MarkdownReport.tsx     # Styled react-markdown LLM report renderer
│   └── ScoreChart.tsx         # Recharts radar diagram
├── lib/
│   ├── normalizer.ts          # Transforms GitHub responses to internal telemetry
│   ├── scorer.ts              # Deterministic heuristic engine
│   └── validateUrl.ts         # GitHub URL validation and extraction
├── services/
│   ├── github.ts              # GitHub REST API interactions
│   └── llm.ts                 # Executive report generation & prompt constraints
└── types/
    └── index.ts               # Core domain models and interfaces
```

## Validation

The project undergoes the following strict verification checks during development:
- **TypeScript compilation**: Verified via `npx tsc --noEmit`.
- **ESLint**: Targeted syntax and convention verification.
- **Production Build**: Verified via `npm run build`.
- **API testing**: E2E verification of successful 200 responses, 400 Invalid URL errors, and 404 Not Found errors.
