import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const cameraSample = await readJson("samples/packets_camera_present.json");
const emptySample = await readJson("samples/packets_no_camera.json");
const localization = await readJson("samples/localization_path.json");

const cameraGroups = groupTraffic(cameraSample.frames, cameraSample.vendors);
const emptyGroups = groupTraffic(emptySample.frames, emptySample.vendors);
const cameraResult = classify(cameraGroups);
const emptyResult = classify(emptyGroups);
const change = detectBitrateChange(localization.bitrateSeries);

assert.equal(cameraResult.hasCamera, true, "camera sample should classify as camera traffic");
assert.equal(emptyResult.hasCamera, false, "ordinary device sample should not classify as camera traffic");
assert.equal(change.triggered, true, "localization bitrate series should trigger CUSUM change detection");
assert.ok(cameraGroups[0].cdf.length > 0, "camera group should expose a CDF series");
assert.ok(cameraResult.confidence > emptyResult.confidence, "camera confidence should exceed ordinary traffic confidence");

console.log("algorithm smoke test passed");
console.log({
  cameraConfidence: Number(cameraResult.confidence.toFixed(3)),
  emptyConfidence: Number(emptyResult.confidence.toFixed(3)),
  triggerTime: change.triggerTime,
});

async function readJson(path) {
  const body = await readFile(join(root, path), "utf8");
  return JSON.parse(body);
}

function groupTraffic(frames, vendors) {
  const buckets = new Map();
  for (const frame of frames) {
    const mac = frame.source;
    if (mac === "ff:ff:ff:ff:ff:ff" || mac.startsWith("01:00:5e")) continue;
    if (!buckets.has(mac)) buckets.set(mac, []);
    buckets.get(mac).push(frame);
  }
  return [...buckets.entries()]
    .filter(([, groupFrames]) => groupFrames.length >= 4)
    .map(([mac, groupFrames]) => ({
      mac,
      vendor: vendors[mac] ?? "Unknown",
      frames: groupFrames.sort((a, b) => a.time - b.time),
      cdf: buildLengthCdf(groupFrames),
      bitrateSeries: buildBitrateSeries(groupFrames),
    }))
    .sort((a, b) => b.frames.length - a.frames.length);
}

function buildLengthCdf(frames) {
  const lengths = frames.map((frame) => frame.length).sort((a, b) => a - b);
  return lengths.map((length, index) => ({ length, cdf: (index + 1) / lengths.length }));
}

function buildBitrateSeries(frames) {
  if (frames.length === 0) return [];
  const windows = new Map();
  const start = Math.floor(frames[0].time / 5) * 5;
  for (const frame of frames) {
    const bucket = Math.floor((frame.time - start) / 5) * 5 + start;
    windows.set(bucket, (windows.get(bucket) ?? 0) + frame.length * 8);
  }
  return [...windows.entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, bits]) => ({ time, kbps: bits / 5 / 1000 }));
}

function classify(groups) {
  const scored = groups
    .map((group) => {
      const vector = feature(group);
      const score = vector.L * 1.15 + vector.d * 0.72 + vector.b * 1.45 + vector.s * 0.95 - 1.85;
      return { mac: group.mac, confidence: 1 / (1 + Math.exp(-score)) };
    })
    .sort((a, b) => b.confidence - a.confidence);
  const candidates = scored.filter((item) => item.confidence >= 0.62);
  return {
    hasCamera: candidates.length > 0,
    confidence: scored[0]?.confidence ?? 0,
    candidateMacs: candidates.map((item) => item.mac),
  };
}

function feature(group) {
  const lengths = group.frames.map((frame) => frame.length);
  const bitrates = group.bitrateSeries.map((point) => point.kbps);
  const avgBitrate = mean(bitrates);
  return {
    L: clamp(mean(lengths) / 1400),
    d: clamp(std(lengths) / 520),
    b: clamp(Math.max(...bitrates, 0) / Math.max(avgBitrate, 1) / 3),
    s: clamp(1 - jitter(bitrates)),
  };
}

function detectBitrateChange(series, drift = 12, threshold = 110) {
  const baseline = median(series.slice(0, Math.max(2, Math.floor(series.length / 3))).map((point) => point.kbps));
  let score = 0;
  let triggerTime = null;
  for (const point of series) {
    score = Math.max(0, score + point.kbps - baseline - drift);
    if (score > threshold && triggerTime === null) triggerTime = point.time;
  }
  return { triggered: triggerTime !== null, triggerTime };
}

function jitter(values) {
  if (values.length < 2) return 0;
  const deltas = values.slice(1).map((value, index) => Math.abs(value - values[index]));
  return clamp(mean(deltas) / Math.max(mean(values), 1));
}

function mean(values) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function std(values) {
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle] ?? 0;
}

function clamp(value) {
  return Math.max(0, Math.min(1, value));
}
