import { useMemo, useState } from "react";
import demoData from "./data/demoData.json";
import { FeaturePanel } from "./components/FeaturePanel";
import { MetricBars } from "./components/Charts";
import { MobileFlow } from "./components/MobileFlow";
import { PacketTable } from "./components/PacketTable";
import { RadarPanel } from "./components/RadarPanel";
import { RoomLocator } from "./components/RoomLocator";
import {
  classifyCameraTraffic,
  detectBitrateChange,
  estimateLocalization,
  extractFeatureVector,
  groupTraffic,
} from "./lib/simulator";
import type { DemoScenario } from "./types";

const T = {
  navProject: "\u4f5c\u54c1\u4fe1\u606f",
  navArchitecture: "\u7cfb\u7edf\u67b6\u6784",
  navDemo: "\u5728\u7ebf\u6f14\u793a",
  navAlgorithms: "\u7b97\u6cd5\u6a21\u5757",
  navLocalization: "\u5b9a\u4f4d\u6a21\u5757",
  navEvaluation: "\u5b9e\u9a8c\u8bc4\u4f30",
  navRepo: "\u4ed3\u5e93\u7ed3\u6784",
  title: "\u9690\u85cf\u65e0\u7ebf\u6444\u50cf\u5934\u611f\u77e5\u4e0e\u5b9a\u4f4d\u7cfb\u7edf",
  heroText:
    "\u57fa\u4e8e\u4f5c\u54c1\u4e66\u4e2d\u7684\u7cfb\u7edf\u8bbe\u8ba1\uff0c\u5c06 Wi-Fi \u6d41\u91cf\u611f\u77e5\u3001\u6444\u50cf\u5934\u6d41\u91cf\u8bc6\u522b\u3001\u65b9\u5411\u5b9a\u4f4d\u548c\u7cbe\u51c6\u6807\u6ce8\u6574\u5408\u4e3a\u4e00\u4e2a\u53ef\u6f14\u793a\u7684\u524d\u7aef\u7f51\u7ad9\u3002",
  enterDemo: "\u8fdb\u5165\u6f14\u793a",
  viewAlgorithms: "\u67e5\u770b\u7b97\u6cd5",
  currentScenario: "\u5f53\u524d\u5b9e\u9a8c\u573a\u666f",
  frames: "\u5e27\u6570\u91cf",
  candidateMac: "\u5019\u9009 MAC",
  svmConfidence: "SVM \u7f6e\u4fe1\u5ea6",
  projectKicker: "Project",
  projectTitle: "\u4f5c\u54c1\u4fe1\u606f",
  projectText: "\u4fdd\u7559\u9879\u76ee\u5c55\u793a\u9700\u8981\u7684\u4fe1\u606f\uff0c\u4e0d\u5c55\u793a\u4efb\u4f55\u4e2a\u4eba\u8eab\u4efd\u4fe1\u606f\u3002",
  archTitle: "\u7cfb\u7edf\u5206\u5c42\u67b6\u6784",
  archText: "\u5bf9\u5e94\u4f5c\u54c1\u4e66\u4e2d\u7684\u6570\u636e\u611f\u77e5\u5c42\u3001\u6570\u636e\u5904\u7406\u5c42\u548c\u5e94\u7528\u4ea4\u4e92\u5c42\u3002",
  demoTitle: "\u5b8c\u6574\u6f14\u793a\u5b9e\u9a8c\u53f0",
  demoText: "\u5207\u6362\u573a\u666f\u540e\uff0c\u91c7\u96c6\u3001\u8bc6\u522b\u3001\u5b9a\u4f4d\u548c\u624b\u673a\u6d41\u7a0b\u4f1a\u540c\u6b65\u53d8\u5316\u3002",
  algorithmTitle: "\u7b97\u6cd5\u6a21\u5757\u62c6\u89e3",
  algorithmText: "\u7528\u53ef\u8bfb\u7684\u6a21\u62df\u4ee3\u7801\u590d\u523b\u4f5c\u54c1\u4e66\u4e2d\u7684\u7b97\u6cd5\u94fe\u8def\uff0c\u907f\u514d\u771f\u5b9e\u6293\u5305\u6216\u786c\u4ef6\u8c03\u7528\u3002",
  locTitle: "\u5b9a\u4f4d\u4ea4\u4e92\u6d41\u7a0b",
  locText: "\u4ece\u7c97\u7565\u65b9\u5411\u63d0\u793a\u5230\u623f\u95f4\u56fe\u50cf\u6807\u6ce8\uff0c\u8986\u76d6\u4f5c\u54c1\u4e66\u4e2d\u53ef\u6f14\u793a\u7684\u5b9a\u4f4d\u72b6\u6001\u3002",
  evalTitle: "\u5b9e\u9a8c\u7ed3\u679c\u9762\u677f",
  evalText: "\u4ee5\u4f5c\u54c1\u4e66\u4e2d\u7684 TPR/TNR\u3001\u52a8\u4f5c\u6301\u7eed\u65f6\u95f4\u548c\u54c1\u724c\u6837\u672c\u8868\u73b0\u4e3a\u53c2\u8003\u751f\u6210\u6f14\u793a\u6307\u6807\u3002",
  repoTitle: "\u4ee3\u7801\u6587\u4ef6\u7ec4\u7ec7",
  repoText: "\u4ed3\u5e93\u6309\u6f14\u793a\u7f51\u7ad9\u3001\u7b97\u6cd5\u6a21\u5757\u3001\u6837\u672c\u6570\u636e\u3001\u6587\u6863\u548c\u6d4b\u8bd5\u62c6\u5206\u3002",
  safetyTitle: "\u5b89\u5168\u4e0e\u9690\u79c1\u8fb9\u754c",
  safetyText: "\u672c\u6f14\u793a\u53ea\u4f7f\u7528\u5408\u6210\u6570\u636e\uff0c\u4e0d\u91c7\u96c6\u771f\u5b9e\u7f51\u7edc\u3001\u4e0d\u8fde\u63a5\u771f\u5b9e\u6444\u50cf\u5934\u3001\u4e0d\u5c55\u793a\u4e2a\u4eba\u4fe1\u606f\u3002",
};

