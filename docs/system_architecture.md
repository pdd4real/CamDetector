# System Architecture

CamDetector is modeled as a three-layer system.

## Data Sensing Layer

The original concept uses a phone in monitor-like collection mode to observe nearby 802.11 frames. In this demo, the layer is represented by synthetic packet records:

- timestamp
- source MAC
- destination MAC
- frame type and subtype
- packet length
- received signal strength

The demo intentionally does not call Libpcap, Aircrack-ng, Android NDK, or platform Wi-Fi APIs.

## Data Processing Layer

The processing layer has two modules.

Camera awareness:

- parse frames
- group frames by MAC address
- compute CDF and bitrate series
- extract `L,d,b,s` feature vectors
- classify camera-like traffic with a fixed-weight SVM surrogate

Camera localization:

- track user motion steps
- detect bitrate change with a CUSUM-style score
- estimate direction from bitrate gradient and signal strength
- estimate distance from normalized signal level

## Application Interaction Layer

The frontend reproduces the project book's four-step interaction:

1. Data collection
2. Traffic recognition
3. Direction localization
4. Precise localization

The app also includes packet tables, CDF charts, bitrate charts, a radar panel, status cards, and a room image with the detected camera marked.

