"use client";

import React from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip
} from "recharts";
import type { HealthDimensions } from "@/types";

interface ScoreChartProps {
  dimensions: HealthDimensions;
}

export function ScoreChart({ dimensions }: ScoreChartProps) {
  // Transform data for Recharts
  const data = Object.values(dimensions).map((dim) => ({
    subject: dim.name,
    score: dim.score,
    fullMark: 100,
  }));

  return (
    <div className="w-full h-[350px] p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col items-center justify-center">
      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 self-start w-full mb-2">
        Dimension Balance
      </h3>
      <div className="w-full flex-1 min-h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="#a1a1aa" strokeOpacity={0.3} />
            <PolarAngleAxis 
              dataKey="subject" 
              tick={{ fill: '#71717a', fontSize: 12 }} 
            />
            <Radar
              name="Score"
              dataKey="score"
              stroke="#09090b"
              fill="#09090b"
              fillOpacity={0.15}
              className="dark:stroke-zinc-300 dark:fill-zinc-300"
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(24, 24, 27, 0.9)', 
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12px'
              }}
              itemStyle={{ color: '#fff' }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
