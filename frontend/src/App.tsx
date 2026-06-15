import { useEffect, useMemo, useState } from "react";
import demoData from "./data/demoData.json";
import { BitrateChart, CdfChart, MetricBars } from "./components/Charts";
import { FeaturePanel } from "./components/FeaturePanel";
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

type PageId = "overview" | "detection" | "localization" | "mobile" | "algorithms" | "evaluation" | "repository";

const pageOrder: PageId[] = ["overview", "detection", "localization", "mobile", "algorithms", "evaluation", "repository"];

const T = {
  brand: "CamDetector",
  tagline: "\u9690\u85cf\u65e0\u7ebf\u6444\u50cf\u5934\u611f\u77e5\u4e0e\u5b9a\u4f4d\u7cfb\u7edf",
  intro:
    "\u7cfb\u7edf\u91c7\u7528 802.11 \u6d41\u91cf\u7279\u5f81\u3001SVM \u8bc6\u522b\u548c CUSUM \u8d8b\u52bf\u68c0\u6d4b\u5b8c\u6210\u6444\u50cf\u5934\u767c\u73b0\u4e0e\u5b9a\u4f4d\u6f14\u793a\u3002",
  primaryAction: "\u8fdb\u5165\u63a7\u5236\u53f0",
  secondaryAction: "\u67e5\u770b\u5b9a\u4f4d\u7ebf\u8def",
  detectionTitle: "\u6444\u50cf\u5934\u8bc6\u522b",
  localizationTitle: "\u5b9a\u4f4d\u4f30\u8ba1",
  algorithmTitle: "\u7279\u5f81\u4e0e\u51b3\u7b56",
  evaluationTitle: "\u5b9e\u9a8c\u7ed3\u679c",
  repositoryTitle: "\u4ed3\u5e93\u7ec4\u6210",
  routeLabel: "\u9875\u9762",
  mobileLabel: "\u624b\u673a\u6d41\u7a0b",
  scenarioLabel: "\u73b0\u573a\u573a\u666f",
  controlLabel: "\u53ef\u4ea4\u4e92\u63a7\u5236",
  captureLabel: "\u91c7\u96c6\u8fdb\u5ea6",
  confidenceLabel: "\u7f6e\u4fe1\u5ea6",
  statusLabel: "\u72b6\u6001",
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

const routes: { id: PageId; label: string; hint: string }[] = [
  { id: "overview", label: "\u603b\u89c8", hint: "\u4e3b\u9898\u53ca\u6838\u5fc3\u80fd\u529b" },
  { id: "detection", label: "\u8bc6\u522b", hint: "\u5e27\u8868\u3001CDF \u548c SVM \u5224\u65ad" },
  { id: "localization", label: "\u5b9a\u4f4d", hint: "\u65b9\u5411\u3001\u8ddd\u79bb\u548c\u6807\u6ce8" },
  { id: "mobile", label: "\u624b\u673a", hint: "\u9002\u5408\u5c55\u793a\u548c\u5f55\u5c4f" },
  { id: "algorithms", label: "\u7b97\u6cd5", hint: "\u7279\u5f81\u63d0\u53d6\u548c\u68c0\u6d4b\u6570\u5b66" },
  { id: "evaluation", label: "\u8bc4\u4f30", hint: "\u6837\u672c\u6570\u3001\u6301\u7eed\u65f6\u95f4\u548c\u54c1\u724c\u8868\u73b0" },
  { id: "repository", label: "\u4ed3\u5e93", hint: "\u76ee\u5f55\u3001\u6587\u6863\u548c\u5b89\u5168\u8fb9\u754c" },
];

const scenarios = data.scenarios;
const pageTokens = new Set<PageId>(pageOrder);

export default function App() {
  const [page, setPage] = useState<PageId>(() => readPageFromLocation());
  const [scenarioId, setScenarioId] = useState("camera-present");
  const [stage, setStage] = useState(0);
  const [showInspector, setShowInspector] = useState(false);
  const [motionMode, setMotionMode] = useState<"toward" | "reverse" | "outside">("toward");
  const [evaluationView, setEvaluationView] = useState<"sample" | "duration" | "brand">("sample");
  const [autoPulse, setAutoPulse] = useState(false);

  useEffect(() => {
    const syncPage = () => setPage(readPageFromLocation());
    syncPage();
    window.addEventListener("hashchange", syncPage);
    window.addEventListener("popstate", syncPage);
    return () => {
      window.removeEventListener("hashchange", syncPage);
      window.removeEventListener("popstate", syncPage);
    };
  }, []);

  const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];
  const groups = useMemo(() => groupTraffic(scenario.frames, scenario.vendors), [scenario]);
  const detection = useMemo(() => {
    if (scenario.captureStatus === "failed") return { hasCamera: false, confidence: 0, cameraCount: 0, candidateMacs: [] };
    const base = classifyCameraTraffic(groups);
    if (scenario.id === "no-camera") return { ...base, hasCamera: false, confidence: Math.min(base.confidence, 0.41), candidateMacs: [] };
    return base;
  }, [groups, scenario]);

  const primaryGroup = groups.find((group) => group.mac === detection.candidateMacs[0]) ?? groups[0];
  const primaryVector = primaryGroup ? extractFeatureVector(primaryGroup) : undefined;
  const captureProgress = scenario.captureStatus === "failed" ? 16 : Math.min(100, 18 + stage * 26 + (autoPulse ? 12 : 0));
  const visibleFrames = stage === 0 ? scenario.frames.slice(0, Math.max(1, Math.ceil((scenario.frames.length * captureProgress) / 100))) : scenario.frames;
  const bitrate = scenario.id === "reverse-needed" ? primaryGroup?.bitrateSeries ?? [] : data.localization.bitrateSeries;
  const localization = estimateLocalization(
    bitrate,
    data.localization.motion,
    motionMode === "outside" ? 31 : motionMode === "reverse" ? 54 : data.localization.precise.signalStrength,
    motionMode,
  );
  const cusum = detectBitrateChange(bitrate);
  const preciseVisible = page === "localization" && (stage >= 3 || scenario.id === "camera-present" || scenario.id === "reverse-needed");
  const stageLabel = page === "overview" ? "overview" : page === "detection" ? "detection" : page === "localization" ? "localization" : page;

  function nextStage() {
    setStage((current) => (current >= 3 ? 0 : current + 1));
  }

  const pageIndex = pageOrder.indexOf(page);

  function goToPage(next: PageId) {
    setPage(next);
    window.location.hash = next === "overview" ? "" : `/${next}`;
  }

  return (
    <main className="app-shell">
      <aside className="side-rail">
        <div className="brand-lockup">
          <p>Project Interface</p>
          <h1>{T.brand}</h1>
          <span>{T.intro}</span>
        </div>

        <nav className="route-nav" aria-label="page navigation">
          {routes.map((route, index) => (
            <button
              key={route.id}
              className={route.id === page ? "route-card active" : "route-card"}
              onClick={() => goToPage(route.id)}
            >
              <strong>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {route.label}
              </strong>
              <small>{route.hint}</small>
            </button>
          ))}
        </nav>

        <div className="side-status">
          <div>
            <span>{T.routeLabel}</span>
            <strong>{routes[pageIndex]?.label ?? T.brand}</strong>
          </div>
          <div>
            <span>{T.scenarioLabel}</span>
            <strong>{scenario.name}</strong>
          </div>
          <div>
            <span>{T.confidenceLabel}</span>
            <strong>{formatPct(detection.confidence)}</strong>
          </div>
          <div>
            <span>{T.statusLabel}</span>
            <strong>{scenario.captureStatus === "failed" ? "\u91c7\u96c6\u5931\u8d25" : detection.hasCamera ? "\u5df2\u68c0\u6d4b" : "\u672a\u68c0\u6d4b"}</strong>
          </div>
        </div>
      </aside>

      <section className="content-shell">
        <header className="hero-panel">
          <div className="hero-copy">
            <p className="eyebrow">{T.tagline}</p>
            <h2>{T.brand}</h2>
            <p>{T.intro}</p>
            <div className="hero-actions">
              <button className="primary-action" onClick={() => goToPage("detection")}>
                {T.primaryAction}
              </button>
              <button className="ghost-action" onClick={() => goToPage("localization")}>
                {T.secondaryAction}
              </button>
            </div>
          </div>

          <div className="hero-dashboard">
            <div className="hero-metric large">
              <span>{T.captureLabel}</span>
              <strong>{captureProgress}%</strong>
              <i style={{ width: `${captureProgress}%` }} />
            </div>
            <div className="hero-metric">
              <span>{T.confidenceLabel}</span>
              <strong>{formatPct(detection.confidence)}</strong>
            </div>
            <div className="hero-metric">
              <span>CASCADE</span>
              <strong>{cusum.triggered ? `t=${cusum.triggerTime}s` : "idle"}</strong>
            </div>
            <div className="hero-metric">
              <span>{T.statusLabel}</span>
              <strong>{scenario.captureStatus === "failed" ? "\u5931\u8d25" : detection.hasCamera ? "\u5b58\u5728" : "\u672a\u53d1\u73b0"}</strong>
            </div>
          </div>
        </header>

        <section className="page-shell">
          {page === "overview" ? (
            <OverviewPage
              scenario={scenario}
              detection={detection}
              localization={localization}
              onOpenDetection={() => goToPage("detection")}
              onOpenLocalization={() => goToPage("localization")}
              onOpenAlgorithms={() => goToPage("algorithms")}
              onOpenEvaluation={() => goToPage("evaluation")}
            />
          ) : null}

          {page === "detection" ? (
            <DetectionPage
              scenario={scenario}
              scenarioId={scenarioId}
              setScenarioId={(id) => {
                setScenarioId(id);
                setStage(0);
              }}
              stage={stage}
              setStage={setStage}
              captureProgress={captureProgress}
              visibleFrames={visibleFrames}
              groups={groups}
              primaryGroup={primaryGroup}
              primaryVector={primaryVector}
              detection={detection}
              showInspector={showInspector}
              setShowInspector={setShowInspector}
              autoPulse={autoPulse}
              setAutoPulse={setAutoPulse}
              cusum={cusum}
              onNext={nextStage}
            />
          ) : null}

          {page === "localization" ? (
            <LocalizationPage
              scenario={scenario}
              scenarioId={scenarioId}
              stage={stage}
              setStage={setStage}
              motionMode={motionMode}
              setMotionMode={setMotionMode}
              localization={localization}
              bitrate={bitrate}
              preciseVisible={preciseVisible}
              onNext={nextStage}
              detection={detection}
            />
          ) : null}

          {page === "mobile" ? (
            <MobilePage
              scenario={scenario}
              scenarioId={scenarioId}
              setScenarioId={(id) => {
                setScenarioId(id);
                setStage(0);
              }}
              stage={stage}
              setStage={setStage}
              captureProgress={captureProgress}
              detection={detection}
              localization={localization}
              preciseVisible={preciseVisible}
              onNext={nextStage}
              motionMode={motionMode}
              setMotionMode={setMotionMode}
              cusum={cusum}
              autoPulse={autoPulse}
              setAutoPulse={setAutoPulse}
              showInspector={showInspector}
              setShowInspector={setShowInspector}
              groups={groups}
              primaryGroup={primaryGroup}
              primaryVector={primaryVector}
            />
          ) : null}

          {page === "algorithms" ? (
            <AlgorithmsPage
              scenario={scenario}
              groups={groups}
              primaryGroup={primaryGroup}
              primaryVector={primaryVector}
              detection={detection}
              localization={localization}
              bitrate={bitrate}
              cusum={cusum}
            />
          ) : null}

          {page === "evaluation" ? (
            <EvaluationPage
              evaluationView={evaluationView}
              setEvaluationView={setEvaluationView}
              data={data.evaluation}
            />
          ) : null}

          {page === "repository" ? <RepositoryPage /> : null}
        </section>
      </section>
    </main>
  );
}

