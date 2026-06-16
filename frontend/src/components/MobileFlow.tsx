import type { DetectionResult, LocalizationState } from "../types";

type RoomAngle = "left" | "center" | "right";

const T = {
  steps: [
    "数据采集",
    "流量识别",
    "方向定位",
    "精准定位",
  ],
  title: "摄像头探测器",
  next: "下一步",
  done: "已完成",
  reset: "重置",
  captureFailed: "数据采集失败",
  captureFailedText: "当前网络环境较差，无法捕获数据包",
  captureTitle: "数据采集",
  captureText: "正在采集周围网络数据，保持手机 Wi-Fi 开启...",
  cameraPresent: "当前房间内存在摄像头",
  cameraAbsent: "未检测到摄像头",
  cameraPresentHint: "点击下一步进入方向定位",
  cameraAbsentHint: "流量分类器未在数据包中检测到摄像头特征",
  coarse: "方向定位",
  precise: "精准定位",
  preciseDone: "已标注疑似摄像头位置",
  preciseRunning: "根据提示切换角度，直到目标方向对准...",
  signal: "信号强度",
  distance: "距离",
  meter: "米",
  ok: "✓",
};

const roomImages: Record<RoomAngle, string> = {
  left: `${import.meta.env.BASE_URL}assets/demo-room-left.png`,
  center: `${import.meta.env.BASE_URL}assets/demo-room.png`,
  right: `${import.meta.env.BASE_URL}assets/demo-room-right.png`,
};

export function MobileFlow({
  stage,
  captureProgress,
  captureFailed,
  result,
  localization,
  preciseVisible,
  onNext,
  onReset,
  canAdvance = true,
  roomAngle = "center",
  angleHint,
  onTurnLeft,
  onTurnRight,
  compact = false,
}: {
  stage: number;
  captureProgress: number;
  captureFailed: boolean;
  result: DetectionResult;
  localization: LocalizationState;
  preciseVisible: boolean;
  onNext: () => void;
  onReset?: () => void;
  canAdvance?: boolean;
  roomAngle?: RoomAngle;
  angleHint?: string;
  onTurnLeft?: () => void;
  onTurnRight?: () => void;
  compact?: boolean;
}) {
  return (
    <section className={`phone ${compact ? "compact-phone" : ""}`}>
      <header className="phone-title">{T.title}</header>
      <div className="stepper">
        {T.steps.map((label, index) => (
          <div className={`step ${index <= stage ? "active" : ""}`} key={label}>
            <b>{index + 1}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="phone-card">
        {renderStage(stage, captureProgress, captureFailed, result, localization, preciseVisible, roomAngle, angleHint, onTurnLeft, onTurnRight)}
      </div>
      <div className="phone-actions">
        <button className="primary-action" onClick={onNext} disabled={!canAdvance}>
          {canAdvance ? T.next : T.done}
        </button>
        {onReset && (
          <button className="ghost-action dark" onClick={onReset}>
            {T.reset}
          </button>
        )}
      </div>
    </section>
  );
}

function renderStage(
  stage: number,
  captureProgress: number,
  captureFailed: boolean,
  result: DetectionResult,
  localization: LocalizationState,
  preciseVisible: boolean,
  roomAngle: RoomAngle,
  angleHint: string | undefined,
  onTurnLeft: (() => void) | undefined,
  onTurnRight: (() => void) | undefined,
) {
  if (stage === 0) {
    return captureFailed ? (
      <div className="state-message fail">
        <b>!</b>
        <strong>{T.captureFailed}</strong>
        <span>{T.captureFailedText}</span>
      </div>
    ) : (
      <div className="collecting">
        <h3>{T.captureTitle}</h3>
        <p>{T.captureText}</p>
        <div
          className="ring-progress"
          style={{
            background: `conic-gradient(var(--neon-cyan, #00ffcc) ${captureProgress}%, rgba(255,255,255,0.08) 0)`,
          }}
        >
          <span>{captureProgress}%</span>
        </div>
      </div>
    );
  }

  if (stage === 1) {
    return (
      <div className={`state-message ${result.hasCamera ? "warn" : "ok"}`}>
        <b>{result.hasCamera ? "!" : T.ok}</b>
        <strong>{result.hasCamera ? T.cameraPresent : T.cameraAbsent}</strong>
        <span>{result.hasCamera ? T.cameraPresentHint : T.cameraAbsentHint}</span>
      </div>
    );
  }

  if (stage === 2) {
    return (
      <div className="coarse-card">
        <h3>{T.coarse}</h3>
        <p>{localization.instruction}</p>
        <div className="phone-radar">
          <i style={{ transform: `rotate(${localization.directionDeg}deg)` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="precise-card">
      <h3>{T.precise}</h3>
      <p>{preciseVisible && roomAngle === "center" ? T.preciseDone : angleHint || T.preciseRunning}</p>
      <div className="mini-room">
        <img src={roomImages[roomAngle]} alt="" />
        {preciseVisible && roomAngle === "center" ? <i /> : null}
      </div>
      <div className="angle-controls mini-angle-controls">
        <button className="chip" onClick={onTurnLeft} disabled={!onTurnLeft || roomAngle === "left"}>向左</button>
        <button className="chip" onClick={onTurnRight} disabled={!onTurnRight || roomAngle === "right"}>向右</button>
      </div>
      <div className="mini-stats">
        <span>
          {T.signal} {localization.signalStrength}%
        </span>
        <span>
          {T.distance} {localization.distanceMeters || 1.68} {T.meter}
        </span>
      </div>
    </div>
  );
}
