"use client";

import { useState } from "react";
import type { AnalysisResult, AnalysisError } from "@/types";

interface AnalysisFormProps {
  onResult: (result: AnalysisResult) => void;
}

export function AnalysisForm({ onResult }: AnalysisFormProps) {
  const [repoUrl, setRepoUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repoUrl: repoUrl.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errData = data as AnalysisError;
        setError(errData.error || "An unexpected error occurred during analysis.");
        return;
      }

      onResult(data as AnalysisResult);
    } catch {
      setError("Failed to communicate with the analysis server. Please check your network connection.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="w-full flex flex-col sm:flex-row gap-3">
        <input
          id="repo-url-input"
          type="url"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/owner/repository"
          disabled={isLoading}
          required
          className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        />
        <button
          id="analyze-btn"
          type="submit"
          disabled={isLoading || !repoUrl.trim()}
          className="rounded-lg bg-zinc-900 dark:bg-zinc-50 px-6 py-3 text-sm font-semibold text-white dark:text-zinc-900 transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Analyzing...
            </span>
          ) : (
            "Analyze"
          )}
        </button>
      </form>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/50 p-4 border border-red-200 dark:border-red-900/50 text-left">
          <p className="text-sm font-medium text-red-800 dark:text-red-400">
            {error}
          </p>
        </div>
      )}
    </div>
  );
}
