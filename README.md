# KineticType CV

**Real-Time Computer Vision Touch-Typing Coach & Biomechanical Analytics Engine**

KineticType CV fuses 60 FPS GPU hand-landmark tracking (`@mediapipe/tasks-vision`) with OS-level `keydown` telemetry to analyze *how* you type—detecting wrong-finger reaches, measuring fingertip travel efficiency, flagging home-row drift, and dynamically generating targeted weakness drills.

---

## Key Features

- **60 FPS MediaPipe GPU Hand Tracking:** Tracks all 21 landmarks across both hands (`numHands: 2`) with a circular ring buffer that temporally interpolates fingertip coordinates to exact `keydown` timestamps.
- **Pure-TypeScript 4-Corner Homography Solver:** Uses Direct Linear Transformation (DLT) solved via Gaussian elimination with partial pivoting to map webcam coordinates onto normalized 2D keyboard space $[0, 1] \times [0, 1]$—with zero heavy OpenCV WASM dependencies.
- **Interactive Calibration Studio:** Includes one-click Sobel edge-gradient auto-corner detection, draggable corner pins (`Esc`, `Backspace`, `Left Ctrl`, `Right Ctrl`), live inverse-homography ($H^{-1}$) key-grid wireframe projection, `F`/`J` fine-tuning nudges, and hover parallax compensation.
- **Multi-Layout Support:** Switch seamlessly between **QWERTY (ANSI)**, **QWERTY (ISO)**, and **AZERTY (FR/MA)** with full canonical touch-typing finger zone mapping.
- **Live Biomechanical Keymap & Audio Coaching:**
  - Real-time SVG virtual keyboard with fingertip motion trails, emerald/coral strike feedback, and live wrong-finger callouts (e.g., *"Used R-Index instead of R-Middle"*).
  - Zero-dependency Web Audio synthesizer providing subtle mechanical clicks and immediate wrong-finger coaching alerts.
- **Post-Run Biomechanical Diagnostics:**
  - **10-Finger Performance & SFB Matrix:** Per-finger WPM, strike latency (ms), form compliance %, and Same-Finger Bigram (SFB) vertical jump penalties.
  - **Slow-Motion Mistake Skeleton Replay:** Frame-by-frame 21-landmark SVG replay of your hand trajectory leading into wrong-finger strikes.
  - **Ergonomic & Fatigue Guard:** Tracks idle `F`/`J` home-row drift, ulnar wrist deviation, and late-run travel spikes.
- **Adaptive & Developer Drill Modes:** Timed runs (`15s`, `30s`, `60s`), `50 words`, **AI Weakness Drill** (weighted by error keys and slow bigrams), **Code: TS/Rust**, **Code: Python**, and **Custom Text** with a configurable Shadow Pacemaker caret and Zen Focus Mode.
- **Multi-User & Offline-First Persistence:** Local profile switcher, cumulative practice hours tracker, longitudinal progress sparklines, and JSON backup export/import.

---

## Tech Stack

- **Framework:** React 18, TypeScript, Vite
- **Styling & Icons:** Tailwind CSS v4, Lucide React
- **Computer Vision:** `@mediapipe/tasks-vision` (`HandLandmarker` WebGL/GPU delegate)
- **Math & Geometry:** Custom DLT 3×3 Homography & Inverse Homography Solver, Temporal Ring-Buffer Interpolation

---

## Project Structure

```text
kinetictype-cv/
├── index.html
├── package.json
├── vite.config.ts
└── src/
    ├── index.css
    ├── main.tsx
    ├── App.tsx                  # Main typing arena, calibration studio & analytics UI
    ├── types/
    │   └── index.ts             # Domain types for landmarks, keymaps & telemetry
    ├── hooks/
    │   └── useHandTracker.ts    # MediaPipe GPU HandLandmarker & webcam loop
    └── utils/
        ├── homography.ts        # 2D projective DLT solver, H^-1 projection & auto-snap
        ├── qwertyLayout.ts      # ANSI, ISO & AZERTY key bounding boxes & finger zones
        ├── sensorFusion.ts      # Ring-buffer interpolation & z-depth strike classifier
        ├── drillGenerator.ts    # Weakness-weighted word & code snippet generator
        ├── audioCoach.ts        # Procedural Web Audio tactile feedback synthesizer
        └── storage.ts           # Multi-user localStorage state & JSON backup helpers
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- A webcam positioned above/angled toward your physical keyboard *(optional—the app gracefully falls back to Keystroke-Only Mode if no camera is connected)*

### Installation

```bash
git clone [https://github.com/tahaenasraoui-debug/kinetictype-cv.git](https://github.com/tahaenasraoui-debug/kinetictype-cv.git)
cd kinetictype-cv
npm install
npm run dev
```

### Calibration Guide
1. Click **Enable Webcam CV** in the top banner.
2. Open **Calibrate** (`Ctrl/Cmd + Shift + C`) and align the 4 corner handles with the centers of **Esc**, **Backspace**, **Left Ctrl**, and **Right Ctrl** (or click **Auto-Detect Corners**).
3. Confirm the cyan **F** and **J** wireframe boxes sit directly over your physical homing keys, then click **Save Calibration & Resume**.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Esc` or `Tab + Enter` | Instant restart |
| `Ctrl/Cmd + Shift + C` | Toggle 4-Corner Calibration Studio |
| `Ctrl/Cmd + Shift + Z` | Toggle Zen Focus Mode |

---

## License

MIT