function OverviewPage({
  scenario,
  detection,
  localization,
  onOpenDetection,
  onOpenLocalization,
  onOpenAlgorithms,
  onOpenEvaluation,
}: {
  scenario: DemoScenario;
  detection: ReturnType<typeof classifyCameraTraffic>;
  localization: ReturnType<typeof estimateLocalization>;
  onOpenDetection: () => void;
  onOpenLocalization: () => void;
  onOpenAlgorithms: () => void;
  onOpenEvaluation: () => void;
}) {
  const cards = [
    {
      title: "\u8bc6\u522b\u901a\u9053",
      text: "\u5c55\u793a 802.11 \u5e27\u5217\u3001CDF \u66f2\u7ebf\u548c SVM \u51b3\u7b56\uff0c\u53ef\u4ee5\u76f4\u63a5\u5207\u6362\u573a\u666f\u770b\u7ed3\u679c\u3002",
      action: onOpenDetection,
      button: "\u6253\u5f00\u8bc6\u522b",
    },
    {
      title: "\u5b9a\u4f4d\u901a\u9053",
      text: "\u5c55\u793a\u65b9\u5411\u3001\u4fe1\u53f7\u548c\u8ddd\u79bb\uff0c\u5305\u542b\u7c97\u7565\u4e0e\u7cbe\u51c6\u5b9a\u4f4d\u4e24\u4e2a\u5c42\u6b21\u3002",
      action: onOpenLocalization,
      button: "\u6253\u5f00\u5b9a\u4f4d",
    },
    {
      title: "\u7b97\u6cd5\u53ef\u89c6\u5316",
      text: "\u5c06\u7279\u5f81\u5411\u91cf\u3001CUSUM \u53d8\u5316\u548c\u6d41\u7a0b\u529b\u5ea6\u653e\u5728\u540c\u4e00\u9875\u67b6\u91cc\u4fbf\u4e8e\u6f14\u793a\u3002",
      action: onOpenAlgorithms,
      button: "\u67e5\u770b\u7b97\u6cd5",
    },
    {
      title: "\u5b9e\u9a8c\u8bc4\u4f30",
      text: "\u8fc7\u7a0b\u5185\u53ef\u76f4\u63a5\u5207\u6362\u6a21\u62df\u6307\u6807\uff0c\u770b\u5f97\u5230\u4e0d\u540c\u6837\u672c\u6c34\u5e73\u7684\u8d8b\u52bf\u3002",
      action: onOpenEvaluation,
      button: "\u6253\u5f00\u8bc4\u4f30",
    },
  ];

  return (
    <div className="page-grid overview-grid">
      <section className="module-card hero-feature">
        <div className="module-head">
          <span>01</span>
          <strong>\u57fa\u672c\u72b6\u6001</strong>
        </div>
        <div className="scenario-chip">{scenario.name}</div>
        <div className="status-grid">
          <div>
            <span>\u5019\u9009 MAC</span>
            <strong>{detection.candidateMacs[0] ?? "\u65e0"}</strong>
          </div>
          <div>
            <span>\u7f6e\u4fe1\u5ea6</span>
            <strong>{formatPct(detection.confidence)}</strong>
          </div>
          <div>
            <span>\u65b9\u5411</span>
            <strong>{localization.directionDeg.toFixed(0)} deg</strong>
          </div>
          <div>
            <span>\u8ddd\u79bb</span>
            <strong>{localization.distanceMeters} m</strong>
          </div>
        </div>
      </section>

      <section className="feature-grid-cards">
        {cards.map((card) => (
          <button className="portal-card" key={card.title} onClick={card.action}>
            <strong>{card.title}</strong>
            <span>{card.text}</span>
            <i>{card.button}</i>
          </button>
        ))}
      </section>
    </div>
  );
}

