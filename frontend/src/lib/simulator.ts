import type {
  BitratePoint,
  CdfPoint,
  DetectionResult,
  FeatureVector,
  LocalizationState,
  PacketFrame,
  TrafficGroup,
} from "../types";

const WINDOW_SECONDS = 5;

const T = {
  outside: "当前房间不存在摄像头，可切换房间继续采集",
  reverse: "请往反方向移动，直到出现新的提示",
  toward: "请缓慢移动手机，沿箭头方向靠近疑似位置",
};

export function groupTraffic(frames: PacketFrame[], vendors: Record<string, string>): TrafficGroup[] {
  const buckets = new Map<string, PacketFrame[]>();

  for (const frame of frames) {
    const mac = frame.source;
    if (mac === "ff:ff:ff:ff:ff:ff" || mac.startsWith("01:00:5e")) continue;
    if (!buckets.has(mac)) buckets.set(mac, []);
    buckets.get(mac)!.push(frame);
  }

  return [...buckets.entries()]
    .filter(([, groupedFrames]) => groupedFrames.length >= 4)
    .map(([mac, groupedFrames]) => ({
      mac,
      vendor: vendors[mac] ?? "Unknown",
      frames: groupedFrames.sort((a, b) => a.time - b.time),
      bitrateSeries: buildBitrateSeries(groupedFrames),
      cdf: buildLengthCdf(groupedFrames),
    }))
    .sort((a, b) => b.frames.length - a.frames.length);
}

export function buildLengthCdf(frames: PacketFrame[]): CdfPoint[] {
  const lengths = frames.map((frame) => frame.length).sort((a, b) => a - b);
  return lengths.map((length, index) => ({
    length,
    cdf: Number(((index + 1) / lengths.length).toFixed(3)),
  }));
}

export function buildBitrateSeries(frames: PacketFrame[]): BitratePoint[] {
  if (frames.length === 0) return [];
  const start = Math.floor(frames[0].time / WINDOW_SECONDS) * WINDOW_SECONDS;
  const windows = new Map<number, number>();

  for (const frame of frames) {
    const bucket = Math.floor((frame.time - start) / WINDOW_SECONDS) * WINDOW_SECONDS + start;
    windows.set(bucket, (windows.get(bucket) ?? 0) + frame.length * 8);
  }

  return [...windows.entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, bits]) => ({ time, kbps: Number((bits / WINDOW_SECONDS / 1000).toFixed(2)) }));
}

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

export function classifyCameraTraffic(groups: TrafficGroup[]): DetectionResult {
  const scored = groups
    .map((group) => {
      const vector = extractFeatureVector(group);
      return { mac: group.mac, confidence: sigmoid(scoreVector(vector)), vector };
    })
    .sort((a, b) => b.confidence - a.confidence);

  const candidates = scored.filter((item) => item.confidence >= 0.62);
  return {
    hasCamera: candidates.length > 0,
    confidence: Number((scored[0]?.confidence ?? 0).toFixed(3)),
    cameraCount: candidates.length,
    candidateMacs: candidates.map((item) => item.mac),
  };
}

export function detectBitrateChange(series: BitratePoint[], drift = 12, threshold = 110) {
  if (series.length === 0) return { triggered: false, triggerTime: null, scoreSeries: [] };
  const baseline = median(series.slice(0, Math.max(2, Math.floor(series.length / 3))).map((p) => p.kbps));
  let score = 0;
  let triggerTime: number | null = null;
  const scoreSeries = series.map((point) => {
    score = Math.max(0, score + point.kbps - baseline - drift);
    if (score > threshold && triggerTime === null) triggerTime = point.time;
    return { time: point.time, score: Number(score.toFixed(2)) };
  });
  return { triggered: triggerTime !== null, triggerTime, scoreSeries };
}

export function estimateLocalization(
  bitrateSeries: BitratePoint[],
  motion: { time: number; x: number; y: number }[],
  signalStrength: number,
  mode: "toward" | "reverse" | "outside",
): LocalizationState {
  if (mode === "outside") {
    return {
      directionDeg: 0,
      distanceMeters: 0,
      signalStrength: 28,
      instruction: T.outside,
      stage: "complete",
    };
  }

  const gradient = bitrateGradient(bitrateSeries);
  const heading = motionHeading(motion);
  const directionDeg = mode === "reverse" ? normalizeDeg(heading + 180) : normalizeDeg(heading + gradient * 16);
  const distanceMeters = Number(Math.max(0.8, 5.2 - signalStrength / 20).toFixed(2));

  return {
    directionDeg,
    distanceMeters,
    signalStrength,
    instruction: mode === "reverse" ? T.reverse : T.toward,
    stage: signalStrength > 78 ? "precise" : "coarse",
  };
}

function scoreVector(vector: FeatureVector): number {
  return vector.L * 1.15 + vector.d * 0.72 + vector.b * 1.45 + vector.s * 0.95 - 1.85;
}

function normalizedJitter(values: number[]): number {
  if (values.length < 2) return 0;
  const deltas = values.slice(1).map((value, index) => Math.abs(value - values[index]));
  return clamp(mean(deltas) / Math.max(mean(values), 1));
}

function bitrateGradient(series: BitratePoint[]): number {
  if (series.length < 2) return 0;
  return Math.max(-4, Math.min(4, (series[series.length - 1].kbps - series[0].kbps) / 90));
}

function motionHeading(motion: { x: number; y: number }[]): number {
  if (motion.length < 2) return 0;
  const first = motion[0];
  const last = motion[motion.length - 1];
  return normalizeDeg((Math.atan2(last.y - first.y, last.x - first.x) * 180) / Math.PI);
}

function normalizeDeg(value: number): number {
  return Number((((value % 360) + 360) % 360).toFixed(1));
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle] ?? 0;
}

function clamp(value: number): number {
  return Number(Math.max(0, Math.min(1, value)).toFixed(3));
}

