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