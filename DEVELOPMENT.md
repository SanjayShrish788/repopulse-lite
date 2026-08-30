# Development & AI Audit Log

## Project Development Approach

RepoPulse Lite was developed incrementally using an iterative, component-driven approach. The implementation strictly adheres to the technical specification (`SPEC.md`). The Git commit history represents major implementation stages, ensuring that discrete, verifiable pieces of the pipeline were built, tested, and validated step-by-step.

## Tools & Models Used

- **Development Environment**: Antigravity IDE, PowerShell / terminal.
- **Version Control**: Git, GitHub.
- **AI Assistants**: Antigravity (Google DeepMind agent) for implementation, debugging, and prompt refinement.
- **Target LLM API**: OpenAI-compatible API (defaulting to `gpt-4o`) for the application's executive risk report generation.

## Human vs AI Contribution

- **Human**: Provided project direction, defined technical requirements and acceptance criteria (`SPEC.md`), drove testing decisions, reviewed generated implementations, supplied manual API tests (e.g., verifying `POST /api/analyze`), enforced anti-inference reporting rules, and granted final approval.
- **AI**: Provided implementation assistance (translating formulas into TypeScript), code generation and refinement (building the Next.js API route and React dashboard), debugging assistance, iterative prompt refinement for the LLM system message, and documentation assistance. Product decisions remained strictly with the human.

## Prompting & Problem-Solving History

The iterative problem-solving process is visible through the project's development history:
- **GitHub Integration**: Began by building modular fetchers for repository metadata, commit lists, and detailed diff telemetry to ensure isolated validation of the external API.
- **Scoring Implementation**: Sequentially built the five deterministic heuristic dimensions (Code Churn, Commit Hygiene, Commit Cadence, Author Entropy, Anomaly Detection) directly mapping the mathematical formulas provided in `SPEC.md`.
- **LLM Integration**: Wired the LLM service to consume the deterministic scores to output an executive report.
- **Iterative Anti-Inference Refinements**: Observed that early LLM generations made unverified causal claims based on the scores. Iteratively locked down the system prompt across several cycles, ultimately restricting the LLM to predefined phrase structures and an absolute prohibition on inferring repository behavior, practices, or root causes.
- **Frontend Dashboard**: Built the responsive visual dashboard using Recharts and React Markdown, strictly feeding it the normalized `AnalysisResult`.
- **Verification**: Iteratively ran `tsc --noEmit` and targeted `eslint` to ensure zero-warning production builds.

## Development Timeline

Based on the Git history, the major implementation stages were executed as follows:

1. **Initialization & Specification:**
   - `2701b96 docs: add project specification`
   - `76276fd feat: initialize nextjs application`
2. **GitHub API Integrations:**
   - `be6748e feat: add github repository client`
   - `e94fa8b feat: add github commit list retrieval`
   - `beb0787 feat: add github commit detail retrieval`
3. **Telemetry & Scoring Engine:**
   - `0c669ea feat: add telemetry normalization`
   - `6acc735 docs: refine heuristic scoring specification`
   - `c4cce38 feat: implement code churn scoring`
   - `846ab00 feat: implement commit hygiene scoring`
   - `b9bd539 feat: implement commit cadence scoring`
   - `f64d3e4 feat: implement author entropy scoring`
   - `ab3c3ed feat: assemble repository health score`
4. **Analysis Pipeline:**
   - `49a4309 feat: implement github repository URL validation`
   - `ef138a2 feat: wire repository analysis pipeline`
5. **LLM Executive Report Generation:**
   - `19adf51 feat: implement llm executive report generation`
   - `fd486f4 feat: integrate llm report into analysis pipeline`
6. **Strict LLM Evidence-Discipline Refinements:**
   - `60bf146 refine llm report evidence discipline`
   - `0642d05 tighten llm score interpretation`
   - `3c12c51 enforce strict llm score interpretation`
   - `13473b7 refine llm report constraints`
7. **Frontend Dashboard:**
   - `8418974 feat: build analysis dashboard`
8. **Final Documentation:**
   - Complete technical `README.md` rewrite and `DEVELOPMENT.md` audit log creation.

## AI-Assisted Development

AI assistance played a crucial role in the development and validation of RepoPulse Lite:

- **Implementation Assistance:** AI agents successfully implemented the deterministic scoring heuristics directly from `SPEC.md`, accurately mapping the formulas to TypeScript functions.
- **Prompt Refinement:** AI heavily assisted in refining and locking down the `SYSTEM_MESSAGE` prompt within `src/services/llm.ts` to enforce the strict anti-inference rule. Through multiple iterative passes (e.g., `13473b7`), the agent strengthened the constraints to prevent the LLM from hallucinating repository behavior.
- **Frontend Component Generation:** AI effectively assembled the React frontend components (`HealthScore.tsx`, `DimensionCards.tsx`, `ScoreChart.tsx`, `MarkdownReport.tsx`) using Tailwind CSS and Recharts without introducing new dependencies.
- **Verification Assistance:** During every major step, the AI agent rigorously applied internal validation, leveraging TypeScript compiler (`tsc --noEmit`) and ESLint checks to ensure zero-warning commits.

## Verification Process

The development process enforced rigorous verification at every stage. Commands used to validate functionality:

- **Type Checking:** `npx tsc --noEmit` ensured structural and type safety across all components and API boundaries.
- **Linting:** Targeted `npx eslint <files> --max-warnings=0` executions prevented technical debt and unused variable warnings.
- **Production Build Validation:** `npm run build` confirmed the Next.js App Router successfully compiled dynamic API routes and static pages.
- **E2E Testing:** Direct HTTP testing against `POST /api/analyze` verified handling of:
  - Valid repository URLs (HTTP 200).
  - Malformed GitHub URLs (HTTP 400).
  - Non-existent/private repositories (HTTP 404).

## Important Design Decisions

- **Deterministic Scoring Remains Authoritative:** The numerical scores are calculated purely in code. The LLM is strictly prohibited from recalculating or altering these numbers.
- **Strict Anti-Inference Constraints:** The LLM interprets the supplied scores using score-relative language only. It is explicitly banned from drawing false conclusions about commit magnitude, repository maintainability, or developer behavior that was not present in the supplied numbers.
- **Unidirectional Data Flow:** The frontend (`AnalysisForm.tsx`) simply consumes the `AnalysisResult` and passes it down to pure UI components (`Dashboard.tsx`). 
- **Read-Only Context:** The analysis guarantees no side-effects or modifications to external repositories.

## Known Limitations

- **Public Repositories Only:** Private repositories cannot be fetched without an authorized GitHub token, causing an intentional 404 response.
- **Rate Limiting:** Unauthenticated GitHub API access is restricted to 60 requests per hour.
- **LLM Dependency:** The pipeline depends on a functional, properly authenticated OpenAI-compatible API to generate the final executive report.
- **Heuristic Scope:** The repository health is a fixed, backward-looking snapshot of the most recent 30 commits. It is a proxy signal, not an absolute evaluation of system architecture or code quality.
