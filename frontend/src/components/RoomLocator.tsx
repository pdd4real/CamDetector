import type { LocalizationState } from "../types";

const T = {
  title: "精准定位",
  overlay: "房间标注",
  signal: "信号强度",
  distance: "距离",
  meter: "米",
};

const roomImage = `${import.meta.env.BASE_URL}assets/demo-room.png`;

export function RoomLocator({ state, visible }: { state: LocalizationState; visible: boolean }) {
  return (
    <div className="panel">
      <div className="panel-title">
        <span>{T.title}</span>
        <small>{T.overlay}</small>
      </div>
      <div className="room-card">
        <img src={roomImage} alt={T.overlay} />
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
