# Algorithm Notes

This repository contains a readable simulation of the original algorithm ideas.

## Packet Grouping

`packet_parser.ts` accepts synthetic `PacketFrame` data and groups frames by candidate device MAC. A frame contributes to a group when either `source` or `destination` matches the candidate MAC.

## Feature Vector

`feature_extractor.ts` computes a four-dimensional vector:

- `L`: normalized mean packet length
- `d`: packet-length dispersion
- `b`: bitrate burst score
- `s`: temporal smoothness score

Wireless cameras are modeled as devices with repeated video-frame transport behavior: larger packet lengths, bursty bitrate windows, and smoother active streaming periods than ordinary background devices.

## SVM Surrogate

`svm_classifier.ts` uses fixed coefficients to emulate a trained linear SVM:

```text
score = 1.15L + 0.72d + 1.45b + 0.95s - 1.85
confidence = sigmoid(score)
```

The coefficients are demo parameters, not a real trained model.

## CUSUM-Style Change Detection

`cusum_detector.ts` keeps an accumulated positive deviation from a baseline bitrate. When the accumulated deviation crosses a threshold, the demo treats it as evidence that the user's movement changed the camera's video bitrate.

## Localization

`locator.ts` combines:

- bitrate gradient
- signal strength
- user movement vector
- scenario script metadata

The output is a user-facing instruction, direction angle, signal strength percentage, and estimated distance in meters.

