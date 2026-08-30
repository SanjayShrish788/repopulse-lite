import React from "react";
import type { AnalysisResult } from "@/types";
import { HealthScore } from "./HealthScore";
import { DimensionCards } from "./DimensionCards";
import { ScoreChart } from "./ScoreChart";
import { MarkdownReport } from "./MarkdownReport";

interface DashboardProps {
  result: AnalysisResult;
}

export function Dashboard({ result }: DashboardProps) {
  const analyzedDate = new Date(result.analyzedAt).toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="w-full flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {result.repoFullName}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
            Analysis generated on {analyzedDate}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <HealthScore score={result.scoring.healthScore} />
          </div>
          <div className="lg:col-span-2">
            <ScoreChart dimensions={result.scoring.dimensions} />
          </div>
        </div>
        
        <DimensionCards dimensions={result.scoring.dimensions} />
        
        <MarkdownReport report={result.report} />
      </div>
    </div>
  );
}
