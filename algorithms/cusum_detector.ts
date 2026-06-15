import type { BitratePoint } from "./types";

export type CusumResult = {
  triggered: boolean;
  triggerTime: number | null;
  scoreSeries: { time: number; score: number }[];
};

export function detectBitrateChange(series: BitratePoint[], drift = 12, threshold = 110): CusumResult {
  if (series.length === 0) return { triggered: false, triggerTime: null, scoreSeries: [] };

  const baseline = median(series.slice(0, Math.max(2, Math.floor(series.length / 3))).map((p) => p.kbps));
  let score = 0;
  let triggerTime: number | null = null;
  const scoreSeries = series.map((point) => {
    score = Math.max(0, score + point.kbps - baseline - drift);
    if (score > threshold && triggerTime === null) triggerTime = point.time;
    return { time: point.time, score: Number(score.toFixed(2)) };
  });

  return {
    triggered: triggerTime !== null,
    triggerTime,
    scoreSeries,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

