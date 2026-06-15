import { BitrateChart } from "./Charts";
import type { BitratePoint, LocalizationState } from "../types";

const T = {
  title: "方向定位",
  direction: "方向",
  signal: "信号强度",
};

export function RadarPanel({ state, bitrate }: { state: LocalizationState; bitrate: BitratePoint[] }) {
  return (
    <div className="panel">
      <div className="panel-title">
        <span>{T.title}</span>
        <small>CUSUM + motion</small>
      </div>
      <div className="radar-wrap">
        <div className="radar">
          <div className="radar-ring ring-1" />
          <div className="radar-ring ring-2" />
          <div className="radar-sweep" style={{ transform: `rotate(${state.directionDeg}deg)` }} />
          <div className="radar-dot" />
        </div>
        <div className="radar-copy">
          <strong>{state.instruction}</strong>
          <span>
            {T.direction} {state.directionDeg.toFixed(0)} deg
          </span>
          <span>
            {T.signal} {state.signalStrength}%
          </span>
        </div>
      </div>
      <BitrateChart data={bitrate} />
    </div>
  );
}