const data = demoData as unknown as {
  scenarios: DemoScenario[];
  localization: {
    motion: { time: number; x: number; y: number }[];
    bitrateSeries: { time: number; kbps: number }[];
    precise: { directionDeg: number; distanceMeters: number; signalStrength: number };
  };
  evaluation: {
    sampleSizeCurve: { samples: number; tpr: number; tnr: number }[];
    motionDurationCurve: { duration: number; tpr: number }[];
    brandResults: { brand: string; tpr: number; tnr: number; sar: number }[];
  };
};

const projectFacts = [
  ["\u4f5c\u54c1\u540d\u79f0", "CamDetector"],
  ["\u4f5c\u54c1\u5b9a\u4f4d", "\u9690\u85cf\u65e0\u7ebf\u6444\u50cf\u5934\u611f\u77e5\u53ca\u5b9a\u4f4d\u6f14\u793a\u7cfb\u7edf"],
  ["\u5c55\u793a\u7248\u672c", "Web \u6f14\u793a\u578b\u5de5\u7a0b\u4ed3\u5e93"],
  ["\u6570\u636e\u6765\u6e90", "\u5408\u6210 802.11 \u5e27\u4e0e\u6a21\u62df\u5b9e\u9a8c\u6307\u6807"],
];

const navItems = [
  [T.navProject, "project-info"],
  [T.navArchitecture, "system-architecture"],
  [T.navDemo, "live-demo"],
  [T.navAlgorithms, "algorithm-modules"],
  [T.navLocalization, "localization-module"],
  [T.navEvaluation, "evaluation"],
  [T.navRepo, "repository"],
];

