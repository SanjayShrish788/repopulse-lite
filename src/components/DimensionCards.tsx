import React from "react";
import type { HealthDimensions } from "@/types";

interface DimensionCardsProps {
  dimensions: HealthDimensions;
}

export function DimensionCards({ dimensions }: DimensionCardsProps) {
  // Convert the keyed object to an array to map over easily
  const dimensionList = Object.values(dimensions);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {dimensionList.map((dim) => (
        <div
          key={dim.name}
          className="flex flex-col p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              {dim.name}
            </h3>
            <span className="text-xs px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-md font-medium">
              Weight: {Math.round(dim.weight * 100)}%
            </span>
          </div>
          
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              {dim.score}
            </span>
            <span className="text-sm text-zinc-500 mb-1">/ 100</span>
          </div>
          
          {/* Subtle visual indicator bar */}
          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full mt-4 overflow-hidden">
            <div 
              className={`h-full rounded-full ${
                dim.score >= 80 ? 'bg-green-500' : dim.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, dim.score))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
