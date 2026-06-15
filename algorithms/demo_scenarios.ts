export const demoScenarios = [
  {
    id: "camera-present",
    name: "检测到摄像头",
    captureStatus: "success",
    localizationMode: "toward",
    summary: "模拟检测到一台无线摄像头，进入粗略定位和精准定位流程。",
  },
  {
    id: "no-camera",
    name: "未检测到摄像头",
    captureStatus: "success",
    localizationMode: "outside",
    summary: "采集成功，但 SVM 判断当前数据包中没有摄像头特征。",
  },
  {
    id: "capture-failed",
    name: "采集失败",
    captureStatus: "failed",
    localizationMode: "outside",
    summary: "模拟当前网络环境较差，无法获得足够数据包。",
  },
  {
    id: "reverse-needed",
    name: "需要反向移动",
    captureStatus: "success",
    localizationMode: "reverse",
    summary: "检测到摄像头，但比特率趋势提示用户需要向反方向移动。",
  },
];

