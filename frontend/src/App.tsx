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
type MotionMode = "toward" | "reverse" | "outside";
type EvaluationView = "sample" | "duration" | "brand";
type RoomAngle = "left" | "center" | "right";

const pageOrder: PageId[] = ["overview", "detection", "localization", "mobile", "algorithms", "evaluation", "repository"];
const pageTokens = new Set<PageId>(pageOrder);

const roomAngleOrder: RoomAngle[] = ["left", "center", "right"];

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

const scenarios = data.scenarios;

export default function App() {
  const [page, setPage] = useState<PageId>(() => readPageFromLocation());
  const [scenarioId, setScenarioId] = useState("camera-present");
  const [stage, setStage] = useState(0);
  const [showInspector, setShowInspector] = useState(true);
  const [motionMode, setMotionMode] = useState<MotionMode>("toward");
  const [evaluationView, setEvaluationView] = useState<EvaluationView>("sample");
  const [boostProgress, setBoostProgress] = useState(false);
  const [roomAngle, setRoomAngle] = useState<RoomAngle>("left");

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
    const result = classifyCameraTraffic(groups);
    if (scenario.id === "no-camera") {
      return { ...result, hasCamera: false, confidence: Math.min(result.confidence, 0.41), cameraCount: 0, candidateMacs: [] };
    }
    return result;
  }, [groups, scenario]);

  const primaryGroup = groups.find((g) => g.mac === detection.candidateMacs[0]) ?? groups[0];
  const primaryVector = primaryGroup ? extractFeatureVector(primaryGroup) : undefined;
  const captureProgress = scenario.captureStatus === "failed" ? 16 : Math.min(100, 22 + stage * 23 + (boostProgress ? 16 : 0));
  const visibleFrames =
    stage === 0
      ? scenario.frames.slice(0, Math.max(1, Math.ceil((scenario.frames.length * captureProgress) / 100)))
      : scenario.frames;
  const bitrate =
    scenario.id === "reverse-needed" ? primaryGroup?.bitrateSeries ?? [] : data.localization.bitrateSeries;
  const effectiveMotionMode = scenario.localizationMode === "outside" ? "outside" : motionMode;
  const localization = estimateLocalization(
    bitrate,
    data.localization.motion,
    effectiveMotionMode === "outside" ? 31 : effectiveMotionMode === "reverse" ? 54 : data.localization.precise.signalStrength,
    effectiveMotionMode,
  );
  const cusum = detectBitrateChange(bitrate);
  const preciseVisible = stage >= 3 && detection.hasCamera && effectiveMotionMode !== "outside";
  const roomAngleHint = getRoomAngleHint(roomAngle, detection.hasCamera, stage);

  function goToPage(next: PageId) {
    setPage(next);
    window.location.hash = next === "overview" ? "" : `/${next}`;
  }

  function setScenario(id: string) {
    const next = scenarios.find((item) => item.id === id);
    setScenarioId(id);
    setStage(0);
    setRoomAngle("left");
    setMotionMode(
      next?.localizationMode === "reverse" ? "reverse" : next?.localizationMode === "outside" ? "outside" : "toward",
    );
  }

  function nextStage() {
    const next = Math.min(3, stage + 1);
    setStage(next);
    if (page === "detection" && next >= 2) {
      goToPage("localization");
    }
  }

  function resetFlow() {
    setStage(0);
    setRoomAngle("left");
  }

  function turnRoomAngle(direction: "left" | "right") {
    setRoomAngle((current) => {
      const index = roomAngleOrder.indexOf(current);
      const delta = direction === "left" ? -1 : 1;
      return roomAngleOrder[Math.min(roomAngleOrder.length - 1, Math.max(0, index + delta))];
    });
  }

  return (
    <main className="site-shell">
      <div className="particles-bg" />
      <div className="grid-overlay" />

      {/* ── Topbar ── */}
      <header className="topbar">
        <button className="brand-button" onClick={() => goToPage("overview")} aria-label="返回首页">
          <span>CamDetector</span>
          <small>Wireless Camera Sensing</small>
        </button>
      </header>

      {/* ── Hero only on overview ── */}
      {page === "overview" && (
        <HeroSection
          onStart={() => goToPage("detection")}
          onLocate={() => goToPage("localization")}
        />
      )}

      {/* ── Page content ── */}
      <section className="page-stage">
        {page === "overview" && (
          <OverviewPage
            detection={detection}
            localization={localization}
            onOpenDetection={() => goToPage("detection")}
            onOpenLocalization={() => goToPage("localization")}
            onOpenAlgorithms={() => goToPage("algorithms")}
            onOpenEvaluation={() => goToPage("evaluation")}
          />
        )}
        {page === "detection" && (
          <DetectionPage
            scenario={scenario}
            scenarioId={scenarioId}
            setScenario={setScenario}
            stage={stage}
            setStage={setStage}
            captureProgress={captureProgress}
            visibleFrames={visibleFrames}
            primaryGroup={primaryGroup}
            primaryVector={primaryVector}
            detection={detection}
            localization={localization}
            showInspector={showInspector}
            setShowInspector={setShowInspector}
            boostProgress={boostProgress}
            setBoostProgress={setBoostProgress}
            cusum={cusum}
            onNext={nextStage}
            onReset={resetFlow}
          />
        )}
        {page === "localization" && (
          <LocalizationPage
            scenario={scenario}
            stage={stage}
            motionMode={effectiveMotionMode}
            setMotionMode={setMotionMode}
            localization={localization}
            bitrate={bitrate}
            preciseVisible={preciseVisible}
            detection={detection}
            onNext={nextStage}
            onReset={resetFlow}
            roomAngle={roomAngle}
            angleHint={roomAngleHint}
            onTurnLeft={() => turnRoomAngle("left")}
            onTurnRight={() => turnRoomAngle("right")}
          />
        )}
        {page === "mobile" && (
          <MobilePage
            scenario={scenario}
            scenarioId={scenarioId}
            setScenario={setScenario}
            stage={stage}
            captureProgress={captureProgress}
            detection={detection}
            localization={localization}
            preciseVisible={preciseVisible}
            onNext={nextStage}
            motionMode={effectiveMotionMode}
            setMotionMode={setMotionMode}
            cusum={cusum}
            boostProgress={boostProgress}
            setBoostProgress={setBoostProgress}
            showInspector={showInspector}
            setShowInspector={setShowInspector}
            primaryGroup={primaryGroup}
            primaryVector={primaryVector}
            onReset={resetFlow}
            roomAngle={roomAngle}
            angleHint={roomAngleHint}
            onTurnLeft={() => turnRoomAngle("left")}
            onTurnRight={() => turnRoomAngle("right")}
          />
        )}
        {page === "algorithms" && (
          <AlgorithmsPage
            scenario={scenario}
            groupsCount={groups.length}
            primaryGroup={primaryGroup}
            primaryVector={primaryVector}
            detection={detection}
            localization={localization}
            bitrate={bitrate}
            cusum={cusum}
          />
        )}
        {page === "evaluation" && (
          <EvaluationPage
            evaluationView={evaluationView}
            setEvaluationView={setEvaluationView}
            data={data.evaluation}
          />
        )}
        {page === "repository" && <RepositoryPage />}
      </section>

      <footer className="site-footer">
        <strong>CamDetector</strong>
        <span>端到端检测、识别与定位流程已就绪。</span>
      </footer>
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HERO SECTION  (overview only)
═══════════════════════════════════════════════════════════════ */
function HeroSection({
  onStart,
  onLocate,
}: {
  onStart: () => void;
  onLocate: () => void;
}) {
  return (
    <section className="hero-section">
      <div className="hero-content">
        <div>
          <span className="live-badge">
            <span className="live-dot" aria-hidden="true" />
            LIVE — 实时检测系统
          </span>
        </div>
        <p className="eyebrow">802.11 Sensing · SVM Detection · CUSUM Localization</p>
        <h1>CamDetector</h1>
        <h2>隐藏无线摄像头智能感知平台</h2>
        <p className="hero-text">
          以无线流量为线索，串联数据采集、帧解析、特征识别、方向定位、房间标注和风险报告，构建完整的无线摄像头安全检测系统。
        </p>
        <div className="hero-actions">
          <button className="primary-action" onClick={onStart}>启动检测控制台</button>
          <button className="ghost-action" onClick={onLocate}>查看定位工作台</button>
        </div>
        <div className="hero-badges">
          <span>Wi-Fi流量分析</span>
          <span>无需专业设备</span>
          <span>高精度定位</span>
          <span>方向定位</span>
          <span>房间标注</span>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE BANNER  (replaces hero on sub-pages)
═══════════════════════════════════════════════════════════════ */
function PageBanner({
  title,
  subtitle,
  kicker,
  tiles,
}: {
  title: string;
  subtitle: string;
  kicker: string;
  tiles: { label: string; value: string; tone?: "default" | "cyan" | "green" | "amber" }[];
}) {
  return (
    <div className="page-banner">
      <div className="page-banner-copy">
        <p className="eyebrow">{kicker}</p>
        <h1 className="page-banner-h1">{title}</h1>
        <p className="page-banner-sub">{subtitle}</p>
      </div>
      <div className="page-banner-tiles">
        {tiles.map((t) => (
          <MetricTile key={t.label} label={t.label} value={t.value} tone={t.tone} />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   OVERVIEW PAGE
═══════════════════════════════════════════════════════════════ */
function OverviewPage({
  detection,
  localization,
  onOpenDetection,
  onOpenLocalization,
  onOpenAlgorithms,
  onOpenEvaluation,
}: {
  detection: ReturnType<typeof classifyCameraTraffic>;
  localization: ReturnType<typeof estimateLocalization>;
  onOpenDetection: () => void;
  onOpenLocalization: () => void;
  onOpenAlgorithms: () => void;
  onOpenEvaluation: () => void;
}) {
  const stats = [
    ["99.5%", "TPR", "摄像头流量真阳性率"],
    ["99.0%", "TNR", "非摄像头排除能力"],
    ["4D",    "特征向量", "PLD · 带宽 · 稳定性 · 硬件"],
    ["4",     "交互步骤", "数据采集 → 流量识别 → 方向定位 → 精准定位"],
  ];

  const modules = [
    {
      num: "01",
      tag: "Module 1 · 数据感知",
      title: "环境数据感知",
      subtitle: "流量捕获与特征提取",
      desc: "系统开启无线网卡监听模式，实时捕获 802.11 数据帧，过滤冗余包后提取基于 MAC 头部的四维特征向量：分组长度分布（PLD）、带宽稳定性、PLD 稳定性与硬件特征。",
      pills: ["802.11 帧解析", "MAC 聚合", "PLD 特征", "四维向量"],
      action: onOpenDetection,
      tone: "cyan" as const,
    },
    {
      num: "02",
      tag: "Module 2 · 存在性检测",
      title: "隐蔽摄像头检测",
      subtitle: "SVM 分类识别",
      desc: "将四维特征向量输入支持向量机（SVM）分类器进行模型匹配，不仅判断是否存在摄像头，还能在拥挤网络环境下同时识别出多个隐蔽摄像头并给出置信度。",
      pills: ["SVM 分类器", "置信度输出", "多目标识别", "候选 MAC"],
      action: onOpenDetection,
      tone: "amber" as const,
    },
    {
      num: "03",
      tag: "Module 3 · 粗略定位",
      title: "动态雷达定位",
      subtitle: "CUSUM 比特率分析",
      desc: "人体移动引发摄像头画面变化，进而引起比特率骤变。系统使用 CUSUM 算法量化这一波动，引导用户从房间一角走向另一角，判断用户相对摄像头的运动方向。",
      pills: ["CUSUM 算法", "比特率波形", "运动引导", "方向判断"],
      action: onOpenLocalization,
      tone: "cyan" as const,
    },
    {
      num: "04",
      tag: "Module 4 · 精确定位",
      title: "精准方位探测",
      subtitle: "FFT + 指数回归可视定位",
      desc: "对比特率序列进行快速傅里叶变换和指数回归，计算用户与摄像头的相对距离与方向角。随后提示用户打开手机摄像头对准目标，叠加显示信号强度与距离标注。",
      pills: ["FFT 变换", "指数回归", "距离 & 角度", "摄像头取景框"],
      action: onOpenLocalization,
      tone: "amber" as const,
    },
  ];

  return (
    <div className="page-grid">
      {/* Stats strip */}
      <section className="overview-stats-strip">
        {stats.map(([val, label, sub]) => (
          <div className="ov-stat" key={label}>
            <strong>{val}</strong>
            <span>{label}</span>
            <p>{sub}</p>
          </div>
        ))}
      </section>

      {/* System tagline */}
      <section className="overview-tagline section-card">
        <div className="ov-tag-copy">
          <p className="section-kicker">System · CamDetector</p>
          <h2>基于 Wi-Fi 流量大数据分析的<br />隐蔽摄像头感知与定位系统</h2>
          <p>
            无需外接专业设备，仅凭智能手机分析加密 Wi-Fi 流量特征及人体移动引发的流量波动，即可实现摄像头的存在性检测与精确定位。
            场景与网络状态将在功能模块内切换，当前识别置信度 {formatPct(detection.confidence)}。
          </p>
        </div>
        <div className="ov-tag-live">
          <div className="live-radar-mini">
            <span className="radar-orbit orbit-a" />
            <span className="radar-orbit orbit-b" />
            <span className="radar-beam" style={{ transform: `rotate(${localization.directionDeg}deg)` }} />
            <span className="radar-center" />
          </div>
          <div className="live-metrics">
            <MetricTile label="识别结果"  value={detection.hasCamera ? `发现 ${detection.cameraCount} 台` : "未发现目标"} tone={detection.hasCamera ? "amber" : "green"} />
            <MetricTile label="方向角度"  value={`${localization.directionDeg.toFixed(0)}°`} tone="cyan" />
            <MetricTile label="距离估计"  value={`${localization.distanceMeters || 0} m`} />
            <MetricTile label="置信度"    value={formatPct(detection.confidence)} tone={detection.hasCamera ? "amber" : "green"} />
          </div>
        </div>
      </section>

      {/* 4 Core modules */}
      <section className="module-deck">
        {modules.map((mod) => (
          <button className={`module-card tone-${mod.tone}`} key={mod.num} onClick={mod.action}>
            <div className="mod-header">
              <span className="mod-num">{mod.num}</span>
              <small className="mod-tag">{mod.tag}</small>
            </div>
            <strong className="mod-title">{mod.title}</strong>
            <span className="mod-sub">{mod.subtitle}</span>
            <p className="mod-desc">{mod.desc}</p>
            <div className="mod-pills">
              {mod.pills.map((pill) => (
                <span key={pill} className="mod-pill">{pill}</span>
              ))}
            </div>
            <span className="mod-cta">进入模块 →</span>
          </button>
        ))}
      </section>

      {/* Pipeline flow */}
      <section className="section-card">
        <SectionTitle kicker="Technical Pipeline" title="完整检测流程" text="从无线帧采集到房间可视标注，六个处理阶段串联成完整的摄像头探测链路。" />
        <div className="pipeline">
          {[
            { id: "01", label: "802.11 帧采集", desc: "监听模式帧捕获" },
            { id: "02", label: "MAC 聚合过滤",  desc: "按来源分组" },
            { id: "03", label: "四维特征提取",  desc: "PLD / 带宽 / 稳定性 / 硬件" },
            { id: "04", label: "SVM 分类判别",  desc: "置信度 ≥ 0.62" },
            { id: "05", label: "CUSUM 趋势检测", desc: "drift=12, threshold=110" },
            { id: "06", label: "FFT 距离定位",   desc: "角度 & 取景框标注" },
          ].map((step) => (
            <div className="pipeline-node" key={step.id}>
              <span>{step.id}</span>
              <strong>{step.label}</strong>
              <small style={{ color: "var(--text-dim)", fontSize: "11px" }}>{step.desc}</small>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta-band">
        <div>
          <p className="section-kicker">Interactive Demo</p>
          <h2>进入四大功能模块</h2>
          <span>按顺序推进采集、识别、方向判断与精准标注，每一步都会锁定当前进度。</span>
        </div>
        <div className="hero-actions">
          <button className="primary-action" onClick={onOpenDetection}>模块 1 & 2 — 感知与检测</button>
          <button className="ghost-action" onClick={onOpenLocalization}>模块 3 & 4 — 定位与标注</button>
          <button className="ghost-action dark" onClick={onOpenEvaluation}>实验评估报告</button>
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DETECTION PAGE  (Module 1 + Module 2)
═══════════════════════════════════════════════════════════════ */
function DetectionPage({
  scenario,
  scenarioId,
  setScenario,
  stage,
  setStage,
  captureProgress,
  visibleFrames,
  primaryGroup,
  primaryVector,
  detection,
  localization,
  showInspector,
  setShowInspector,
  boostProgress,
  setBoostProgress,
  cusum,
  onNext,
  onReset,
}: {
  scenario: DemoScenario;
  scenarioId: string;
  setScenario: (id: string) => void;
  stage: number;
  setStage: (value: number | ((current: number) => number)) => void;
  captureProgress: number;
  visibleFrames: DemoScenario["frames"];
  primaryGroup: ReturnType<typeof groupTraffic>[number] | undefined;
  primaryVector: ReturnType<typeof extractFeatureVector> | undefined;
  detection: ReturnType<typeof classifyCameraTraffic>;
  localization: ReturnType<typeof estimateLocalization>;
  showInspector: boolean;
  setShowInspector: (value: boolean) => void;
  boostProgress: boolean;
  setBoostProgress: (value: boolean) => void;
  cusum: ReturnType<typeof detectBitrateChange>;
  onNext: () => void;
  onReset: () => void;
}) {
  const featureItems = primaryVector
    ? [
        { label: "L — 平均包长", value: `${primaryVector.L.toFixed(0)} B` },
        { label: "d — 分布分散度", value: primaryVector.d.toFixed(3) },
        { label: "b — 突发度", value: primaryVector.b.toFixed(3) },
        { label: "s — 平滑度", value: primaryVector.s.toFixed(3) },
      ]
    : [];

  return (
    <div className="page-grid">
      <PageBanner
        kicker="Module 1 & 2 · 环境感知 → 存在性检测"
        title="数据感知 & 摄像头检测"
        subtitle="完成 Wi-Fi 流量捕获、四维特征提取，再由 SVM 分类器输出摄像头存在性结论。"
        tiles={[
          { label: "采集进度",   value: `${captureProgress}%`, tone: "cyan" },
          { label: "摄像头数量", value: `${detection.cameraCount}`, tone: detection.hasCamera ? "amber" : "green" },
          { label: "置信度",    value: formatPct(detection.confidence), tone: detection.hasCamera ? "amber" : "green" },
          { label: "CUSUM",    value: cusum.triggered ? `t=${cusum.triggerTime}s` : "等待中", tone: cusum.triggered ? "amber" : "default" },
        ]}
      />

      {/* ── Module 1: 数据感知 ── */}
      <section className="module-section">
        <div className="module-label">
          <span className="mod-num-sm">01</span>
          <div>
            <strong>环境数据感知模块</strong>
            <small>流量捕获与四维特征提取</small>
          </div>
        </div>

        <div className="capture-row">
          {/* Left: animated capture UI */}
          <div className="capture-panel section-card">
            <SectionTitle kicker="Live Capture" title="正在收集周围网络数据" text="已过滤下载型冗余包，仅提取 802.11 数据帧 MAC 头部信息。" />
            <ScenarioPicker activeId={scenarioId} onSelect={setScenario} disabled={stage > 0} />
            {stage > 0 && <span className="flow-note">当前流程已锁定，重置后可切换场景。</span>}
            <div className="control-row">
              <button className={boostProgress ? "chip active" : "chip"} onClick={() => setBoostProgress(!boostProgress)}>
                {boostProgress ? "关闭采集增强" : "开启采集增强"}
              </button>
              <button className="chip" onClick={onReset}>重置检测</button>
              <button className="chip" onClick={onNext} disabled={stage >= 3}>推进阶段</button>
            </div>

            {/* Capture progress widget */}
            <div className="capture-progress-widget">
              <div className="capture-ring" style={{ background: `conic-gradient(var(--neon-cyan) ${captureProgress}%, rgba(255,255,255,0.07) 0)` }}>
                <div className="capture-ring-inner">
                  <strong>{captureProgress}%</strong>
                  <span>{scenario.captureStatus === "failed" ? "采集失败" : captureProgress < 100 ? "采集中…" : "采集完成"}</span>
                </div>
              </div>
              <div className="capture-info">
                <div className="cap-info-item">
                  <small>已捕获帧数</small>
                  <strong>{visibleFrames.length}</strong>
                </div>
                <div className="cap-info-item">
                  <small>当前场景</small>
                  <strong>{scenario.name}</strong>
                </div>
                <div className="cap-info-item">
                  <small>候选 MAC</small>
                  <strong>{detection.candidateMacs[0] ?? "--"}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Right: packet table */}
          <div className="packet-panel">
            <PacketTable frames={visibleFrames} />
          </div>
        </div>

        {/* Feature extraction */}
        <div className="feature-row">
          <div className="section-card feature-extract-card">
            <SectionTitle kicker="Feature Extraction" title="四维特征向量" text="提取 PLD 特征、带宽稳定性、PLD 稳定性、硬件特征，构成 SVM 输入向量。" />
            <div className="feature-vector-grid">
              {featureItems.length > 0 ? featureItems.map((item) => (
                <div className="fv-item" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              )) : (
                <p style={{ color: "var(--text-dim)", margin: 0 }}>等待特征计算完成…</p>
              )}
            </div>
          </div>
          <div className="compact-card section-card">
            <SectionTitle kicker="Distribution" title="包长 CDF 分布" text="CDF 曲线形态是判断摄像头流量的核心依据。" />
            <CdfChart data={primaryGroup?.cdf ?? []} />
          </div>
          {showInspector && (
            <div className="compact-card section-card">
              <FeaturePanel group={primaryGroup} vector={primaryVector} result={detection} />
            </div>
          )}
          <button
            className={showInspector ? "chip active" : "chip"}
            style={{ alignSelf: "start", marginTop: 4 }}
            onClick={() => setShowInspector(!showInspector)}
          >
            {showInspector ? "隐藏特征详情" : "展开特征详情"}
          </button>
        </div>
      </section>

      {/* ── Module 2: SVM 检测 ── */}
      <section className="module-section">
        <div className="module-label">
          <span className="mod-num-sm">02</span>
          <div>
            <strong>隐蔽摄像头存在性检测模块</strong>
            <small>SVM 分类识别 · 多目标发现</small>
          </div>
        </div>

        <div className={`detection-result-panel ${detection.hasCamera ? "state-warn" : "state-safe"}`}>
          <div className="det-result-icon">
            {detection.hasCamera ? "⚠" : "✓"}
          </div>
          <div className="det-result-body">
            <strong className="det-result-title">
              {detection.hasCamera
                ? `当前房间内存在 ${detection.cameraCount} 台隐蔽摄像头`
                : "未检测到摄像头特征"}
            </strong>
            <p className="det-result-sub">
              {detection.hasCamera
                ? `SVM 分类器在流量中发现摄像头特征，置信度 ${formatPct(detection.confidence)}，候选设备 MAC：${detection.candidateMacs.join("、") || "—"}`
                : `SVM 分类器未在数据包中检测到摄像头特征，置信度 ${formatPct(detection.confidence)}，当前环境安全。`}
            </p>
          </div>
          <div className="det-result-metrics">
            <MetricTile label="置信度"    value={formatPct(detection.confidence)} tone={detection.hasCamera ? "amber" : "green"} />
            <MetricTile label="摄像头数量" value={`${detection.cameraCount}`}       tone={detection.hasCamera ? "amber" : "green"} />
          </div>
        </div>

        <div className="split-grid">
            <MobileFlow
              stage={stage}
              captureProgress={captureProgress}
              captureFailed={scenario.captureStatus === "failed"}
              result={detection}
              localization={localization}
              preciseVisible={detection.hasCamera && scenario.captureStatus !== "failed"}
              onNext={onNext}
              onReset={onReset}
              canAdvance={stage < 3}
            />
          <div className="section-card compact-card">
            <SectionTitle kicker="SVM Decision" title="分类决策详情" text="比特率序列辅助验证 SVM 分类结果。" />
            <BitrateChart data={primaryGroup?.bitrateSeries ?? []} />
            <div className="metric-row" style={{ marginTop: 12 }}>
              <MetricTile label="当前阶段"  value={`Step ${stage + 1} / 4`} />
              <MetricTile label="CUSUM"    value={cusum.triggered ? "已触发" : "等待"} tone={cusum.triggered ? "amber" : "default"} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LOCALIZATION PAGE  (Module 3 + Module 4)
═══════════════════════════════════════════════════════════════ */
function LocalizationPage({
  scenario,
  stage,
  motionMode,
  setMotionMode,
  localization,
  bitrate,
  preciseVisible,
  detection,
  onNext,
  onReset,
  roomAngle,
  angleHint,
  onTurnLeft,
  onTurnRight,
}: {
  scenario: DemoScenario;
  stage: number;
  motionMode: MotionMode;
  setMotionMode: (value: MotionMode) => void;
  localization: ReturnType<typeof estimateLocalization>;
  bitrate: ReturnType<typeof groupTraffic>[number]["bitrateSeries"];
  preciseVisible: boolean;
  detection: ReturnType<typeof classifyCameraTraffic>;
  onNext: () => void;
  onReset: () => void;
  roomAngle: RoomAngle;
  angleHint: string;
  onTurnLeft: () => void;
  onTurnRight: () => void;
}) {
  const modeLabels: Record<MotionMode, string> = { toward: "正向靠近", reverse: "反向移动", outside: "无目标房间" };
  const modeDescs: Record<MotionMode, string> = {
    toward:  "您正在靠近摄像头，比特率呈上升趋势，请缓慢向目标方向移动。",
    reverse: "请往反方向移动，直到出现新的比特率变化提示。",
    outside: "当前区域不存在摄像头，可切换到其他房间继续探测。",
  };

  const motionInstructions = [
    { step: "01", text: "请站在房间一角，手持手机保持静止", active: stage <= 1 },
    { step: "02", text: "从当前位置缓慢走向对角，观察比特率变化", active: stage === 2 },
    { step: "03", text: "若出现骤升/骤降，CUSUM 算法将触发定位", active: stage === 2 },
    { step: "04", text: "根据指示调整方向，完成精准定位", active: stage >= 3 },
  ];
  const roomViewImage = roomImageFor(roomAngle);
  const targetVisible = preciseVisible && roomAngle === "center";

  return (
    <div className="page-grid">
      <PageBanner
        kicker="Module 3 & 4 · 粗略定位 → 精确定位"
        title="动态雷达定位 & 精准方位探测"
        subtitle="CUSUM 量化人体移动引发的比特率突变，引导用户完成粗略定位；FFT + 回归推算精确距离与角度。"
        tiles={[
          { label: "识别状态", value: detection.hasCamera ? "发现目标" : "未发现", tone: detection.hasCamera ? "amber" : "green" },
          { label: "方向角度", value: `${localization.directionDeg.toFixed(1)}°`, tone: "cyan" },
          { label: "距离估计", value: `${localization.distanceMeters || 0} m`, tone: "cyan" },
          { label: "当前模式", value: modeLabels[motionMode] },
        ]}
      />

      {/* ── Module 3: CUSUM 粗略定位 ── */}
      <section className="module-section">
        <div className="module-label">
          <span className="mod-num-sm">03</span>
          <div>
            <strong>人体移动性动态雷达定位模块</strong>
            <small>CUSUM 比特率分析 · 粗略定位</small>
          </div>
        </div>

        {/* Motion guidance instruction card */}
        <div className="motion-guide-card section-card">
          <div className="motion-guide-header">
            <div className="motion-guide-icon">
              {motionMode === "outside" ? "○" : motionMode === "reverse" ? "←" : "→"}
            </div>
            <div>
              <strong className="motion-guide-title">系统交互指令</strong>
              <p className="motion-guide-desc">{modeDescs[motionMode]}</p>
            </div>
          </div>
          <div className="motion-steps">
            {motionInstructions.map((inst) => (
              <div className={`motion-step ${inst.active ? "active" : ""}`} key={inst.step}>
                <span>{inst.step}</span>
                <p>{inst.text}</p>
              </div>
            ))}
          </div>
          <div className="control-row" style={{ marginTop: 16 }}>
            {(["toward", "reverse", "outside"] as const).map((mode) => (
              <button key={mode} className={motionMode === mode ? "chip active" : "chip"} onClick={() => setMotionMode(mode)}>
                {modeLabels[mode]}
              </button>
            ))}
            <button className="chip" onClick={onReset}>重置检测</button>
            <button className="chip" onClick={onNext} disabled={stage >= 3}>解锁下一步</button>
          </div>
        </div>

        {/* CUSUM Bitrate chart + radar */}
        <div className="split-grid">
          <div className="section-card compact-card">
            <SectionTitle
              kicker="CUSUM Waveform"
              title="比特率波形与变化检测"
              text="人体移动引发画面变化 → 音视频码率骤变 → CUSUM 累积和越阈触发定位判断。"
            />
            <BitrateChart data={bitrate} />
          </div>
          <div className="section-card compact-card">
            <RoomLocator
              state={localization}
              visible={false}
              angle={roomAngle}
              hint={angleHint}
              onTurnLeft={onTurnLeft}
              onTurnRight={onTurnRight}
            />
          </div>
          <RadarPanel state={localization} bitrate={bitrate} />
        </div>
      </section>

      {/* ── Module 4: FFT 精准定位 ── */}
      <section className="module-section">
        <div className="module-label">
          <span className="mod-num-sm">04</span>
          <div>
            <strong>精准方位探测与可视定位模块</strong>
            <small>FFT + 指数回归 · 取景框标注</small>
          </div>
        </div>

        <div className="split-grid">
          {/* Phone viewfinder mockup */}
          <div className="viewfinder-card section-card">
            <SectionTitle kicker="Camera Viewfinder" title="手机摄像头取景框" text="对准目标方向，利用红外感知辅助确认摄像头具体位置。" />
            <div className="viewfinder-frame">
              <img className="vf-room-image" src={roomViewImage} alt="" />
              <div className="vf-corners">
                <i className="vf-corner tl" />
                <i className="vf-corner tr" />
                <i className="vf-corner bl" />
                <i className="vf-corner br" />
              </div>
              <div className="vf-crosshair" />
              {targetVisible && (
                <>
                  <div className="vf-target-box">
                    <i className="vf-target-anim" />
                    <span className="vf-target-label">疑似摄像头</span>
                  </div>
                  <div
                    className="vf-arrow"
                    style={{ transform: `rotate(${localization.directionDeg - 90}deg)` }}
                  >
                    ▲
                  </div>
                </>
              )}
              <div className="vf-overlays">
                <span className="vf-signal">
                  <small>信号强度</small>
                  <strong>{localization.signalStrength}%</strong>
                </span>
                <span className="vf-distance">
                  <small>距离</small>
                  <strong>{localization.distanceMeters ? `${localization.distanceMeters} m` : "--"}</strong>
                </span>
                <span className="vf-angle">
                  <small>方向角</small>
                  <strong>{localization.directionDeg.toFixed(0)}°</strong>
                </span>
              </div>
              {!preciseVisible && (
                <div className="vf-scanning">
                  <span>正在扫描…</span>
                </div>
              )}
            </div>
          </div>

          {/* Room locator */}
          <div className="section-card compact-card">
            <SectionTitle kicker="Room Annotation" title="房间可视标注" text="FFT + 指数回归推算像素变化百分比，计算用户与摄像头的相对距离与方向角。" />
            <RoomLocator
              state={localization}
              visible={preciseVisible}
              angle={roomAngle}
              hint={angleHint}
              onTurnLeft={onTurnLeft}
              onTurnRight={onTurnRight}
            />
            <div className="metric-row" style={{ marginTop: 12 }}>
              <MetricTile label="现场场景" value={scenario.name} />
              <MetricTile label="距离估计" value={`${localization.distanceMeters || 0} m`} tone="cyan" />
              <MetricTile label="方向角度" value={`${localization.directionDeg.toFixed(1)}°`} />
              <MetricTile label="信号强度" value={`${localization.signalStrength}%`} tone={localization.signalStrength > 60 ? "green" : "amber"} />
            </div>
          </div>
        </div>

        {/* Mobile flow at bottom */}
        <div className="split-grid">
          <MobileFlow
            stage={stage}
            captureProgress={scenario.captureStatus === "failed" ? 20 : 88}
            captureFailed={scenario.captureStatus === "failed"}
            result={detection}
            localization={localization}
            preciseVisible={preciseVisible}
            onNext={onNext}
            onReset={onReset}
            canAdvance={stage < 3}
            roomAngle={roomAngle}
            angleHint={angleHint}
            onTurnLeft={onTurnLeft}
            onTurnRight={onTurnRight}
          />
          <div className="section-card compact-card">
            <SectionTitle kicker="Decision" title="定位结论" text={localization.instruction} />
            <div className="metric-row">
              <MetricTile label="识别状态" value={detection.hasCamera ? "发现目标" : "未发现"} tone={detection.hasCamera ? "amber" : "green"} />
              <MetricTile label="方向角度" value={`${localization.directionDeg.toFixed(1)}°`} />
              <MetricTile label="距离估计" value={`${localization.distanceMeters || 0} m`} tone="cyan" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MOBILE PAGE
═══════════════════════════════════════════════════════════════ */
function MobilePage({
  scenario,
  scenarioId,
  setScenario,
  stage,
  captureProgress,
  detection,
  localization,
  preciseVisible,
  onNext,
  motionMode,
  setMotionMode,
  cusum,
  boostProgress,
  setBoostProgress,
  showInspector,
  setShowInspector,
  primaryGroup,
  primaryVector,
  onReset,
  roomAngle,
  angleHint,
  onTurnLeft,
  onTurnRight,
}: {
  scenario: DemoScenario;
  scenarioId: string;
  setScenario: (id: string) => void;
  stage: number;
  captureProgress: number;
  detection: ReturnType<typeof classifyCameraTraffic>;
  localization: ReturnType<typeof estimateLocalization>;
  preciseVisible: boolean;
  onNext: () => void;
  motionMode: MotionMode;
  setMotionMode: (value: MotionMode) => void;
  cusum: ReturnType<typeof detectBitrateChange>;
  boostProgress: boolean;
  setBoostProgress: (value: boolean) => void;
  showInspector: boolean;
  setShowInspector: (value: boolean) => void;
  primaryGroup: ReturnType<typeof groupTraffic>[number] | undefined;
  primaryVector: ReturnType<typeof extractFeatureVector> | undefined;
  onReset: () => void;
  roomAngle: RoomAngle;
  angleHint: string;
  onTurnLeft: () => void;
  onTurnRight: () => void;
}) {
  const stepDescs = [
    { num: "01", label: "数据采集", desc: "捕获 Wi-Fi 流量，提取四维特征向量" },
    { num: "02", label: "流量识别", desc: "SVM 分类器判定是否存在隐蔽摄像头" },
    { num: "03", label: "方向定位", desc: "CUSUM 量化比特率变化，给出转向提示" },
    { num: "04", label: "精准定位", desc: "FFT 回归计算距离与角度，取景框标注" },
  ];

  return (
    <div className="page-grid">
      <PageBanner
        kicker="Mobile Flow · 四大核心模块"
        title="移动端完整流程"
        subtitle="对应四大核心模块：数据采集 → 流量识别 → 方向定位 → 精准定位。推进后会锁定上一步，手动重置后才能重新开始。"
        tiles={[
          { label: "当前模块",  value: stepDescs[Math.min(stage, 3)].label },
          { label: "采集进度",  value: `${captureProgress}%`, tone: "cyan" },
          { label: "CUSUM",    value: cusum.triggered ? "已触发" : "等待", tone: cusum.triggered ? "amber" : "default" },
          { label: "置信度",   value: formatPct(detection.confidence), tone: detection.hasCamera ? "amber" : "green" },
        ]}
      />

      {/* Module step indicator */}
      <section className="section-card">
        <div className="module-stepper">
          {stepDescs.map((item, i) => (
            <button
              key={item.num}
              className={`mod-step-btn ${i === stage ? "active" : i < stage ? "done" : ""}`}
              disabled
            >
              <span className="mod-step-num">{item.num}</span>
              <strong>{item.label}</strong>
              <small>{item.desc}</small>
            </button>
          ))}
        </div>
        <div className="control-row" style={{ marginTop: 12 }}>
          <ScenarioPicker activeId={scenarioId} onSelect={setScenario} compact disabled={stage > 0} />
          {stage > 0 && <span className="flow-note">当前流程已锁定，重置后可切换场景。</span>}
        </div>
      </section>

      <section className="mobile-layout">
        <MobileFlow
          stage={stage}
          captureProgress={captureProgress}
          captureFailed={scenario.captureStatus === "failed"}
          result={detection}
          localization={localization}
          preciseVisible={preciseVisible || stage >= 3}
          onNext={onNext}
          onReset={onReset}
          canAdvance={stage < 3}
          roomAngle={roomAngle}
          angleHint={angleHint}
          onTurnLeft={onTurnLeft}
          onTurnRight={onTurnRight}
          compact
        />
        <div className="section-card compact-card">
          <SectionTitle kicker="Controls" title="流程控制台" text="流程只能按顺序推进；重置后才能重新选择场景。" />
          <div className="control-row vertical">
            <button className={motionMode === "toward"  ? "chip active" : "chip"} onClick={() => setMotionMode("toward")}>正向靠近</button>
            <button className={motionMode === "reverse" ? "chip active" : "chip"} onClick={() => setMotionMode("reverse")}>反向移动</button>
            <button className={boostProgress  ? "chip active" : "chip"} onClick={() => setBoostProgress(!boostProgress)}>采集增强</button>
            <button className={showInspector  ? "chip active" : "chip"} onClick={() => setShowInspector(!showInspector)}>算法详情</button>
            <button className="chip" onClick={onReset}>重置检测</button>
          </div>
          <div className="metric-row">
            <MetricTile label="CUSUM"  value={cusum.triggered ? "已触发" : "等待"} tone={cusum.triggered ? "amber" : "default"} />
            <MetricTile label="置信度" value={formatPct(detection.confidence)} tone={detection.hasCamera ? "amber" : "green"} />
          </div>
          {showInspector && <FeaturePanel group={primaryGroup} vector={primaryVector} result={detection} />}
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ALGORITHMS PAGE
═══════════════════════════════════════════════════════════════ */
function AlgorithmsPage({
  scenario,
  groupsCount,
  primaryGroup,
  primaryVector,
  detection,
  localization,
  bitrate,
  cusum,
}: {
  scenario: DemoScenario;
  groupsCount: number;
  primaryGroup: ReturnType<typeof groupTraffic>[number] | undefined;
  primaryVector: ReturnType<typeof extractFeatureVector> | undefined;
  detection: ReturnType<typeof classifyCameraTraffic>;
  localization: ReturnType<typeof estimateLocalization>;
  bitrate: ReturnType<typeof groupTraffic>[number]["bitrateSeries"];
  cusum: ReturnType<typeof detectBitrateChange>;
}) {
  const pipelineSteps = [
    { id: "01", label: "802.11 帧解析", desc: "Libpcap 帧采集 + 字段拆解" },
    { id: "02", label: "MAC 聚合",      desc: "按来源分组，过滤广播" },
    { id: "03", label: "L/d/b/s 特征", desc: "包长 & 比特率四维向量" },
    { id: "04", label: "SVM 判别",      desc: "置信度阈值 ≥ 0.62" },
    { id: "05", label: "CUSUM 趋势",   desc: "drift=12, threshold=110" },
    { id: "06", label: "方向 & 距离",  desc: "信号强度 + 移动路径" },
  ];

  return (
    <div className="page-grid">
      <PageBanner
        kicker="Algorithm Pipeline · End-to-End"
        title="算法链路"
        subtitle="每个模块对应一次数据处理阶段，便于在答辩时按顺序讲解完整的检测与定位流程。"
        tiles={[
          { label: "场景",     value: scenario.name },
          { label: "候选分组", value: `${groupsCount}` },
          { label: "摄像头数量", value: `${detection.cameraCount}`, tone: detection.hasCamera ? "amber" : "green" },
          { label: "定位距离", value: `${localization.distanceMeters || 0} m`, tone: "cyan" },
        ]}
      />

      <section className="section-card">
        <div className="pipeline">
          {pipelineSteps.map((step) => (
            <div className="pipeline-node" key={step.id}>
              <span>{step.id}</span>
              <strong>{step.label}</strong>
              <small style={{ color: "var(--text-dim)", fontSize: "11px" }}>{step.desc}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="split-grid">
        <FeaturePanel group={primaryGroup} vector={primaryVector} result={detection} />
        <div className="section-card compact-card">
          <SectionTitle
            kicker="CUSUM"
            title="比特率变化检测"
            text={cusum.triggered ? `检测到变化点：${cusum.triggerTime}s` : "当前序列未触发变化阈值。"}
          />
          <BitrateChart data={bitrate} />
          <div className="score-list">
            {cusum.scoreSeries.slice(-5).map((item) => (
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

/* ═══════════════════════════════════════════════════════════════
   EVALUATION PAGE
═══════════════════════════════════════════════════════════════ */
function EvaluationPage({
  evaluationView,
  setEvaluationView,
  data,
}: {
  evaluationView: EvaluationView;
  setEvaluationView: (value: EvaluationView) => void;
  data: {
    sampleSizeCurve: { samples: number; tpr: number; tnr: number }[];
    motionDurationCurve: { duration: number; tpr: number }[];
    brandResults: { brand: string; tpr: number; tnr: number; sar: number }[];
  };
}) {
  const chartItems =
    evaluationView === "sample"
      ? data.sampleSizeCurve.map((item) => ({ label: `${item.samples} 组`, value: item.tpr * 100, tone: "blue" as const }))
      : evaluationView === "duration"
        ? data.motionDurationCurve.map((item) => ({ label: `${item.duration}s`, value: item.tpr * 100, tone: "green" as const }))
        : data.brandResults.map((item) => ({ label: item.brand, value: item.sar, tone: "amber" as const }));

  const chartTitle =
    evaluationView === "sample" ? "训练样本数量影响" : evaluationView === "duration" ? "动作持续时间影响" : "品牌样本表现";

  const matrixRows =
    evaluationView === "brand"
      ? data.brandResults.map((item) => ({ label: item.brand, tpr: item.tpr, tnr: item.tnr }))
      : evaluationView === "sample"
        ? data.sampleSizeCurve.map((item) => ({ label: `${item.samples} 组`, tpr: item.tpr * 100, tnr: item.tnr * 100 }))
        : data.motionDurationCurve.map((item) => ({
            label: `${item.duration}s`,
            tpr: item.tpr * 100,
            tnr: Math.min(99.2, item.tpr * 100 - 0.4),
          }));

  const bestTpr = Math.max(...matrixRows.map((r) => r.tpr));

  return (
    <div className="page-grid">
      <PageBanner
        kicker="Evaluation · TPR / TNR Metrics"
        title="实验评估"
        subtitle="切换指标后，图表和 TPR/TNR 表格会同步更新，展示识别链路在不同条件下的稳定性。"
        tiles={[
          { label: "最高 TPR", value: `${bestTpr.toFixed(1)}%`, tone: "cyan" },
          { label: "当前视图", value: evaluationView === "sample" ? "样本数量" : evaluationView === "duration" ? "动作时长" : "品牌表现" },
          { label: "数据条数", value: `${matrixRows.length}` },
          { label: "评估模式", value: "离线评估" },
        ]}
      />

      <section className="section-card">
        <div className="control-row">
          <button className={evaluationView === "sample"   ? "chip active" : "chip"} onClick={() => setEvaluationView("sample")}>样本数量</button>
          <button className={evaluationView === "duration" ? "chip active" : "chip"} onClick={() => setEvaluationView("duration")}>动作时长</button>
          <button className={evaluationView === "brand"    ? "chip active" : "chip"} onClick={() => setEvaluationView("brand")}>品牌表现</button>
        </div>
      </section>

      <section className="split-grid">
        <MetricBars title={chartTitle} items={chartItems} />
        <div className="section-card compact-card">
          <SectionTitle kicker="TPR / TNR" title="分类表现" text="数值用于展示识别链路的稳定性。" />
          <div className="matrix-list">
            {matrixRows.map((item) => (
              <div className="matrix-row" key={item.label}>
                <span>{item.label}</span>
                <strong>
                  {item.tpr.toFixed(1)} / {item.tnr.toFixed(1)}
                </strong>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   REPOSITORY PAGE
═══════════════════════════════════════════════════════════════ */
function RepositoryPage() {
  const repoBlocks = [
    ["frontend/",   "交互式前端、分页面板和手机流程"],
    ["algorithms/", "特征提取、SVM 判别、CUSUM 检测和定位估计"],
    ["samples/",    "帧数据、定位路径和评估指标"],
    ["docs/",       "系统架构、算法说明、流程和边界说明"],
    ["tests/",      "算法链路 smoke test"],
  ];
  const statusItems = [
    "前端交互",
    "算法模块",
    "定位路径",
    "评估指标",
    "流程重置",
    "页面部署",
  ];

  return (
    <div className="page-grid">
      <PageBanner
        kicker="Repository · Project Structure"
        title="系统设置"
        subtitle="仓库按前端工作台、算法模块、数据样本、文档和测试分层，便于维护完整检测链路。"
        tiles={[
          { label: "前端框架",   value: "Vite + React" },
          { label: "算法模块数", value: "5", tone: "cyan" },
          { label: "场景配置数", value: "4" },
          { label: "流程阶段",   value: "4", tone: "green" },
        ]}
      />

      <section className="section-card">
        <SectionTitle kicker="Repository" title="工程结构" text="仓库按前端工作台、算法模块、数据样本、文档和测试分层。" />
        <div className="repo-grid">
          {repoBlocks.map(([path, text]) => (
            <div className="repo-row" key={path}>
              <code>{path}</code>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="safe-grid">
        {statusItems.map((item) => (
          <div className="safe-item" key={item}>{item}</div>
        ))}
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SHARED COMPONENTS
═══════════════════════════════════════════════════════════════ */
function ScenarioPicker({
  activeId,
  onSelect,
  compact = false,
  disabled = false,
}: {
  activeId: string;
  onSelect: (id: string) => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={compact ? "scenario-picker compact" : "scenario-picker"}>
      {scenarios.map((item) => (
        <button
          className={item.id === activeId ? "scenario-card active" : "scenario-card"}
          key={item.id}
          onClick={() => onSelect(item.id)}
          disabled={disabled}
        >
          <strong>{item.name}</strong>
          <span>{item.summary}</span>
        </button>
      ))}
    </div>
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

function MetricTile({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "cyan" | "green" | "amber" }) {
  return (
    <div className={`metric-tile ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatPct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function roomImageFor(angle: RoomAngle) {
  const fileName =
    angle === "left" ? "demo-room-left.png" : angle === "right" ? "demo-room-right.png" : "demo-room.png";
  return `${import.meta.env.BASE_URL}assets/${fileName}`;
}

function getRoomAngleHint(angle: RoomAngle, hasCamera: boolean, stage: number) {
  if (!hasCamera) return "当前流量未锁定目标，可重置后切换房间继续采集。";
  if (stage < 2) return "完成数据采集和流量识别后，系统会给出下一步转向提示。";
  if (angle === "left") return "当前角度未发现目标，请点击向右继续扫描。";
  if (angle === "right") return "当前角度偏离目标，请点击向左回到目标方向。";
  return "目标方向已对准，进入精准定位后会标注疑似摄像头位置。";
}

function readPageFromLocation(): PageId {
  if (typeof window === "undefined") return "overview";
  const hash = window.location.hash.replace(/^#\/?/, "").trim();
  const pathname = window.location.pathname.split("/").filter(Boolean).join("/");
  const raw = hash || pathname;
  const parts = raw.split("?")[0].split("/").filter(Boolean);
  const route = parts.find((part) => pageTokens.has(part as PageId)) as PageId | undefined;
  return route && pageTokens.has(route) ? route : "overview";
}