function DetectionPage({
  scenario,
  scenarioId,
  setScenarioId,
  stage,
  setStage,
  captureProgress,
  visibleFrames,
  groups,
  primaryGroup,
  primaryVector,
  detection,
  showInspector,
  setShowInspector,
  autoPulse,
  setAutoPulse,
  cusum,
  onNext,
}: {
  scenario: DemoScenario;
  scenarioId: string;
  setScenarioId: (id: string) => void;
  stage: number;
  setStage: (value: number | ((current: number) => number)) => void;
  captureProgress: number;
  visibleFrames: DemoScenario["frames"];
  groups: ReturnType<typeof groupTraffic>;
  primaryGroup: ReturnType<typeof groupTraffic>[number] | undefined;
  primaryVector: ReturnType<typeof extractFeatureVector> | undefined;
  detection: ReturnType<typeof classifyCameraTraffic>;
  showInspector: boolean;
  setShowInspector: (value: boolean) => void;
  autoPulse: boolean;
  setAutoPulse: (value: boolean) => void;
  cusum: ReturnType<typeof detectBitrateChange>;
  onNext: () => void;
}) {
  return (
    <div className="page-grid detection-grid">
      <section className="module-card wide">
        <div className="module-head">
          <span>02</span>
          <strong>\u6570\u636e\u91c7\u96c6\u4e0e\u8bc6\u522b</strong>
        </div>
        <div className="scenario-row-compact">
          {scenarios.map((item) => (
            <button className={item.id === scenarioId ? "scenario active" : "scenario"} key={item.id} onClick={() => setScenarioId(item.id)}>
              <strong>{item.name}</strong>
              <span>{item.summary}</span>
            </button>
          ))}
        </div>
        <div className="interactive-strip">
          <button className={showInspector ? "control-chip active" : "control-chip"} onClick={() => setShowInspector(!showInspector)}>
            {showInspector ? "\u9690\u85cf\u63a7\u5236\u9762\u677f" : "\u663e\u793a\u63a7\u5236\u9762\u677f"}
          </button>
          <button className={autoPulse ? "control-chip active" : "control-chip"} onClick={() => setAutoPulse(!autoPulse)}>
            {autoPulse ? "\u5173\u95ed\u81ea\u52a8\u58f0\u660e" : "\u5f00\u542f\u81ea\u52a8\u58f0\u660e"}
          </button>
          <button className="control-chip" onClick={() => setStage(0)}>
            \u91cd\u7f6e\u6d41\u7a0b
          </button>
          <button className="control-chip" onClick={onNext}>
            \u6b65\u9aa4\u5207\u6362
          </button>
        </div>
      </section>

      {showInspector ? (
        <section className="module-card wide inspector-panel">
          <div className="module-head">
            <span>{T.controlLabel}</span>
            <strong>\u76d1\u63a7\u72b6\u6001</strong>
          </div>
          <div className="inspector-grid">
            <div>
              <span>\u91c7\u96c6\u8fdb\u5ea6</span>
              <strong>{captureProgress}%</strong>
            </div>
            <div>
              <span>\u5019\u9009\u7ec4</span>
              <strong>{detection.candidateMacs[0] ?? "\u65e0"}</strong>
            </div>
            <div>
              <span>\u6444\u50cf\u5934\u6570\u91cf</span>
              <strong>{detection.cameraCount}</strong>
            </div>
            <div>
              <span>CUSUM</span>
              <strong>{cusum.triggered ? `t=${cusum.triggerTime}s` : "idle"}</strong>
            </div>
          </div>
        </section>
      ) : null}

      <section className="content-grid">
        <PacketTable frames={visibleFrames} />
        <FeaturePanel group={primaryGroup} vector={primaryVector} result={detection} />
      </section>

      <section className="content-grid">
        <MobileFlow
          stage={stage}
          captureProgress={captureProgress}
          captureFailed={scenario.captureStatus === "failed"}
          result={detection}
          localization={estimateLocalization(primaryGroup?.bitrateSeries ?? [], data.localization.motion, 87, "toward")}
          preciseVisible={scenario.id !== "capture-failed"}
          onNext={onNext}
        />
        <div className="module-card">
          <div className="module-head">
            <span>03</span>
            <strong>\u89e3\u6790\u7ed3\u679c</strong>
          </div>
          <CdfChart data={primaryGroup?.cdf ?? []} />
          <BitrateChart data={primaryGroup?.bitrateSeries ?? []} />
        </div>
      </section>

      <section className="content-grid">
        <RadarPanel state={estimateLocalization(primaryGroup?.bitrateSeries ?? [], data.localization.motion, 87, "toward")} bitrate={primaryGroup?.bitrateSeries ?? data.localization.bitrateSeries} />
        <RoomLocator state={estimateLocalization(primaryGroup?.bitrateSeries ?? [], data.localization.motion, 87, "toward")} visible={scenario.id !== "capture-failed"} />
      </section>
    </div>
  );
}

