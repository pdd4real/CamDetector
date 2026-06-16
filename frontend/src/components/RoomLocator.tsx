import type { LocalizationState } from "../types";

type RoomAngle = "left" | "center" | "right";

const T = {
  title: "精准定位",
  overlay: "房间角度",
  signal: "信号强度",
  distance: "距离",
  meter: "米",
  left: "向左",
  right: "向右",
};

const roomImages: Record<RoomAngle, string> = {
  left: `${import.meta.env.BASE_URL}assets/demo-room-left.png`,
  center: `${import.meta.env.BASE_URL}assets/demo-room.png`,
  right: `${import.meta.env.BASE_URL}assets/demo-room-right.png`,
};

export function RoomLocator({
  state,
  visible,
  angle = "center",
  hint,
  onTurnLeft,
  onTurnRight,
}: {
  state: LocalizationState;
  visible: boolean;
  angle?: RoomAngle;
  hint?: string;
  onTurnLeft?: () => void;
  onTurnRight?: () => void;
}) {
  const targetVisible = visible && angle === "center";

  return (
    <div className="panel">
      <div className="panel-title">
        <span>{T.title}</span>
        <small>{T.overlay}</small>
      </div>
      <div className="room-card">
        <img src={roomImages[angle]} alt={T.overlay} />
        {targetVisible ? (
          <>
            <div className="detect-box" />
            <div className="direction-arrow">-&gt;</div>
          </>
        ) : null}
      </div>
      {(hint || onTurnLeft || onTurnRight) && (
        <div className="angle-controls">
          <button className="chip" onClick={onTurnLeft} disabled={!onTurnLeft || angle === "left"}>
            {T.left}
          </button>
          <span>{hint}</span>
          <button className="chip" onClick={onTurnRight} disabled={!onTurnRight || angle === "right"}>
            {T.right}
          </button>
        </div>
      )}
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
