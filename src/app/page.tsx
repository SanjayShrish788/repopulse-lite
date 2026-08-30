"use client";

import { useState } from "react";
import { AnalysisForm } from "@/components/AnalysisForm";
import { Dashboard } from "@/components/Dashboard";
import type { AnalysisResult } from "@/types";

export default function Home() {
  const [result, setResult] = useState<AnalysisResult | null>(null);

  return (
    <main className="flex flex-1 flex-col items-center min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 py-12">
      <div className={`w-full flex flex-col items-center gap-8 ${result ? 'max-w-6xl' : 'max-w-2xl mt-10'}`}>
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            RepoPulse Lite
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400">
            GitHub repository health analysis
          </p>
        </div>

        <div className="w-full max-w-2xl">
          <AnalysisForm onResult={setResult} />
        </div>

        {result ? (
          <div className="w-full mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Dashboard result={result} />
          </div>
        ) : (
          <p className="text-xs text-zinc-400 dark:text-zinc-600">
            Analysis is read-only. Only public repositories are supported.
          </p>
        )}
      </div>
    </main>
  );
}