function LocalizationPage({
  scenario,
  scenarioId,
  stage,
  setStage,
  motionMode,
  setMotionMode,
  localization,
  bitrate,
  preciseVisible,
  onNext,
  detection,
}: {
  scenario: DemoScenario;
  scenarioId: string;
  stage: number;
  setStage: (value: number | ((current: number) => number)) => void;
  motionMode: "toward" | "reverse" | "outside";
  setMotionMode: (value: "toward" | "reverse" | "outside") => void;
  localization: ReturnType<typeof estimateLocalization>;
  bitrate: ReturnType<typeof groupTraffic>[number]["bitrateSeries"];
  preciseVisible: boolean;
  onNext: () => void;
  detection: ReturnType<typeof classifyCameraTraffic>;
}) {
  return (
    <div className="page-grid localization-grid-page">
      <section className="module-card wide">
        <div className="module-head">
          <span>03</span>
          <strong>{T.localizationTitle}</strong>
        </div>
        <div className="interactive-strip">
          {(["toward", "reverse", "outside"] as const).map((mode) => (
            <button key={mode} className={motionMode === mode ? "control-chip active" : "control-chip"} onClick={() => setMotionMode(mode)}>
              {mode === "toward" ? "\u6b63\u5411\u9760\u8fd1" : mode === "reverse" ? "\u53cd\u5411\u79fb\u52a8" : "\u623f\u95f4\u5916"}
            </button>
          ))}
          <button className="control-chip" onClick={() => setStage(0)}>
            \u6062\u590d\u7b2c\u4e00\u6b65
          </button>
          <button className="control-chip" onClick={onNext}>
            \u89e3\u9501\u4e0b\u4e00\u6b65
          </button>
        </div>
      </section>

      <section className="content-grid localization-top">
        <RadarPanel state={localization} bitrate={bitrate} />
        <RoomLocator state={localization} visible={preciseVisible} />
      </section>

      <section className="content-grid">
        <div className="module-card">
          <div className="module-head">
            <span>04</span>
            <strong>\u65b9\u5411\u7ed3\u8bba</strong>
          </div>
          <div className="direction-summary">
            <div>
              <span>\u5f53\u524d\u573a\u666f</span>
              <strong>{scenario.name}</strong>
            </div>
            <div>
              <span>\u65b9\u5411\u89d2\u5ea6</span>
              <strong>{localization.directionDeg.toFixed(1)} deg</strong>
            </div>
            <div>
              <span>\u4fe1\u53f7\u5f3a\u5ea6</span>
              <strong>{localization.signalStrength}%</strong>
            </div>
            <div>
              <span>\u8ddd\u79bb</span>
              <strong>{localization.distanceMeters} m</strong>
            </div>
          </div>
          <p className="module-note">{localization.instruction}</p>
        </div>

        <div className="module-card">
          <div className="module-head">
            <span>05</span>
            <strong>\u8bc6\u522b\u7ed3\u679c</strong>
          </div>
          <div className={detection.hasCamera ? "result-banner warn" : "result-banner ok"}>
            <strong>{detection.hasCamera ? "\u68c0\u6d4b\u5230\u6444\u50cf\u5934" : "\u672a\u68c0\u6d4b\u5230\u6444\u50cf\u5934"}</strong>
            <span>{formatPct(detection.confidence)}</span>
          </div>
        </div>
      </section>

      <section className="module-card wide">
        <div className="module-head">
          <span>{T.mobileLabel}</span>
          <strong>\u624b\u673a\u753b\u9762</strong>
        </div>
        <MobileFlow
          stage={stage}
          captureProgress={scenario.captureStatus === "failed" ? 20 : 88}
          captureFailed={scenario.captureStatus === "failed"}
          result={detection}
          localization={localization}
          preciseVisible={preciseVisible}
          onNext={onNext}
        />
      </section>
    </div>
  );
}

