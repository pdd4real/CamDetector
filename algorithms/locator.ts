import type { BitratePoint, LocalizationState } from "./types";

export type MotionSample = {
  time: number;
  x: number;
  y: number;
};

export function estimateLocalization(
  bitrateSeries: BitratePoint[],
  motion: MotionSample[],
  signalStrength: number,
  mode: "toward" | "reverse" | "outside" = "toward",
): LocalizationState {
  if (mode === "outside") {
    return {
      directionDeg: 0,
      distanceMeters: 0,
      signalStrength: Math.max(18, signalStrength),
      instruction: "当前房间不存在摄像头，可切换房间继续采集",
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
    instruction: mode === "reverse" ? "请往反方向移动，直到出现新的提示" : "请缓慢移动手机，沿箭头方向靠近疑似位置",
    stage: signalStrength > 78 ? "precise" : "coarse",
  };
}

function bitrateGradient(series: BitratePoint[]): number {
  if (series.length < 2) return 0;
  const first = series[0].kbps;
  const last = series[series.length - 1].kbps;
  return Math.max(-4, Math.min(4, (last - first) / 90));
}

function motionHeading(motion: MotionSample[]): number {
  if (motion.length < 2) return 0;
  const first = motion[0];
  const last = motion[motion.length - 1];
  return normalizeDeg((Math.atan2(last.y - first.y, last.x - first.x) * 180) / Math.PI);
}

function normalizeDeg(value: number): number {
  return Number((((value % 360) + 360) % 360).toFixed(1));
}

