import { CdfChart } from "./Charts";
import type { DetectionResult, FeatureVector, TrafficGroup } from "../types";

const T = {
  title: "流量识别",
  model: "SVM 分类器",
  detected: "检测到摄像头特征",
  notDetected: "未检测到摄像头",
  confidence: "置信度",
  noCandidate: "当前数据包未出现候选 MAC",
  waitingCdf: "等待生成 CDF 曲线",
  lengthMean: "包长均值",
  dispersion: "离散度",
  burst: "突发度",
  smoothness: "平滑度",
};

export function FeaturePanel({
  group,
  vector,
  result,
}: {
  group: TrafficGroup | undefined;
  vector: FeatureVector | undefined;
  result: DetectionResult;
}) {
  const values = vector
    ? [
        ["L", vector.L, T.lengthMean],
        ["d", vector.d, T.dispersion],
        ["b", vector.b, T.burst],
        ["s", vector.s, T.smoothness],
      ]
    : [];

  return (
    <div className="panel">
      <div className="panel-title">
        <span>{T.title}</span>
        <small>{T.model}</small>
      </div>
      <div className={`result-card ${result.hasCamera ? "warn" : "ok"}`}>
        <strong>{result.hasCamera ? T.detected : T.notDetected}</strong>
        <span>
          {T.confidence} {(result.confidence * 100).toFixed(1)}%
        </span>
        <small>{result.candidateMacs[0] ?? T.noCandidate}</small>
      </div>
      {group ? <CdfChart data={group.cdf} /> : <div className="placeholder-box">{T.waitingCdf}</div>}
      <div className="feature-grid">
        {values.map(([name, value, label]) => (
          <div className="feature-cell" key={name}>
            <span>{label}</span>
            <strong>{name}</strong>
            <i style={{ width: `${Number(value) * 100}%` }} />
            <b>{Number(value).toFixed(3)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
