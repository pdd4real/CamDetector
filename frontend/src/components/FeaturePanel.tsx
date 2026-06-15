import { CdfChart } from "./Charts";
import type { DetectionResult, FeatureVector, TrafficGroup } from "../types";

const T = {
  title: "\u6d41\u91cf\u8bc6\u522b",
  detected: "\u68c0\u6d4b\u5230\u6444\u50cf\u5934\u7279\u5f81",
  notDetected: "\u672a\u68c0\u6d4b\u5230\u6444\u50cf\u5934",
  confidence: "\u7f6e\u4fe1\u5ea6",
  noCandidate: "\u5f53\u524d\u6570\u636e\u5305\u672a\u51fa\u73b0\u5019\u9009 MAC",
  waitingCdf: "\u7b49\u5f85\u751f\u6210 CDF \u66f2\u7ebf",
  lengthMean: "\u5305\u957f\u5747\u503c",
  dispersion: "\u79bb\u6563\u5ea6",
  burst: "\u7a81\u53d1\u5ea6",
  smoothness: "\u5e73\u6ed1\u5ea6",
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
        <small>SVM surrogate</small>
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