const architectureLayers = [
  {
    title: "\u5e94\u7528\u4ea4\u4e92\u5c42",
    note: "\u63d0\u793a\u79fb\u52a8\u3001\u96f7\u8fbe\u663e\u793a\u3001\u6807\u6ce8\u6444\u50cf\u5934",
    items: ["\u56db\u6b65\u5411\u5bfc", "\u72b6\u6001\u63d0\u793a", "\u96f7\u8fbe\u754c\u9762", "\u623f\u95f4\u6807\u6ce8"],
  },
  {
    title: "\u6570\u636e\u5904\u7406\u5c42",
    note: "\u6444\u50cf\u5934\u611f\u77e5\u4e0e\u6444\u50cf\u5934\u5b9a\u4f4d",
    items: ["\u6570\u636e\u9884\u5904\u7406", "\u7279\u5f81\u63d0\u53d6", "SVM \u9274\u522b", "CUSUM \u53d8\u5316\u68c0\u6d4b", "\u65b9\u5411\u4f30\u8ba1"],
  },
  {
    title: "\u6570\u636e\u611f\u77e5\u5c42",
    note: "\u6a21\u62df Libpcap/802.11 \u6570\u636e\u5305\u8f93\u5165",
    items: ["\u5305\u6293\u53d6", "\u5e27\u89e3\u6790", "MAC \u5206\u7ec4", "\u6bd4\u7279\u7387\u5e8f\u5217"],
  },
];

const algorithmModules = [
  ["\u6570\u636e\u5305\u89e3\u6790", "\u8bfb\u53d6\u65f6\u95f4\u6233\u3001\u6e90 MAC\u3001\u76ee\u6807 MAC\u3001\u5e27\u7c7b\u578b\u3001\u5305\u957f\u548c\u4fe1\u53f7\u5f3a\u5ea6\uff0c\u6309\u6e90 MAC \u5f62\u6210\u5019\u9009\u8bbe\u5907\u6d41\u3002"],
  ["\u56db\u7ef4\u7279\u5f81\u5411\u91cf", "\u8ba1\u7b97 L \u5305\u957f\u5747\u503c\u3001d \u79bb\u6563\u5ea6\u3001b \u7a81\u53d1\u5ea6\u3001s \u5e73\u6ed1\u5ea6\uff0c\u63cf\u8ff0\u6444\u50cf\u5934\u89c6\u9891\u6d41\u91cf\u5f62\u6001\u3002"],
  ["SVM \u6444\u50cf\u5934\u9274\u522b", "\u7528\u56fa\u5b9a\u6743\u91cd\u6a21\u62df\u7ebf\u6027 SVM \u8f93\u51fa\u7f6e\u4fe1\u5ea6\uff0c\u5e76\u7ed9\u51fa\u5019\u9009\u6444\u50cf\u5934 MAC \u548c\u6570\u91cf\u3002"],
  ["CUSUM \u53d8\u5316\u68c0\u6d4b", "\u5bf9\u7528\u6237\u79fb\u52a8\u8fc7\u7a0b\u4e2d\u7684\u6bd4\u7279\u7387\u53d8\u5316\u505a\u7d2f\u8ba1\u548c\u68c0\u6d4b\uff0c\u5224\u65ad\u79fb\u52a8\u662f\u5426\u5f71\u54cd\u89c6\u9891\u7f16\u7801\u6d41\u91cf\u3002"],
  ["\u5b9a\u4f4d\u4f30\u8ba1", "\u7ed3\u5408\u8fd0\u52a8\u8f68\u8ff9\u3001\u6bd4\u7279\u7387\u68af\u5ea6\u548c\u4fe1\u53f7\u5f3a\u5ea6\uff0c\u8f93\u51fa\u65b9\u5411\u3001\u8ddd\u79bb\u548c\u4e0b\u4e00\u6b65\u52a8\u4f5c\u3002"],
];

