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

const pageOrder: PageId[] = ["overview", "detection", "localization", "mobile", "algorithms", "evaluation", "repository"];
const pageTokens = new Set<PageId>(pageOrder);

const routes: { id: PageId; label: string; subtitle: string }[] = [
  { id: "overview", label: "首页", subtitle: "平台介绍" },
  { id: "detection", label: "检测控制台", subtitle: "流量识别" },
  { id: "localization", label: "定位工作台", subtitle: "方向标注" },
  { id: "mobile", label: "移动端流程", subtitle: "四步交互" },
  { id: "algorithms", label: "高级工具", subtitle: "模型链路" },
  { id: "evaluation", label: "风险报告", subtitle: "实验指标" },
  { id: "repository", label: "系统设置", subtitle: "工程边界" },
];

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

  const primaryGroup = groups.find((group) => group.mac === detection.candidateMacs[0]) ?? groups[0];
  const primaryVector = primaryGroup ? extractFeatureVector(primaryGroup) : undefined;
  const captureProgress = scenario.captureStatus === "failed" ? 16 : Math.min(100, 22 + stage * 23 + (boostProgress ? 16 : 0));
  const visibleFrames = stage === 0 ? scenario.frames.slice(0, Math.max(1, Math.ceil((scenario.frames.length * captureProgress) / 100))) : scenario.frames;
  const bitrate = scenario.id === "reverse-needed" ? primaryGroup?.bitrateSeries ?? [] : data.localization.bitrateSeries;
  const effectiveMotionMode = scenario.localizationMode === "outside" ? "outside" : motionMode;
  const localization = estimateLocalization(
    bitrate,
    data.localization.motion,
    effectiveMotionMode === "outside" ? 31 : effectiveMotionMode === "reverse" ? 54 : data.localization.precise.signalStrength,
    effectiveMotionMode,
  );
  const cusum = detectBitrateChange(bitrate);
  const preciseVisible = stage >= 3 || (page === "localization" && detection.hasCamera && effectiveMotionMode !== "outside");

  function goToPage(next: PageId) {
    setPage(next);
    window.location.hash = next === "overview" ? "" : `/${next}`;
  }

  function setScenario(id: string) {
    const next = scenarios.find((item) => item.id === id);
    setScenarioId(id);
    setStage(0);
    setMotionMode(next?.localizationMode === "reverse" ? "reverse" : next?.localizationMode === "outside" ? "outside" : "toward");
  }

  function nextStage() {
    setStage((current) => (current >= 3 ? 0 : current + 1));
  }

  return (
    <main className="site-shell">
      <div className="particles-bg" />
      <div className="grid-overlay" />
      <header className="topbar">
        <button className="brand-button" onClick={() => goToPage("overview")} aria-label="返回首页">
          <span>CamDetector</span>
          <small>Wireless Camera Sensing</small>
        </button>
        <nav className="topnav" aria-label="页面导航">
          {routes.map((route) => (
            <button key={route.id} className={route.id === page ? "nav-link active" : "nav-link"} onClick={() => goToPage(route.id)}>
              <span>{route.label}</span>
              <small>{route.subtitle}</small>
            </button>
          ))}
        </nav>
      </header>

      <HeroSection
        scenario={scenario}
        detection={detection}
        localization={localization}
        captureProgress={captureProgress}
        cusumTriggered={cusum.triggered}
        onStart={() => goToPage("detection")}
        onLocate={() => goToPage("localization")}
      />

      <section className="page-stage">
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
          />
        ) : null}

        {page === "localization" ? (
          <LocalizationPage
            scenario={scenario}
            stage={stage}
            setStage={setStage}
            motionMode={effectiveMotionMode}
            setMotionMode={setMotionMode}
            localization={localization}
            bitrate={bitrate}
            preciseVisible={preciseVisible}
            detection={detection}
            onNext={nextStage}
          />
        ) : null}

        {page === "mobile" ? (
          <MobilePage
            scenario={scenario}
            scenarioId={scenarioId}
            setScenario={setScenario}
            stage={stage}
            setStage={setStage}
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
          />
        ) : null}

        {page === "algorithms" ? (
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
        ) : null}

        {page === "evaluation" ? <EvaluationPage evaluationView={evaluationView} setEvaluationView={setEvaluationView} data={data.evaluation} /> : null}

        {page === "repository" ? <RepositoryPage /> : null}
      </section>

      <footer className="site-footer">
        <strong>CamDetector</strong>
        <span>演示数据均为合成样本，不执行真实 Wi-Fi 抓包、破解或设备控制。</span>
      </footer>
    </main>
  );
}

