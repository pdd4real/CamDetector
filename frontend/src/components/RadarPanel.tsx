import { BitrateChart } from "./Charts";
import type { BitratePoint, LocalizationState } from "../types";

const T = {
  title: "\u65b9\u5411\u5b9a\u4f4d",
  direction: "\u65b9\u5411",
  signal: "\u4fe1\u53f7\u5f3a\u5ea6",
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