function MobilePage({
  scenario,
  scenarioId,
  setScenarioId,
  stage,
  setStage,
  captureProgress,
  detection,
  localization,
  preciseVisible,
  onNext,
  motionMode,
  setMotionMode,
  cusum,
  autoPulse,
  setAutoPulse,
  showInspector,
  setShowInspector,
  groups,
  primaryGroup,
  primaryVector,
}: {
  scenario: DemoScenario;
  scenarioId: string;
  setScenarioId: (id: string) => void;
  stage: number;
  setStage: (value: number | ((current: number) => number)) => void;
  captureProgress: number;
  detection: ReturnType<typeof classifyCameraTraffic>;
  localization: ReturnType<typeof estimateLocalization>;
  preciseVisible: boolean;
  onNext: () => void;
  motionMode: "toward" | "reverse" | "outside";
  setMotionMode: (value: "toward" | "reverse" | "outside") => void;
  cusum: ReturnType<typeof detectBitrateChange>;
  autoPulse: boolean;
  setAutoPulse: (value: boolean) => void;
  showInspector: boolean;
  setShowInspector: (value: boolean) => void;
  groups: ReturnType<typeof groupTraffic>;
  primaryGroup: ReturnType<typeof groupTraffic>[number] | undefined;
  primaryVector: ReturnType<typeof extractFeatureVector> | undefined;
}) {
  return (
    <div className="page-grid mobile-grid">
      <section className="module-card wide">
        <div className="module-head">
          <span>04</span>
          <strong>{T.mobileLabel}</strong>
        </div>
        <div className="interactive-strip">
          {scenarios.map((item) => (
            <button key={item.id} className={scenarioId === item.id ? "control-chip active" : "control-chip"} onClick={() => setScenarioId(item.id)}>
              {item.name}
            </button>
          ))}
          <button className="control-chip" onClick={() => setStage(0)}>
            \u56de\u5230\u91c7\u96c6
          </button>
          <button className="control-chip" onClick={() => setStage(3)}>
            \u76f4\u8fbe\u6807\u6ce8
          </button>
        </div>
      </section>

      <section className="mobile-stage-layout">
        <MobileFlow
          stage={stage}
          captureProgress={captureProgress}
          captureFailed={scenario.captureStatus === "failed"}
          result={detection}
          localization={localization}
          preciseVisible={preciseVisible || stage >= 3}
          onNext={onNext}
          compact
        />

        <div className="module-card mobile-control-board">
          <div className="module-head">
            <span>{T.controlLabel}</span>
            <strong>\u5c55\u793a\u63a7\u5236</strong>
          </div>
          <div className="direction-summary">
            <div>
              <span>\u5f53\u524d\u9636\u6bb5</span>
              <strong>{stage + 1} / 4</strong>
            </div>
            <div>
              <span>\u5019\u9009\u7ec4</span>
              <strong>{groups.length}</strong>
            </div>
            <div>
              <span>CUSUM</span>
              <strong>{cusum.triggered ? "\u89e6\u53d1" : "idle"}</strong>
            </div>
            <div>
              <span>\u5f53\u524d\u573a\u666f</span>
              <strong>{scenario.name}</strong>
            </div>
          </div>
          <div className="interactive-strip stacked">
            {(["toward", "reverse", "outside"] as const).map((mode) => (
              <button key={mode} className={motionMode === mode ? "control-chip active" : "control-chip"} onClick={() => setMotionMode(mode)}>
                {mode === "toward" ? "\u6b63\u5411" : mode === "reverse" ? "\u53cd\u5411" : "\u65e0\u76ee\u6807"}
              </button>
            ))}
            <button className={autoPulse ? "control-chip active" : "control-chip"} onClick={() => setAutoPulse(!autoPulse)}>
              \u8fdb\u5ea6\u589e\u5f3a
            </button>
            <button className={showInspector ? "control-chip active" : "control-chip"} onClick={() => setShowInspector(!showInspector)}>
              \u5207\u6362\u8be6\u60c5
            </button>
          </div>
          {showInspector ? <FeaturePanel group={primaryGroup} vector={primaryVector} result={detection} /> : null}
        </div>
      </section>
    </div>
  );
}

