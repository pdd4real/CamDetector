# CamDetector - 隐藏无线摄像头智能感知平台

CamDetector 是一个面向比赛展示的无线摄像头发现与定位系统。项目通过合成 802.11 数据帧演示完整链路：采集周围无线流量、解析帧字段、按 MAC 聚合、提取包长与比特率特征、使用 SVM 风格分类器识别摄像头流量、通过 CUSUM 趋势检测辅助定位，并在房间画面中标注疑似摄像头位置。

本仓库是可运行的演示型项目，不执行真实 Wi-Fi 抓包、不提供破解命令、不连接真实摄像头，也不包含个人信息。

## 快速导航

| 想要了解 | 入口 |
| --- | --- |
| 在线展示 | GitHub Pages 部署后的首页 |
| 本地运行 | [启动说明](./启动说明.md) |
| 前端演示 | [frontend](./frontend) |
| 算法链路 | [algorithms](./algorithms) |
| 系统文档 | [docs](./docs) |
| 合成样本 | [samples](./samples) |

## 在线平台模块

前端参考完整安全平台的组织方式，包含以下模块：

- 首页：项目定位、核心能力、数据指标、技术架构、演示入口。
- 检测控制台：模拟数据采集、802.11 帧表格、特征向量、SVM 识别结果、CDF 与比特率图表。
- 定位工作台：雷达方向提示、CUSUM 趋势、房间画面红框标注、距离估计。
- 移动端流程：手机式四步交互，适合录屏或嵌入答辩 PPT。
- 高级工具：Packet Parser、Feature Extractor、SVM、CUSUM、Locator 的可视化链路。
- 风险报告：TPR/TNR、样本数量、动作时长和品牌样本表现。
- 系统设置：工程结构、安全边界和演示限制说明。

## 核心技术

### 802.11 帧解析

合成样本模拟周围无线帧元数据，包括时间戳、源 MAC、目的 MAC、帧类型、子类型、包长和信号强度。演示层展示帧列表和按 MAC 聚合后的候选流。

### 特征工程

每个候选设备会生成四维特征向量：

- `L`：包长均值归一化特征
- `d`：包长离散度
- `b`：比特率突发度
- `s`：比特率平滑度

### SVM 风格识别

仓库中的分类器使用固定权重模拟线性 SVM 输出置信度，用于演示“摄像头流量”和“非摄像头流量”的判别逻辑。

### CUSUM 定位辅助

定位模块根据比特率序列变化计算 CUSUM 分数，结合移动轨迹和信号强度，输出继续前进、反方向移动或当前房间无目标的提示。

## 项目结构

```text
camdetector-demo-repo/
├── .github/workflows/      # GitHub Pages 自动部署
├── algorithms/             # 模拟算法模块
│   ├── packet_parser.ts
│   ├── feature_extractor.ts
│   ├── svm_classifier.ts
│   ├── cusum_detector.ts
│   └── locator.ts
├── docs/                   # 架构、算法、流程和边界说明
├── frontend/               # Vite + React + TypeScript 展示站
├── samples/                # 合成帧、定位和评估数据
├── tests/                  # 算法 smoke test
├── README.md
└── 启动说明.md
```

## 本地运行

```bash
cd frontend
npm install
npm run dev
```

浏览器打开 Vite 输出的地址即可访问完整展示站。

构建静态页面：

```bash
cd frontend
npm run build
```

## 测试

```bash
node tests/algorithm_smoke_test.mjs
```

该测试验证摄像头样本可被识别、非摄像头样本不会误报，并检查 CUSUM 是否能检测到比特率突变。

## 数据与安全边界

- 所有帧数据均来自仓库内 JSON 或 TypeScript 合成样本。
- 不调用 Libpcap、Aircrack-ng、Android NDK 或系统 Wi-Fi API。
- 不提供真实抓包、破解、绕过认证或设备控制命令。
- 页面只用于比赛展示、流程讲解和静态部署。

## 部署

仓库已包含 GitHub Actions Pages 部署流程。推送到 `main` 后，Actions 会构建 `frontend/dist` 并自动发布到 GitHub Pages。