const repoModules = [
  ["frontend/", "\u5b8c\u6574\u6f14\u793a\u7f51\u7ad9\uff0c\u5305\u542b\u684c\u9762\u63a7\u5236\u53f0\u3001\u624b\u673a\u6d41\u7a0b\u548c\u514d\u5b89\u88c5 standalone \u9875\u9762\u3002"],
  ["algorithms/", "TypeScript \u98ce\u683c\u7684\u6a21\u62df\u7b97\u6cd5\u6587\u4ef6\uff0c\u5c55\u793a\u9879\u76ee\u6838\u5fc3\u5904\u7406\u94fe\u3002"],
  ["samples/", "\u6a21\u62df PCAP \u5143\u6570\u636e\u3001\u5b9a\u4f4d\u8def\u5f84\u548c\u8bc4\u4f30\u6307\u6807\u3002"],
  ["docs/", "\u7cfb\u7edf\u67b6\u6784\u3001\u7b97\u6cd5\u8bf4\u660e\u3001\u6f14\u793a\u6d41\u7a0b\u548c\u5b89\u5168\u8fb9\u754c\u3002"],
  ["tests/", "\u4e0d\u4f9d\u8d56\u524d\u7aef\u5305\u7684\u7b97\u6cd5 smoke test\u3002"],
];

const demoStages = ["\u6570\u636e\u91c7\u96c6", "\u6d41\u91cf\u8bc6\u522b", "\u65b9\u5411\u5b9a\u4f4d", "\u7cbe\u51c6\u5b9a\u4f4d"];
const flowSteps = ["\u7528\u6237\u79fb\u52a8", "\u6293\u53d6\u7a7a\u95f4\u6570\u636e\u5305", "\u63d0\u53d6\u7279\u5f81", "\u6444\u50cf\u5934\u5b58\u5728\u68c0\u6d4b", "\u65b9\u5411/\u8ddd\u79bb\u4f30\u8ba1", "\u8f93\u51fa\u5b9a\u4f4d\u7ed3\u679c"];
const safetyItems = ["\u4e0d\u6267\u884c\u771f\u5b9e Wi-Fi \u6293\u5305", "\u4e0d\u63d0\u4f9b Aircrack \u547d\u4ee4", "\u4e0d\u7834\u89e3\u7f51\u7edc", "\u4e0d\u8bbf\u95ee\u6444\u50cf\u5934", "\u4e0d\u5305\u542b\u4e2a\u4eba\u4fe1\u606f", "\u4ec5\u7528\u4e8e\u4f5c\u54c1\u5c55\u793a"];
const keywords = ["802.11", "Libpcap \u601d\u8def", "\u5305\u957f CDF", "L/d/b/s \u7279\u5f81", "SVM", "CUSUM", "\u65b9\u5411\u5b9a\u4f4d", "\u623f\u95f4\u6807\u6ce8"];