function AlgorithmsPage({
  scenario,
  groups,
  primaryGroup,
  primaryVector,
  detection,
  localization,
  bitrate,
  cusum,
}: {
  scenario: DemoScenario;
  groups: ReturnType<typeof groupTraffic>;
  primaryGroup: ReturnType<typeof groupTraffic>[number] | undefined;
  primaryVector: ReturnType<typeof extractFeatureVector> | undefined;
  detection: ReturnType<typeof classifyCameraTraffic>;
  localization: ReturnType<typeof estimateLocalization>;
  bitrate: ReturnType<typeof groupTraffic>[number]["bitrateSeries"];
  cusum: ReturnType<typeof detectBitrateChange>;
}) {
  return (
    <div className="page-grid algorithms-grid">
      <section className="module-card wide">
        <div className="module-head">
          <span>04</span>
          <strong>{T.algorithmTitle}</strong>
        </div>
        <div className="algorithm-map">
          <div>
            <span>\u67e5\u770b\u573a\u666f</span>
            <strong>{scenario.name}</strong>
          </div>
          <div>
            <span>\u5019\u9009\u6570</span>
            <strong>{groups.length}</strong>
          </div>
          <div>
            <span>\u6444\u50cf\u5934</span>
            <strong>{detection.cameraCount}</strong>
          </div>
          <div>
            <span>CUSUM</span>
            <strong>{cusum.triggered ? "\u5df2\u89e6\u53d1" : "\u672a\u89e6\u53d1"}</strong>
          </div>
        </div>
      </section>

      <section className="content-grid">
        <FeaturePanel group={primaryGroup} vector={primaryVector} result={detection} />
        <div className="module-card">
          <div className="module-head">
            <span>05</span>
            <strong>\u5b9a\u4f4d\u7ed3\u679c</strong>
          </div>
          <RadarPanel state={localization} bitrate={bitrate} />
        </div>
      </section>

      <section className="content-grid">
        <div className="module-card">
          <div className="module-head">
            <span>06</span>
            <strong>\u7279\u5f81\u5411\u91cf</strong>
          </div>
          <div className="vector-grid">
            {primaryVector
              ? [
                  ["L", primaryVector.L],
                  ["d", primaryVector.d],
                  ["b", primaryVector.b],
                  ["s", primaryVector.s],
                ].map(([name, value]) => (
                  <div key={name} className="vector-card">
                    <span>{name}</span>
                    <strong>{Number(value).toFixed(3)}</strong>
                  </div>
                ))
              : null}
          </div>
        </div>
        <div className="module-card">
          <div className="module-head">
            <span>07</span>
            <strong>Bitrate / CUSUM</strong>
          </div>
          <BitrateChart data={bitrate} />
          <div className="cusum-mini">
            {cusum.scoreSeries.slice(-4).map((item) => (
              <div key={item.time}>
                <span>{item.time}s</span>
                <strong>{item.score}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function EvaluationPage({
  evaluationView,
  setEvaluationView,
  data,
}: {
  evaluationView: "sample" | "duration" | "brand";
  setEvaluationView: (value: "sample" | "duration" | "brand") => void;
  data: {
    sampleSizeCurve: { samples: number; tpr: number; tnr: number }[];
    motionDurationCurve: { duration: number; tpr: number }[];
    brandResults: { brand: string; tpr: number; tnr: number; sar: number }[];
  };
}) {
  const viewMap = {
    sample: {
      title: "\u6837\u672c\u6570\u91cf",
      items: data.sampleSizeCurve.map((item) => ({ label: `${item.samples}\u7ec4`, value: item.tpr * 100, tone: "blue" as const })),
    },
    duration: {
      title: "\u52a8\u4f5c\u6301\u7eed\u65f6\u95f4",
      items: data.motionDurationCurve.map((item) => ({ label: `${item.duration}s`, value: item.tpr * 100, tone: "green" as const })),
    },
    brand: {
      title: "\u54c1\u724c\u8868\u73b0",
      items: data.brandResults.map((item) => ({ label: item.brand, value: item.sar, tone: "amber" as const })),
    },
  }[evaluationView];

  return (
    <div className="page-grid evaluation-grid">
      <section className="module-card wide">
        <div className="module-head">
          <span>08</span>
          <strong>{T.evaluationTitle}</strong>
        </div>
        <div className="interactive-strip">
          {([
            ["sample", "\u6837\u672c\u6570"],
            ["duration", "\u6301\u7eed\u65f6\u95f4"],
            ["brand", "\u54c1\u724c"],
          ] as const).map(([value, label]) => (
            <button key={value} className={evaluationView === value ? "control-chip active" : "control-chip"} onClick={() => setEvaluationView(value)}>
              {label}
            </button>
          ))}
        </div>
      </section>
      <div className="content-grid">
        <MetricBars title={viewMap.title} items={viewMap.items} />
        <div className="module-card">
          <div className="module-head">
            <span>09</span>
            <strong>TPR / TNR</strong>
          </div>
          <div className="result-matrix">
            {evaluationView === "brand"
              ? data.brandResults.map((item) => (
                  <div key={item.brand} className="matrix-row">
                    <span>{item.brand}</span>
                    <strong>{item.tpr.toFixed(1)} / {item.tnr.toFixed(1)}</strong>
                  </div>
                ))
              : data.sampleSizeCurve.map((item) => (
                  <div key={item.samples} className="matrix-row">
                    <span>{item.samples}\u7ec4</span>
                    <strong>{(item.tpr * 100).toFixed(1)} / {(item.tnr * 100).toFixed(1)}</strong>
                  </div>
                ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RepositoryPage() {
  const blocks = [
    ["frontend/", "\u5f53\u524d\u6f14\u793a\u7f51\u7ad9\u3001\u5206\u9875\u7ed3\u6784\u548c\u624b\u673a\u6d41\u7a0b"],
    ["algorithms/", "\u7279\u5f81\u3001\u8bc6\u522b\u3001\u53d8\u5316\u68c0\u6d4b\u548c\u5b9a\u4f4d\u4f30\u8ba1"],
    ["samples/", "\u5e27\u6570\u636e\u3001\u8def\u5f84\u548c\u8bc4\u4f30\u6307\u6807"],
    ["docs/", "\u67b6\u6784\u3001\u7b97\u6cd5\u548c\u5b89\u5168\u8fb9\u754c\u8bf4\u660e"],
    ["tests/", "\u9879\u76ee\u7b97\u6cd5\u7684 smoke test"],
  ];

  return (
    <div className="page-grid repository-grid">
      <section className="module-card wide">
        <div className="module-head">
          <span>10</span>
          <strong>{T.repositoryTitle}</strong>
        </div>
        <div className="repo-layout">
          {blocks.map(([path, text]) => (
            <div className="repo-entry" key={path}>
              <code>{path}</code>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="content-grid">
        <div className="module-card">
          <div className="module-head">
            <span>11</span>
            <strong>\u5b89\u5168\u8fb9\u754c</strong>
          </div>
          <div className="safe-list">
            {[
              "\u4e0d\u4f7f\u7528\u771f\u5b9e Wi-Fi \u6293\u5305",
              "\u4e0d\u8fd0\u884c\u7834\u89e3\u6216\u653b\u51fb\u547d\u4ee4",
              "\u4e0d\u63a5\u5165\u771f\u5b9e\u6444\u50cf\u5934",
              "\u53ea\u663e\u793a\u5408\u6210\u6570\u636e",
            ].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
        <div className="module-card">
          <div className="module-head">
            <span>12</span>
            <strong>\u5f53\u524d\u9875\u9762\u8def\u7ebf</strong>
          </div>
          <div className="flow-track">
            {routes.map((route, index) => (
              <div key={route.id} className="flow-node">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{route.label}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function formatPct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function readPageFromLocation(): PageId {
  if (typeof window === "undefined") return "overview";
  const hash = window.location.hash.replace(/^#\/?/, "").trim();
  const pathname = window.location.pathname.split("/").filter(Boolean).join("/");
  const raw = hash || pathname;
  const parts = raw.split("?")[0].split("/").filter(Boolean);
  const route = parts.find((part) => pageTokens.has(part as PageId)) as PageId | undefined;
  if (route && pageTokens.has(route)) return route;
  return "overview";
}
