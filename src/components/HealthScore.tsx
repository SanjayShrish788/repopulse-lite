import React from "react";

interface HealthScoreProps {
  score: number;
}

export function HealthScore({ score }: HealthScoreProps) {
  // Clamp score between 0 and 100 for safety
  const safeScore = Math.max(0, Math.min(100, score));

  // Determine color based on score
  let colorClass = "text-red-500";
  if (safeScore >= 80) colorClass = "text-green-500";
  else if (safeScore >= 50) colorClass = "text-yellow-500";

  // Circle properties
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safeScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Overall Health</h2>
      <div className="relative flex items-center justify-center">
        {/* Background circle */}
        <svg className="w-40 h-40 transform -rotate-90">
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke="currentColor"
            strokeWidth="12"
            fill="transparent"
            className="text-zinc-100 dark:text-zinc-800"
          />
          {/* Progress circle */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke="currentColor"
            strokeWidth="12"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={`${colorClass} transition-all duration-1000 ease-out`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">{safeScore}</span>
          <span className="text-xs text-zinc-500 font-medium mt-1">/ 100</span>
        </div>
      </div>
    </div>
  );
}