export default function App() {
  const [scenarioId, setScenarioId] = useState("camera-present");
  const [stage, setStage] = useState(0);
  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const routeKey = `${window.location.pathname}${window.location.hash}`;
  const isMobileOnly = routeKey.endsWith("/mobile") || routeKey.includes("#/mobile") || routeKey.includes("/mobile");

  const captureProgress = scenario.captureStatus === "failed" ? 14 : Math.min(100, 30 + stage * 24);
  const visibleFrames = stage === 0 ? scenario.frames.slice(0, Math.ceil((scenario.frames.length * captureProgress) / 100)) : scenario.frames;
  const groups = useMemo(() => groupTraffic(scenario.frames, scenario.vendors), [scenario]);
  const detection = useMemo(() => {
    if (scenario.captureStatus === "failed") return { hasCamera: false, confidence: 0, cameraCount: 0, candidateMacs: [] };
    const base = classifyCameraTraffic(groups);
    if (scenario.id === "no-camera") return { ...base, hasCamera: false, confidence: Math.min(base.confidence, 0.41), candidateMacs: [] };
    return base;
  }, [groups, scenario]);

  const primaryGroup = groups.find((group) => group.mac === detection.candidateMacs[0]) ?? groups[0];
  const primaryVector = primaryGroup ? extractFeatureVector(primaryGroup) : undefined;
  const bitrate = scenario.id === "reverse-needed" ? primaryGroup?.bitrateSeries ?? [] : data.localization.bitrateSeries;
  const localization = estimateLocalization(
    bitrate,
    data.localization.motion,
    scenario.id === "reverse-needed" ? 54 : data.localization.precise.signalStrength,
    scenario.localizationMode,
  );
  const cusum = detectBitrateChange(bitrate);
  const preciseVisible = stage >= 3 && detection.hasCamera && scenario.localizationMode !== "outside";

  function resetScenario(id: string) {
    setScenarioId(id);
    setStage(0);
  }

  function nextStage() {
    setStage((current) => (current >= 3 ? 0 : current + 1));
  }

  if (isMobileOnly) {
    return (
      <main className="mobile-only-page">
        <MobileFlow
          stage={stage}
          captureProgress={captureProgress}
          captureFailed={scenario.captureStatus === "failed"}
          result={detection}
          localization={localization}
          preciseVisible={preciseVisible}
          onNext={nextStage}
          compact
        />
      </main>
    );
  }

  return (
    <main className="site-shell">
      <header className="site-header">
        <nav className="module-nav" aria-label="page sections">
          {navItems.map(([label, target]) => (
            <a href={`#${target}`} key={target}>
              {label}
            </a>
          ))}
        </nav>
        <section className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">CamDetector Demo Site</p>
            <h1>{T.title}</h1>
            <p className="hero-text">{T.heroText}</p>
            <div className="hero-actions">
              <a className="solid-link" href="#live-demo">
                {T.enterDemo}
              </a>
              <a className="ghost-link" href="#algorithm-modules">
                {T.viewAlgorithms}
              </a>
            </div>
          </div>
          <div className="signal-console">
            <div className="console-head">
              <span>{T.currentScenario}</span>
              <strong>{scenario.name}</strong>
            </div>
            <div className="console-grid">
              <MetricTile label={T.frames} value={`${scenario.frames.length}`} />
              <MetricTile label={T.candidateMac} value={detection.candidateMacs[0] ?? "none"} compact />
              <MetricTile label={T.svmConfidence} value={formatPct(detection.confidence)} tone={detection.hasCamera ? "amber" : "green"} />
              <MetricTile label="CUSUM" value={cusum.triggered ? `t=${cusum.triggerTime}s` : "idle"} tone={cusum.triggered ? "blue" : "green"} />
            </div>
          </div>
        </section>
      </header>

      <section className="section-band" id="project-info">
        <SectionTitle kicker={T.projectKicker} title={T.projectTitle} text={T.projectText} />
        <div className="info-grid">
          {projectFacts.map(([label, value]) => (
            <div className="info-card" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <div className="keyword-strip">
          {keywords.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section className="section-band" id="system-architecture">
        <SectionTitle kicker="Architecture" title={T.archTitle} text={T.archText} />
        <div className="architecture-stack">
          {architectureLayers.map((layer) => (
            <div className="architecture-layer" key={layer.title}>
              <div>
                <h3>{layer.title}</h3>
                <p>{layer.note}</p>
              </div>
              <div className="layer-tags">
                {layer.items.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section-band live-demo-band" id="live-demo">
        <SectionTitle kicker="Live Lab" title={T.demoTitle} text={T.demoText} />
        <div className="scenario-row">
          {data.scenarios.map((item) => (
            <button className={item.id === scenarioId ? "scenario active" : "scenario"} key={item.id} onClick={() => resetScenario(item.id)}>
              <strong>{item.name}</strong>
              <span>{item.summary}</span>
            </button>
          ))}
        </div>
        <div className="stage-strip">
          {demoStages.map((item, index) => (
            <button className={index === stage ? "stage-pill active" : "stage-pill"} key={item} onClick={() => setStage(index)}>
              <span>{index + 1}</span>
              {item}
            </button>
          ))}
        </div>
        <section className="main-grid">
          <div className="left-stack">
            <PacketTable frames={visibleFrames} />
            <FeaturePanel group={primaryGroup} vector={primaryVector} result={detection} />
          </div>
          <MobileFlow
            stage={stage}
            captureProgress={captureProgress}
            captureFailed={scenario.captureStatus === "failed"}
            result={detection}
            localization={localization}
            preciseVisible={preciseVisible}
            onNext={nextStage}
          />
          <div className="right-stack">
            <RadarPanel state={localization} bitrate={bitrate} />
            <RoomLocator state={localization} visible={preciseVisible} />
          </div>
        </section>
      </section>

      <section className="section-band" id="algorithm-modules">
        <SectionTitle kicker="Algorithms" title={T.algorithmTitle} text={T.algorithmText} />
        <div className="module-grid">
          {algorithmModules.map(([title, text], index) => (
            <article className="module-card" key={title}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-band" id="localization-module">
        <SectionTitle kicker="Localization" title={T.locTitle} text={T.locText} />
        <div className="localization-grid">
          <div className="flow-board">
            {flowSteps.map((item, index) => (
              <div className="flow-step" key={item}>
                <span>{index + 1}</span>
                <strong>{item}</strong>
              </div>
            ))}
          </div>
          <RoomLocator state={localization} visible={preciseVisible || scenario.id === "camera-present"} />
        </div>
      </section>

      <section className="section-band" id="evaluation">
        <SectionTitle kicker="Evaluation" title={T.evalTitle} text={T.evalText} />
        <div className="eval-grid">
          <MetricBars
            title={"\u8bad\u7ec3\u6837\u672c\u6570\u91cf\u5f71\u54cd"}
            items={data.evaluation.sampleSizeCurve.map((item) => ({
              label: `${item.samples} \u7ec4 TPR`,
              value: item.tpr * 100,
              tone: "blue",
            }))}
          />
          <MetricBars
            title={"\u52a8\u4f5c\u6301\u7eed\u65f6\u95f4\u5f71\u54cd"}
            items={data.evaluation.motionDurationCurve.map((item) => ({
              label: `${item.duration}s`,
              value: item.tpr * 100,
              tone: "green",
            }))}
          />
          <MetricBars
            title={"\u54c1\u724c\u6837\u672c\u8868\u73b0"}
            items={data.evaluation.brandResults.map((item) => ({
              label: item.brand,
              value: item.sar,
              tone: "amber",
            }))}
          />
        </div>
      </section>

      <section className="section-band" id="repository">
        <SectionTitle kicker="Repository" title={T.repoTitle} text={T.repoText} />
        <div className="repo-grid">
          {repoModules.map(([path, text]) => (
            <div className="repo-row" key={path}>
              <code>{path}</code>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section-band safety-band">
        <SectionTitle kicker="Boundary" title={T.safetyTitle} text={T.safetyText} />
        <div className="safety-grid">
          {safetyItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>
    </main>
  );
}

function SectionTitle({ kicker, title, text }: { kicker: string; title: string; text: string }) {
  return (
    <div className="section-title">
      <p>{kicker}</p>
      <h2>{title}</h2>
      <span>{text}</span>
    </div>
  );
}

function MetricTile({
  label,
  value,
  tone = "blue",
  compact = false,
}: {
  label: string;
  value: string;
  tone?: "blue" | "green" | "amber";
  compact?: boolean;
}) {
  return (
    <div className={`metric-tile ${tone} ${compact ? "compact" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatPct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}
