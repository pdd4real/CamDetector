# CamDetector Demo Repo

CamDetector is a demo repository built from the project book's idea: detect and locate hidden wireless cameras by observing nearby 802.11 traffic. This repo is intentionally presentation-oriented. It does not perform real Wi-Fi capture, device exploitation, password cracking, or hardware access.

The demo shows the full product story:

- collect surrounding Wi-Fi packet metadata
- group traffic by MAC address
- extract packet-length and bitrate features
- classify camera-like traffic with a simulated SVM
- detect bitrate changes with a CUSUM-style score
- guide the user through coarse direction and precise localization
- mark the estimated camera position in a room image

## Repository Layout

```text
camdetector-demo-repo/
  algorithms/   TypeScript-like pseudo implementation of the detection pipeline
  docs/         Architecture, algorithm notes, demo flow, and limitations
  frontend/     Vite + React + TypeScript demo application
  samples/      Simulated packet, localization, and evaluation data
  tests/        Dependency-free smoke test for core simulation behavior
```

## Quick Demo

The repo contains two frontend entry points:

1. Standard React app:

```bash
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite. The React app supports:

- `/` full dashboard
- `/mobile` phone-only flow for recording or embedding in slides

2. No-install fallback:

Open `frontend/standalone.html` directly in a browser. It contains the same four-step CamDetector story with embedded data and no package install.

## Demo Scenarios

The UI includes four scripted scenarios:

- `camera-present`: detects camera traffic and completes localization
- `no-camera`: packet collection succeeds but classification returns no camera
- `capture-failed`: collection cannot obtain usable packets
- `reverse-needed`: coarse localization asks the user to move in the opposite direction

## Safety Boundary

The project names Libpcap, Aircrack-ng, Android NDK, and 802.11 only to mirror the original system architecture. This demo does not include operational capture commands or attack workflows. All packet frames are synthetic JSON records.

## Local Test

Run the dependency-free smoke test:

```bash
node tests/algorithm_smoke_test.mjs
```

It verifies that synthetic camera traffic produces a camera classification, that non-camera traffic does not, and that bitrate changes trigger the CUSUM-style detector.

