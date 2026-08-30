import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/analyze
 *
 * Accepts a GitHub repository URL and orchestrates:
 *   1. URL validation
 *   2. GitHub telemetry retrieval (not yet implemented)
 *   3. Telemetry normalization (not yet implemented)
 *   4. Deterministic heuristic scoring (not yet implemented)
 *   5. LLM executive risk report generation (not yet implemented)
 *
 * Returns a AnalysisResult or an error response.
 */
export async function POST(request: NextRequest) {
  // TODO: implement analysis pipeline
  void request;
  return NextResponse.json(
    { error: "Not implemented" },
    { status: 501 }
  );
}
