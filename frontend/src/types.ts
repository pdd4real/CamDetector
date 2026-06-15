export type PacketFrame = {
  time: number;
  source: string;
  destination: string;
  length: number;
  frameType: string;
  subtype: string;
  signal: number;
};

export type CdfPoint = {
  length: number;
  cdf: number;
};

export type BitratePoint = {
  time: number;
  kbps: number;
};

export type TrafficGroup = {
  mac: string;
  vendor: string;
  frames: PacketFrame[];
  bitrateSeries: BitratePoint[];
  cdf: CdfPoint[];
};

export type FeatureVector = {
  L: number;
  d: number;
  b: number;
  s: number;
};

export type DetectionResult = {
  hasCamera: boolean;
  confidence: number;
  cameraCount: number;
  candidateMacs: string[];
};

export type LocalizationState = {
  directionDeg: number;
  distanceMeters: number;
  signalStrength: number;
  instruction: string;
  stage: "idle" | "coarse" | "precise" | "complete";
};

export type DemoScenario = {
  id: string;
  name: string;
  captureStatus: "success" | "failed";
  localizationMode: "toward" | "reverse" | "outside";
  summary: string;
  vendors: Record<string, string>;
  frames: PacketFrame[];
};