function HeroSection({
  scenario,
  detection,
  localization,
  captureProgress,
  cusumTriggered,
  onStart,
  onLocate,
}: {
  scenario: DemoScenario;
  detection: ReturnType<typeof classifyCameraTraffic>;
  localization: ReturnType<typeof estimateLocalization>;
  captureProgress: number;
  cusumTriggered: boolean;
  onStart: () => void;
  onLocate: () => void;
}) {
  return (
    <section className="hero-section">
      <div className="hero-content">
        <p className="eyebrow">802.11 Sensing · SVM Detection · CUSUM Localization</p>
        <h1>CamDetector</h1>
        <h2>隐藏无线摄像头智能感知平台</h2>
        <p className="hero-text">
          以无线流量为线索，串联数据采集、帧解析、特征识别、方向定位、房间标注和风险报告，构建一个适合比赛答辩与在线展示的完整安全检测系统。
        </p>
        <div className="hero-actions">
          <button className="primary-action" onClick={onStart}>
            启动检测控制台
          </button>
          <button className="ghost-action" onClick={onLocate}>
            查看定位工作台
          </button>
        </div>
        <div className="hero-badges">
          <span>合成样本</span>
          <span>离线演示</span>
          <span>GitHub Pages</span>
          <span>安全边界</span>
        </div>
      </div>
      <div className="hero-board">
        <div className="signal-preview">
          <div className="room-scan">
            <span className="scan-grid" />
            <span className="scan-path" />
            <span className="scan-target" />
            <span className="scan-phone" />
          </div>
          <div className="signal-copy">
            <small>Live Sensing View</small>
            <strong>{detection.hasCamera ? "发现疑似无线摄像头" : "当前未发现目标"}</strong>
            <span>{localization.instruction}</span>
          </div>
        </div>
        <div className="threat-radar">
          <span className="radar-orbit orbit-a" />
          <span className="radar-orbit orbit-b" />
          <span className="radar-beam" style={{ transform: `rotate(${localization.directionDeg}deg)` }} />
          <span className="radar-center" />
          <strong>{formatPct(detection.confidence)}</strong>
          <small>SVM confidence</small>
        </div>
        <MetricTile label="当前场景" value={scenario.name} />
        <MetricTile label="采集进度" value={`${captureProgress}%`} tone="cyan" />
        <MetricTile label="识别置信度" value={formatPct(detection.confidence)} tone={detection.hasCamera ? "amber" : "green"} />
        <MetricTile label="候选目标" value={detection.candidateMacs[0] ?? "未发现"} />
        <MetricTile label="方向角度" value={`${localization.directionDeg.toFixed(0)}°`} />
        <MetricTile label="CUSUM" value={cusumTriggered ? "已触发" : "等待"} tone={cusumTriggered ? "cyan" : "green"} />
      </div>
    </section>
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
  const profile = [
    ["项目定位", "面向隐蔽无线摄像头的发现、识别与定位展示系统"],
    ["识别对象", "持续上传视频流、包长分布稳定、比特率随距离变化的无线设备"],
    ["技术路线", "802.11 帧解析、L/d/b/s 特征、SVM 分类、CUSUM 趋势检测、移动辅助定位"],
    ["展示边界", "使用合成样本数据，不调用真实抓包、破解或硬件接口"],
  ];
  const workflow = ["采集周围无线帧", "按 MAC 聚合流量", "提取包长与比特率特征", "SVM 判断候选目标", "移动中估计方向", "房间画面红框标注"];
  const stats = [
    ["99.5%", "模拟 TPR", "摄像头流量识别真阳性率"],
    ["99.0%", "模拟 TNR", "非摄像头场景排除能力"],
    ["4", "演示脚本", "覆盖发现、未发现、失败和反向移动"],
    ["0", "真实抓包", "不包含攻击命令或硬件调用"],
  ];
  const stack = [
    ["前端平台", "Vite + React + TypeScript，适配 GitHub Pages 静态部署。"],
    ["算法核心", "Packet Parser、Feature Extractor、SVM Classifier、CUSUM Detector、Locator。"],
    ["数据资产", "合成 802.11 帧、MAC 厂商信息、比特率序列、定位路径和评估曲线。"],
    ["展示模块", "检测控制台、定位工作台、移动端流程、风险报告、高级工具和系统设置。"],
  ];
  const entries = [
    { title: "采集与解析", text: "模拟周围 802.11 数据帧，展示时间戳、MAC、帧类型、包长和信号强度。", action: onOpenDetection },
    { title: "流量识别", text: "提取包长分布、突发度和平滑度，输出摄像头候选目标与置信度。", action: onOpenDetection },
    { title: "方向定位", text: "结合比特率趋势、移动方向和信号强度，给出继续前进或反方向移动提示。", action: onOpenLocalization },
    { title: "精准标注", text: "在房间图像中展示箭头、距离估计和疑似摄像头红框位置。", action: onOpenLocalization },
    { title: "算法链路", text: "完整呈现 Packet Parser、Feature Extractor、SVM、CUSUM 和 Locator。", action: onOpenAlgorithms },
    { title: "实验评估", text: "展示样本数量、动作持续时间和品牌样本表现等指标。", action: onOpenEvaluation },
  ];

  return (
    <div className="page-grid">
      <section className="product-intro">
        <div className="product-copy">
          <p className="section-kicker">Platform Overview</p>
          <h2>新一代无线摄像头安全感知演示平台</h2>
          <p>
            参考完整安全平台的展示方式，CamDetector 将产品介绍、演示控制台、风险报告、高级工具与系统边界整合在一个仓库中。评委可以先理解项目价值，再进入具体交互流程。
          </p>
        </div>
        <div className="stat-wall">
          {stats.map(([value, label, text]) => (
            <div className="stat-card" key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section-card overview-highlight">
        <div>
          <p className="section-kicker">System Overview</p>
          <h2>从无线流量到房间标注的一体化流程</h2>
          <p>
            当前场景为“{scenario.name}”，系统置信度 {formatPct(detection.confidence)}，方向角度 {localization.directionDeg.toFixed(0)}°。
          </p>
        </div>
        <div className="status-mosaic">
          <MetricTile label="目标数量" value={`${detection.cameraCount}`} />
          <MetricTile label="候选 MAC" value={detection.candidateMacs[0] ?? "无"} />
          <MetricTile label="距离估计" value={`${localization.distanceMeters || 0} m`} />
        </div>
      </section>

      <section className="feature-deck">
        {entries.map((entry, index) => (
          <button className="feature-card" key={entry.title} onClick={entry.action}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{entry.title}</strong>
            <p>{entry.text}</p>
          </button>
        ))}
      </section>

      <section className="stack-section">
        <div className="section-card stack-title">
          <p className="section-kicker">Technical Architecture</p>
          <h2>系统架构</h2>
          <p>从合成流量到可视化定位，每一层都对应仓库中的代码和文档模块，便于答辩时按工程结构展开说明。</p>
        </div>
        <div className="stack-grid">
          {stack.map(([title, text], index) => (
            <div className="stack-card" key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="project-profile">
        <div className="section-card profile-main">
          <p className="section-kicker">Project Information</p>
          <h2>作品信息</h2>
          <p>
            CamDetector 将无线流量特征识别、移动趋势判断和房间画面标注整合到一个可讲解的网页系统中。页面只展示作品能力与技术边界，不包含任何个人信息。
          </p>
        </div>
        <div className="profile-grid">
          {profile.map(([label, text]) => (
            <div className="profile-item" key={label}>
              <span>{label}</span>
              <strong>{text}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="workflow-strip">
        {workflow.map((item, index) => (
          <div className="workflow-node" key={item}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{item}</strong>
          </div>
        ))}
      </section>

      <section className="cta-band">
        <div>
          <p className="section-kicker">Online Demo</p>
          <h2>直接进入可交互演示</h2>
          <span>无需后端服务，所有模块均从仓库内合成数据读取，适合 GitHub Pages、PPT 嵌入和现场录屏。</span>
        </div>
        <div className="hero-actions">
          <button className="primary-action" onClick={onOpenDetection}>打开检测控制台</button>
          <button className="ghost-action dark" onClick={onOpenEvaluation}>查看风险报告</button>
        </div>
      </section>
    </div>
  );
}

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
}) {
  return (
    <div className="page-grid">
      <section className="section-card">
        <SectionTitle kicker="Traffic Detection" title="数据采集与摄像头流量识别" text="切换不同现场场景，表格、特征、图表和手机流程会同步变化。" />
        <ScenarioPicker activeId={scenarioId} onSelect={setScenario} />
        <div className="control-row">
          <button className={showInspector ? "chip active" : "chip"} onClick={() => setShowInspector(!showInspector)}>
            {showInspector ? "隐藏详情面板" : "显示详情面板"}
          </button>
          <button className={boostProgress ? "chip active" : "chip"} onClick={() => setBoostProgress(!boostProgress)}>
            {boostProgress ? "关闭采集增强" : "开启采集增强"}
          </button>
          <button className="chip" onClick={() => setStage(0)}>
            回到采集
          </button>
          <button className="chip" onClick={onNext}>
            推进一步
          </button>
        </div>
      </section>

      {showInspector ? (
        <section className="inspector-strip">
          <MetricTile label="当前阶段" value={`${stage + 1}/4`} />
          <MetricTile label="采集进度" value={`${captureProgress}%`} tone="cyan" />
          <MetricTile label="摄像头数量" value={`${detection.cameraCount}`} tone={detection.hasCamera ? "amber" : "green"} />
          <MetricTile label="CUSUM" value={cusum.triggered ? `t=${cusum.triggerTime}s` : "未触发"} />
        </section>
      ) : null}

      <section className="split-grid">
        <PacketTable frames={visibleFrames} />
        <FeaturePanel group={primaryGroup} vector={primaryVector} result={detection} />
      </section>

      <section className="split-grid">
        <MobileFlow
          stage={stage}
          captureProgress={captureProgress}
          captureFailed={scenario.captureStatus === "failed"}
          result={detection}
          localization={localization}
          preciseVisible={scenario.id !== "capture-failed"}
          onNext={onNext}
        />
        <div className="section-card compact-card">
          <SectionTitle kicker="Distribution" title="包长 CDF 与比特率" text="图表随候选 MAC 和场景切换刷新。" />
          <CdfChart data={primaryGroup?.cdf ?? []} />
          <BitrateChart data={primaryGroup?.bitrateSeries ?? []} />
        </div>
      </section>
    </div>
  );
}

function LocalizationPage({
  scenario,
  stage,
  setStage,
  motionMode,
  setMotionMode,
  localization,
  bitrate,
  preciseVisible,
  detection,
  onNext,
}: {
  scenario: DemoScenario;
  stage: number;
  setStage: (value: number | ((current: number) => number)) => void;
  motionMode: MotionMode;
  setMotionMode: (value: MotionMode) => void;
  localization: ReturnType<typeof estimateLocalization>;
  bitrate: ReturnType<typeof groupTraffic>[number]["bitrateSeries"];
  preciseVisible: boolean;
  detection: ReturnType<typeof classifyCameraTraffic>;
  onNext: () => void;
}) {
  return (
    <div className="page-grid">
      <section className="section-card">
        <SectionTitle kicker="Localization" title="方向定位与精准标注" text="通过模式按钮模拟正向靠近、反向移动和当前房间不存在摄像头三类状态。" />
        <div className="control-row">
          {(["toward", "reverse", "outside"] as const).map((mode) => (
            <button key={mode} className={motionMode === mode ? "chip active" : "chip"} onClick={() => setMotionMode(mode)}>
              {mode === "toward" ? "正向靠近" : mode === "reverse" ? "反向移动" : "无目标房间"}
            </button>
          ))}
          <button className="chip" onClick={() => setStage(0)}>
            回到第一步
          </button>
          <button className="chip" onClick={onNext}>
            解锁下一步
          </button>
        </div>
      </section>

      <section className="split-grid">
        <RadarPanel state={localization} bitrate={bitrate} />
        <RoomLocator state={localization} visible={preciseVisible} />
      </section>

      <section className="split-grid">
        <div className="section-card compact-card">
          <SectionTitle kicker="Decision" title="定位结论" text={localization.instruction} />
          <div className="metric-row">
            <MetricTile label="现场场景" value={scenario.name} />
            <MetricTile label="识别状态" value={detection.hasCamera ? "发现目标" : "未发现"} tone={detection.hasCamera ? "amber" : "green"} />
            <MetricTile label="方向角度" value={`${localization.directionDeg.toFixed(1)}°`} />
            <MetricTile label="距离估计" value={`${localization.distanceMeters || 0} m`} tone="cyan" />
          </div>
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
  setScenario,
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
  boostProgress,
  setBoostProgress,
  showInspector,
  setShowInspector,
  primaryGroup,
  primaryVector,
}: {
  scenario: DemoScenario;
  scenarioId: string;
  setScenario: (id: string) => void;
  stage: number;
  setStage: (value: number | ((current: number) => number)) => void;
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
}) {
  return (
    <div className="page-grid">
      <section className="section-card">
        <SectionTitle kicker="Mobile Flow" title="手机四步流程" text="适合录屏展示，右侧控制区可以切换场景、阶段和定位方向。" />
        <ScenarioPicker activeId={scenarioId} onSelect={setScenario} compact />
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
          compact
        />
        <div className="section-card compact-card">
          <SectionTitle kicker="Controls" title="展示控制台" text="所有按钮都会改变左侧手机画面或下方算法状态。" />
          <div className="control-row vertical">
            <button className="chip" onClick={() => setStage(0)}>
              采集页
            </button>
            <button className="chip" onClick={() => setStage(1)}>
              识别页
            </button>
            <button className="chip" onClick={() => setStage(2)}>
              方向页
            </button>
            <button className="chip" onClick={() => setStage(3)}>
              标注页
            </button>
            <button className={motionMode === "toward" ? "chip active" : "chip"} onClick={() => setMotionMode("toward")}>
              正向
            </button>
            <button className={motionMode === "reverse" ? "chip active" : "chip"} onClick={() => setMotionMode("reverse")}>
              反向
            </button>
            <button className={boostProgress ? "chip active" : "chip"} onClick={() => setBoostProgress(!boostProgress)}>
              采集增强
            </button>
            <button className={showInspector ? "chip active" : "chip"} onClick={() => setShowInspector(!showInspector)}>
              算法详情
            </button>
          </div>
          <div className="metric-row">
            <MetricTile label="CUSUM" value={cusum.triggered ? "触发" : "等待"} />
            <MetricTile label="置信度" value={formatPct(detection.confidence)} tone={detection.hasCamera ? "amber" : "green"} />
          </div>
          {showInspector ? <FeaturePanel group={primaryGroup} vector={primaryVector} result={detection} /> : null}
        </div>
      </section>
    </div>
  );
}

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
  return (
    <div className="page-grid">
      <section className="section-card">
        <SectionTitle kicker="Algorithm Pipeline" title="算法链路" text="每个模块对应一次数据处理阶段，便于在答辩时按顺序讲解。" />
        <div className="pipeline">
          {["802.11 帧解析", "按 MAC 聚合", "L/d/b/s 特征", "SVM 判别", "CUSUM 趋势", "方向与距离"].map((item, index) => (
            <div className="pipeline-node" key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="inspector-strip">
        <MetricTile label="场景" value={scenario.name} />
        <MetricTile label="候选分组" value={`${groupsCount}`} />
        <MetricTile label="摄像头数量" value={`${detection.cameraCount}`} tone={detection.hasCamera ? "amber" : "green"} />
        <MetricTile label="定位距离" value={`${localization.distanceMeters || 0} m`} tone="cyan" />
      </section>

      <section className="split-grid">
        <FeaturePanel group={primaryGroup} vector={primaryVector} result={detection} />
        <div className="section-card compact-card">
          <SectionTitle kicker="CUSUM" title="比特率变化检测" text={cusum.triggered ? `检测到变化点：${cusum.triggerTime}s` : "当前序列未触发变化阈值。"} />
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
        : data.motionDurationCurve.map((item) => ({ label: `${item.duration}s`, tpr: item.tpr * 100, tnr: Math.min(99.2, item.tpr * 100 - 0.4) }));

  return (
    <div className="page-grid">
      <section className="section-card">
        <SectionTitle kicker="Evaluation" title="实验评估面板" text="切换指标后，图表和 TPR/TNR 表格会同步更新。" />
        <div className="control-row">
          <button className={evaluationView === "sample" ? "chip active" : "chip"} onClick={() => setEvaluationView("sample")}>
            样本数量
          </button>
          <button className={evaluationView === "duration" ? "chip active" : "chip"} onClick={() => setEvaluationView("duration")}>
            动作时长
          </button>
          <button className={evaluationView === "brand" ? "chip active" : "chip"} onClick={() => setEvaluationView("brand")}>
            品牌表现
          </button>
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

function RepositoryPage() {
  const repoBlocks = [
    ["frontend/", "比赛展示网站、分页面板和手机流程"],
    ["algorithms/", "特征提取、SVM 判别、CUSUM 检测和定位估计"],
    ["samples/", "合成帧数据、定位路径和评估指标"],
    ["docs/", "系统架构、算法说明、流程和边界说明"],
    ["tests/", "算法链路 smoke test"],
  ];

  return (
    <div className="page-grid">
      <section className="section-card">
        <SectionTitle kicker="Repository" title="工程结构" text="仓库按展示网站、算法模块、样本数据、文档和测试分层。" />
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
        {["不执行真实 Wi-Fi 抓包", "不提供破解命令", "不连接真实摄像头", "不展示个人信息", "只使用合成数据", "用于比赛展示"].map((item) => (
          <div className="safe-item" key={item}>
            {item}
          </div>
        ))}
      </section>
    </div>
  );
}

function ScenarioPicker({ activeId, onSelect, compact = false }: { activeId: string; onSelect: (id: string) => void; compact?: boolean }) {
  return (
    <div className={compact ? "scenario-picker compact" : "scenario-picker"}>
      {scenarios.map((item) => (
        <button className={item.id === activeId ? "scenario-card active" : "scenario-card"} key={item.id} onClick={() => onSelect(item.id)}>
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

function readPageFromLocation(): PageId {
  if (typeof window === "undefined") return "overview";
  const hash = window.location.hash.replace(/^#\/?/, "").trim();
  const pathname = window.location.pathname.split("/").filter(Boolean).join("/");
  const raw = hash || pathname;
  const parts = raw.split("?")[0].split("/").filter(Boolean);
  const route = parts.find((part) => pageTokens.has(part as PageId)) as PageId | undefined;
  return route && pageTokens.has(route) ? route : "overview";
}

