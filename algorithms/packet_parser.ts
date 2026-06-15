import type { BitratePoint, CdfPoint, PacketFrame, TrafficGroup } from "./types";

const WINDOW_SECONDS = 5;

export function groupTraffic(frames: PacketFrame[], vendors: Record<string, string>): TrafficGroup[] {
  const buckets = new Map<string, PacketFrame[]>();

  for (const frame of frames) {
    const mac = frame.source;
    if (mac === "ff:ff:ff:ff:ff:ff" || mac.startsWith("01:00:5e")) continue;
    if (!buckets.has(mac)) buckets.set(mac, []);
    buckets.get(mac)!.push(frame);
  }

  return [...buckets.entries()]
    .filter(([, groupFrames]) => groupFrames.length >= 4)
    .map(([mac, groupFrames]) => ({
      mac,
      vendor: vendors[mac] ?? "Unknown",
      frames: groupFrames.sort((a, b) => a.time - b.time),
      bitrateSeries: buildBitrateSeries(groupFrames),
      cdf: buildLengthCdf(groupFrames),
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
    .map(([time, bits]) => ({
      time,
      kbps: Number((bits / WINDOW_SECONDS / 1000).toFixed(2)),
    }));
}
