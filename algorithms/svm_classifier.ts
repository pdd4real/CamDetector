import type { DetectionResult, FeatureVector } from "./types";

const WEIGHTS = {
  L: 1.15,
  d: 0.72,
  b: 1.45,
  s: 0.95,
  bias: -1.85,
};

export function scoreFeatureVector(vector: FeatureVector): number {
  return (
    vector.L * WEIGHTS.L +
    vector.d * WEIGHTS.d +
    vector.b * WEIGHTS.b +
    vector.s * WEIGHTS.s +
    WEIGHTS.bias
  );
}

export function classifyCameraTraffic(featuresByMac: Record<string, FeatureVector>): DetectionResult {
  const scored = Object.entries(featuresByMac)
    .map(([mac, vector]) => ({
      mac,
      confidence: sigmoid(scoreFeatureVector(vector)),
    }))
    .sort((a, b) => b.confidence - a.confidence);

  const candidates = scored.filter((item) => item.confidence >= 0.62);

  return {
    hasCamera: candidates.length > 0,
    confidence: Number((scored[0]?.confidence ?? 0).toFixed(3)),
    cameraCount: candidates.length,
    candidateMacs: candidates.map((item) => item.mac),
  };
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

