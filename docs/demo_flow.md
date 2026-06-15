# Demo Flow

## Recommended Presentation Path

1. Select `camera-present`.
2. Start collection and show the packet table filling with synthetic 802.11 frames.
3. Move to traffic recognition and point out:
   - CDF chart
   - four-dimensional feature vector
   - SVM confidence
   - candidate camera MAC
4. Move to direction localization and show:
   - radar heading
   - bitrate line
   - movement instruction
5. Move to precise localization and show:
   - room image
   - red detection box
   - arrow
   - signal strength
   - distance estimate
6. Switch to `no-camera` and `capture-failed` to show failure states.

## Mobile-Only View

Open `/mobile` in the React app for a phone-screen-only flow. This is intended for screen recording or embedding in a slide deck.

## Standalone View

Open `frontend/standalone.html` when Node dependencies are not installed. It runs without Vite and still demonstrates the four main stages.

