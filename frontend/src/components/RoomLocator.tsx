import type { LocalizationState } from "../types";

const T = {
  title: "\u7cbe\u51c6\u5b9a\u4f4d",
  signal: "\u4fe1\u53f7\u5f3a\u5ea6",
  distance: "\u8ddd\u79bb",
  meter: "\u7c73",
};

export function RoomLocator({ state, visible }: { state: LocalizationState; visible: boolean }) {
  return (
    <div className="panel">
      <div className="panel-title">
        <span>{T.title}</span>
        <small>room overlay</small>
      </div>
      <div className="room-card">
        <img src="/assets/demo-room.png" alt="demo room" />
        {visible ? (
          <>
            <div className="detect-box" />
            <div className="direction-arrow">-&gt;</div>
          </>
        ) : null}
      </div>
      <div className="locator-stats">
        <div>
          <span>{T.signal}</span>
          <strong>{state.signalStrength}%</strong>
        </div>
        <div>
          <span>{T.distance}</span>
          <strong>{state.distanceMeters ? `${state.distanceMeters} ${T.meter}` : "--"}</strong>
        </div>
      </div>
    </div>
  );
}

