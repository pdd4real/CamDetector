import type { DetectionResult, LocalizationState } from "../types";

const T = {
  steps: [
    "\u6570\u636e\u91c7\u96c6",
    "\u6d41\u91cf\u8bc6\u522b",
    "\u65b9\u5411\u5b9a\u4f4d",
    "\u7cbe\u51c6\u5b9a\u4f4d",
  ],
  title: "\u6444\u50cf\u5934\u63a2\u6d4b\u5668",
  next: "\u4e0b\u4e00\u6b65",
  captureFailed: "\u6570\u636e\u91c7\u96c6\u5931\u8d25",
  captureFailedText: "\u5f53\u524d\u7f51\u7edc\u73af\u5883\u8f83\u5dee\uff0c\u65e0\u6cd5\u6355\u83b7\u6570\u636e\u5305",
  captureTitle: "\u6570\u636e\u91c7\u96c6",
  captureText: "\u6b63\u5728\u91c7\u96c6\u5468\u56f4\u7f51\u7edc\u6570\u636e\uff0c\u4fdd\u6301\u624b\u673a Wi-Fi \u5f00\u542f...",
  cameraPresent: "\u5f53\u524d\u623f\u95f4\u5185\u5b58\u5728\u6444\u50cf\u5934",
  cameraAbsent: "\u672a\u68c0\u6d4b\u5230\u6444\u50cf\u5934",
  cameraPresentHint: "\u70b9\u51fb\u4e0b\u4e00\u6b65\u7cbe\u51c6\u5b9a\u4f4d\u6444\u50cf\u5934",
  cameraAbsentHint: "\u6d41\u91cf\u5206\u7c7b\u5668\u672a\u5728\u6570\u636e\u5305\u4e2d\u68c0\u6d4b\u5230\u6444\u50cf\u5934\u7279\u5f81",
  coarse: "\u7c97\u7565\u5b9a\u4f4d",
  precise: "\u7cbe\u51c6\u5b9a\u4f4d",
  preciseDone: "\u5df2\u6807\u6ce8\u7591\u4f3c\u6444\u50cf\u5934\u4f4d\u7f6e",
  preciseRunning: "\u6b63\u5728\u7cbe\u786e\u5b9a\u4f4d\u6444\u50cf\u5934\u4f4d\u7f6e\uff0c\u8bf7\u7f13\u6162\u79fb\u52a8\u624b\u673a...",
  signal: "\u4fe1\u53f7\u5f3a\u5ea6",
  distance: "\u8ddd\u79bb",
  meter: "\u7c73",
  ok: "\u2713",
};

const roomImage = `${import.meta.env.BASE_URL}assets/demo-room.png`;

export function MobileFlow({
  stage,
  captureProgress,
  captureFailed,
  result,
  localization,
  preciseVisible,
  onNext,
  compact = false,
}: {
  stage: number;
  captureProgress: number;
  captureFailed: boolean;
  result: DetectionResult;
  localization: LocalizationState;
  preciseVisible: boolean;
  onNext: () => void;
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
      <div className="phone-card">{renderStage(stage, captureProgress, captureFailed, result, localization, preciseVisible)}</div>
      <button className="primary-action" onClick={onNext}>
        {T.next}
      </button>
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
        <div className="ring-progress" style={{ background: `conic-gradient(#4e73f8 ${captureProgress}%, #e8edf5 0)` }}>
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
      <p>{preciseVisible ? T.preciseDone : T.preciseRunning}</p>
      <div className="mini-room">
        <img src={roomImage} alt="" />
        {preciseVisible ? <i /> : null}
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
