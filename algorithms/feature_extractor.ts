import type { FeatureVector, TrafficGroup } from "./types";

export function extractFeatureVector(group: TrafficGroup): FeatureVector {
  const lengths = group.frames.map((frame) => frame.length);
  const bitrates = group.bitrateSeries.map((point) => point.kbps);
  const meanLength = mean(lengths);
  const stdLength = standardDeviation(lengths);
  const peakBitrate = Math.max(...bitrates, 0);
  const avgBitrate = mean(bitrates);

  return {
    L: clamp(meanLength / 1400),
    d: clamp(stdLength / 520),
    b: clamp(peakBitrate / Math.max(avgBitrate, 1) / 3),
    s: clamp(1 - normalizedJitter(bitrates)),
  };
}

export function extractAllFeatures(groups: TrafficGroup[]): Record<string, FeatureVector> {
  return Object.fromEntries(groups.map((group) => [group.mac, extractFeatureVector(group)]));
}

function normalizedJitter(values: number[]): number {
  if (values.length < 2) return 0;
  const deltas = values.slice(1).map((value, index) => Math.abs(value - values[index]));
  return clamp(mean(deltas) / Math.max(mean(values), 1));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

function clamp(value: number): number {
  return Number(Math.max(0, Math.min(1, value)).toFixed(3));
}

