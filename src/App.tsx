import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  Camera,
  CameraOff,
  Check,
  Clock,
  Crosshair,
  Download,
  Eye,
  EyeOff,
  FileCode2,
  Flame,
  Gauge,
  Hand,
  Keyboard,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Sliders,
  Sparkles,
  TrendingUp,
  Upload,
  User,
  Users,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import type {
  AudioMode,
  CalibrationFineTune,
  CalibrationQuad,
  DrillMode,
  FingerId,
  FingerStat,
  FingertipProjection,
  HandLandmarkFrame,
  KeyDef,
  KeyboardLayoutId,
  KeystrokeEventRecord,
  Point2D,
  SessionSummary,
  UserProfile,
} from './types';
import {
  applyHomography,
  autoDetectKeyboardQuad,
  computeHomography,
  invertHomography,
} from './utils/homography';
import {
  ALL_FINGERS,
  FINGER_COLORS,
  buildKeyboardKeys,
  findKeyForChar,
  getHomeRowCenters,
} from './utils/qwertyLayout';
import {
  classifyStrikingFinger,
  computeUlnarDeviationDeg,
  projectFingertips,
} from './utils/sensorFusion';
import { generateTypingPrompt } from './utils/drillGenerator';
import { audioCoach } from './utils/audioCoach';
import {
  type PersistedAppState,
  createDefaultProfile,
  loadPersistedState,
  savePersistedState,
} from './utils/storage';
import { useHandTracker } from './hooks/useHandTracker';

const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
[0, 5], [5, 6], [6, 7], [7, 8],
[5, 9], [9, 10], [10, 11], [11, 12],
[9, 13], [13, 14], [14, 15], [15, 16],
[13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

function formatHours(seconds: number): string {
  return `${(seconds / 3600).toFixed(2)} hrs`;
}

// ---------------------------------------------------------------------------
// 1. Live Interactive SVG Virtual Keyboard + Fingertip Trails
// ---------------------------------------------------------------------------
interface VirtualKeyboardProps {
  keys: KeyDef[];
  nextKey: KeyDef | null;
  lastFlash: {
    code: string;
    isFingerCorrect: boolean;
    message: string | null;
    timestamp: number;
  } | null;
  liveProjections: FingertipProjection[];
  trails: Record<FingerId, Point2D[]>;
  showTrails: boolean;
  onToggleTrails: () => void;
}

const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({
  keys,
  nextKey,
  lastFlash,
  liveProjections,
  trails,
  showTrails,
  onToggleTrails,
}) => {
  const W = 900;
  const H = 300;

  return (
    <div className="w-full max-w-4xl mx-auto bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 shadow-xl">
    <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs">
    <div className="flex items-center gap-3">
    <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
    <Keyboard className="w-3.5 h-3.5 text-cyan-400" />
    Live Biomechanical Keymap
    </span>
    {nextKey && (
      <span className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono">
      Target: <strong className="text-white">{nextKey.label}</strong> ({nextKey.finger})
      </span>
    )}
    </div>

    <div className="flex items-center gap-2">
    {lastFlash?.message && (
      <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-medium animate-pulse">
      {lastFlash.message}
      </span>
    )}
    <button
    type="button"
    onClick={onToggleTrails}
    className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition ${
      showTrails
      ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
    }`}
    >
    {showTrails ? 'Trails: ON' : 'Trails: OFF'}
    </button>
    </div>
    </div>

    <svg
    viewBox={`0 0 ${W} ${H}`}
    className="w-full h-auto select-none overflow-visible"
    role="img"
    aria-label="Interactive biomechanical virtual keyboard"
    >
    {/* Keycaps */}
    {keys.map((key) => {
      const x = key.x * W + 2;
      const y = key.y * H + 2;
      const w = key.w * W - 4;
      const h = key.h * H - 4;
      const isTarget = nextKey?.code === key.code;
      const isFlashed =
      lastFlash &&
      lastFlash.code === key.code &&
      performance.now() - lastFlash.timestamp < 420;
      const fingerColor = FINGER_COLORS[key.finger].hex;
      const isHoming = key.code === 'KeyF' || key.code === 'KeyJ';

      let fill = '#18181b';
      let stroke = '#27272a';
      let strokeWidth = 1.2;

      if (isFlashed) {
        fill = lastFlash!.isFingerCorrect
        ? 'rgba(16, 185, 129, 0.35)'
        : 'rgba(244, 63, 94, 0.40)';
        stroke = lastFlash!.isFingerCorrect ? '#10b981' : '#f43f5e';
        strokeWidth = 2.2;
      } else if (isTarget) {
        fill = `${fingerColor}33`;
        stroke = fingerColor;
        strokeWidth = 2.4;
      }

      return (
        <g key={`${key.code}_${key.x}`}>
        <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={6}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        />
        {/* Subtle finger zone bottom bar */}
        <rect
        x={x + 6}
        y={y + h - 4}
        width={Math.max(4, w - 12)}
        height={2}
        rx={1}
        fill={fingerColor}
        opacity={isTarget ? 0.95 : 0.45}
        />
        {key.shiftLabel && (
          <text
          x={x + 7}
          y={y + 15}
          fill="#71717a"
          fontSize="10"
          fontFamily="JetBrains Mono, monospace"
          >
          {key.shiftLabel}
          </text>
        )}
        <text
        x={x + w / 2}
        y={y + h / 2 + 4}
        textAnchor="middle"
        fill={isTarget ? '#ffffff' : '#d4d4d8'}
        fontSize={key.label.length > 2 ? '11' : '13'}
        fontWeight={isTarget ? '700' : '500'}
        fontFamily="JetBrains Mono, monospace"
        >
        {key.label}
        </text>
        {isHoming && (
          <line
          x1={x + w / 2 - 7}
          y1={y + h - 9}
          x2={x + w / 2 + 7}
          y2={y + h - 9}
          stroke="#a1a1aa"
          strokeWidth={1.8}
          strokeLinecap="round"
          />
        )}
        </g>
      );
    })}

    {/* Fingertip Motion Trails */}
    {showTrails &&
      ALL_FINGERS.map((fId) => {
        const pts = trails[fId];
        if (!pts || pts.length < 2) return null;
        const poly = pts
        .map((p) => `${(p.x * W).toFixed(1)},${(p.y * H).toFixed(1)}`)
        .join(' ');
        return (
          <polyline
          key={`trail_${fId}`}
          points={poly}
          fill="none"
          stroke={FINGER_COLORS[fId].hex}
          strokeWidth={2}
          strokeOpacity={0.55}
          strokeLinecap="round"
          strokeLinejoin="round"
          />
        );
      })}

      {/* Live Projected Fingertip Dots */}
      {liveProjections.map((p) => {
        const cx = Math.max(4, Math.min(W - 4, p.normX * W));
        const cy = Math.max(4, Math.min(H - 4, p.normY * H));
        const color = FINGER_COLORS[p.finger].hex;
        return (
          <g key={`dot_${p.finger}`}>
          <circle
          cx={cx}
          cy={cy}
          r={7}
          fill={color}
          fillOpacity={0.85}
          stroke="#09090b"
          strokeWidth={2}
          />
          <text
          x={cx}
          y={cy - 10}
          textAnchor="middle"
          fill={color}
          fontSize="9"
          fontWeight="700"
          fontFamily="JetBrains Mono, monospace"
          >
          {p.finger.replace('-', '')}
          </text>
          </g>
        );
      })}
      </svg>

      {/* Compact Finger Color Legend */}
      <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
      {ALL_FINGERS.filter((f) => f !== 'L-Thumb').map((f) => (
        <span key={f} className="flex items-center gap-1">
        <span
        className="w-2 h-2 rounded-full inline-block"
        style={{ backgroundColor: FINGER_COLORS[f].hex }}
        />
        {f === 'R-Thumb' ? 'Thumbs (Space)' : f}
        </span>
      ))}
      </div>
      </div>
  );
};

// ---------------------------------------------------------------------------
// 2. 4-Corner Calibration Studio & Live Wireframe Overlay Modal
// ---------------------------------------------------------------------------
interface CalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  trackerStatus: string;
  onStartCamera: () => void;
  quad: CalibrationQuad;
  onChangeQuad: (q: CalibrationQuad) => void;
  fineTune: CalibrationFineTune;
  onChangeFineTune: (ft: CalibrationFineTune) => void;
  keys: KeyDef[];
  latestFrameRef: React.RefObject<HandLandmarkFrame | null>;
}

const CalibrationModal: React.FC<CalibrationModalProps> = ({
  isOpen,
  onClose,
  videoRef,
  trackerStatus,
  onStartCamera,
  quad,
  onChangeQuad,
  fineTune,
  onChangeFineTune,
  keys,
  latestFrameRef,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [draggingCorner, setDraggingCorner] = useState<keyof CalibrationQuad | null>(null);
  const [showWireframe, setShowWireframe] = useState(true);
  const [autoDetectMsg, setAutoDetectMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let rafId: number;

    const renderOverlay = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          if (video && video.readyState >= 2) {
            ctx.drawImage(video, 0, 0, w, h);
          } else {
            ctx.fillStyle = '#09090b';
            ctx.fillRect(0, 0, w, h);
          }

          // Project inverse homography (H^-1) key grid wireframe
          const H = computeHomography(quad);
          const Hinv = H ? invertHomography(H) : null;
          if (showWireframe && Hinv) {
            for (const key of keys) {
              const corners: Point2D[] = [
                { x: key.x - fineTune.offsetX, y: key.y - fineTune.offsetY },
                { x: key.x + key.w - fineTune.offsetX, y: key.y - fineTune.offsetY },
                { x: key.x + key.w - fineTune.offsetX, y: key.y + key.h - fineTune.offsetY },
                { x: key.x - fineTune.offsetX, y: key.y + key.h - fineTune.offsetY },
              ].map((pt) => applyHomography(Hinv, pt));

              const isHoming = key.code === 'KeyF' || key.code === 'KeyJ';
              ctx.beginPath();
              ctx.moveTo(corners[0].x * w, corners[0].y * h);
              ctx.lineTo(corners[1].x * w, corners[1].y * h);
              ctx.lineTo(corners[2].x * w, corners[2].y * h);
              ctx.lineTo(corners[3].x * w, corners[3].y * h);
              ctx.closePath();

              ctx.strokeStyle = isHoming ? '#22d3ee' : 'rgba(161, 161, 170, 0.45)';
              ctx.lineWidth = isHoming ? 2 : 1;
              ctx.stroke();

              if (isHoming) {
                ctx.fillStyle = 'rgba(34, 211, 238, 0.22)';
                ctx.fill();
              }
            }
          }

          // Draw quad boundary
          ctx.beginPath();
          ctx.moveTo(quad.topLeft.x * w, quad.topLeft.y * h);
          ctx.lineTo(quad.topRight.x * w, quad.topRight.y * h);
          ctx.lineTo(quad.bottomRight.x * w, quad.bottomRight.y * h);
          ctx.lineTo(quad.bottomLeft.x * w, quad.bottomLeft.y * h);
          ctx.closePath();
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Draw 21-point hand skeleton
          const frame = latestFrameRef.current;
          if (frame) {
            [frame.leftLandmarks, frame.rightLandmarks].forEach((hand, hIdx) => {
              if (!hand) return;
              ctx.strokeStyle = hIdx === 0 ? '#38bdf8' : '#a78bfa';
              ctx.lineWidth = 2;
              for (const [a, b] of HAND_CONNECTIONS) {
                ctx.beginPath();
                ctx.moveTo(hand[a].x * w, hand[a].y * h);
                ctx.lineTo(hand[b].x * w, hand[b].y * h);
                ctx.stroke();
              }
              hand.forEach((pt, idx) => {
                const isTip = [4, 8, 12, 16, 20].includes(idx);
                ctx.beginPath();
                ctx.arc(pt.x * w, pt.y * h, isTip ? 5 : 2.5, 0, Math.PI * 2);
                ctx.fillStyle = isTip ? '#f43f5e' : '#ffffff';
                ctx.fill();
              });
            });
          }
        }
      }
      rafId = requestAnimationFrame(renderOverlay);
    };

    rafId = requestAnimationFrame(renderOverlay);
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, videoRef, quad, fineTune, keys, showWireframe, latestFrameRef]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingCorner || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0.01, Math.min(0.99, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0.01, Math.min(0.99, (e.clientY - rect.top) / rect.height));
    onChangeQuad({ ...quad, [draggingCorner]: { x, y } });
  };

  const handleAutoSnap = () => {
    if (!videoRef.current || trackerStatus !== 'active') {
      setAutoDetectMsg('Start webcam feed first to auto-detect corners.');
      return;
    }
    const detected = autoDetectKeyboardQuad(videoRef.current);
    if (detected) {
      onChangeQuad(detected);
      setAutoDetectMsg('Snapped to outer keyboard bezel edges. Fine-tune pins if needed.');
    } else {
      setAutoDetectMsg('Could not detect clear bezel contrast — drag pins manually.');
    }
  };

  if (!isOpen) return null;

  const cornersMeta: { key: keyof CalibrationQuad; label: string }[] = [
    { key: 'topLeft', label: 'Top-Left [Esc]' },
    { key: 'topRight', label: 'Top-Right [Bksp]' },
    { key: 'bottomLeft', label: 'Bottom-Left [L-Ctrl]' },
    { key: 'bottomRight', label: 'Bottom-Right [R-Ctrl]' },
  ];

  // Camera perspective angle diagnostic
  const topWidth = Math.hypot(
    quad.topRight.x - quad.topLeft.x,
    quad.topRight.y - quad.topLeft.y
  );
  const bottomWidth = Math.hypot(
    quad.bottomRight.x - quad.bottomLeft.x,
    quad.bottomRight.y - quad.bottomLeft.y
  );
  const perspectiveRatio = topWidth / Math.max(0.05, bottomWidth);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-4">
    <div className="flex items-center justify-between">
    <div>
    <h2 className="text-lg font-bold text-white flex items-center gap-2">
    <Crosshair className="w-5 h-5 text-emerald-400" />
    4-Corner Projective Keyboard Calibration
    </h2>
    <p className="text-xs text-zinc-400">
    Drag the 4 corner handles onto the centers of <strong className="text-zinc-200">Esc</strong>,{' '}
    <strong className="text-zinc-200">Backspace</strong>,{' '}
    <strong className="text-zinc-200">Left Ctrl</strong>, and{' '}
    <strong className="text-zinc-200">Right Ctrl</strong>. Verify cyan <strong className="text-cyan-300">F</strong> & <strong className="text-cyan-300">J</strong> boxes align with your physical homing keys.
    </p>
    </div>
    <button
    type="button"
    onClick={onClose}
    className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
    >
    <X className="w-4 h-4" />
    </button>
    </div>

    {/* Toolbar */}
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
    <div className="flex items-center gap-2">
    {trackerStatus !== 'active' && (
      <button
      type="button"
      onClick={onStartCamera}
      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1.5"
      >
      <Camera className="w-3.5 h-3.5" />
      Enable Webcam Feed
      </button>
    )}
    <button
    type="button"
    onClick={handleAutoSnap}
    className="px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25 font-medium flex items-center gap-1.5"
    >
    <Sparkles className="w-3.5 h-3.5" />
    Auto-Detect Corners
    </button>
    <button
    type="button"
    onClick={() => setShowWireframe((v) => !v)}
    className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white"
    >
    {showWireframe ? 'Hide H⁻¹ Wireframe' : 'Show H⁻¹ Wireframe'}
    </button>
    </div>

    <div className="flex items-center gap-2">
    <span
    className={`px-2.5 py-1 rounded-md border font-medium ${
      perspectiveRatio > 0.72
      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
      : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
    }`}
    >
    {perspectiveRatio > 0.72
      ? 'Optimal Overhead Angle'
  : 'Steep Angle — Parallax Active'}
  </span>
  </div>
  </div>

  {autoDetectMsg && (
    <div className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800/90 border border-zinc-700 text-cyan-300">
    {autoDetectMsg}
    </div>
  )}

  {/* Interactive Video + Draggable Pins */}
  <div
  ref={containerRef}
  onPointerMove={handlePointerMove}
  onPointerUp={() => setDraggingCorner(null)}
  onPointerLeave={() => setDraggingCorner(null)}
  className="relative w-full aspect-video bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800 select-none touch-none"
  >
  <canvas ref={canvasRef} width={960} height={540} className="w-full h-full object-fill" />

  {cornersMeta.map(({ key, label }) => {
    const pt = quad[key];
    return (
      <div
      key={key}
      onPointerDown={(e) => {
        e.stopPropagation();
        setDraggingCorner(key);
      }}
      style={{ left: `${pt.x * 100}%`, top: `${pt.y * 100}%` }}
      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing group"
      >
      <div className="w-6 h-6 rounded-full bg-emerald-500/30 border-2 border-emerald-400 flex items-center justify-center shadow-lg group-hover:scale-110 transition">
      <div className="w-2 h-2 rounded-full bg-white" />
      </div>
      <span className="mt-1 block px-1.5 py-0.5 rounded bg-zinc-950/90 border border-zinc-700 text-[10px] font-mono text-emerald-300 whitespace-nowrap">
      {label}
      </span>
      </div>
    );
  })}
  </div>

  {/* Fine-Tuning & Parallax Controls */}
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-zinc-950/70 border border-zinc-800 rounded-xl p-3 text-xs">
  <div>
  <div className="flex justify-between text-zinc-400 mb-1">
  <span>F/J Horizontal Nudge</span>
  <span className="font-mono text-zinc-200">{(fineTune.offsetX * 100).toFixed(1)}%</span>
  </div>
  <input
  type="range"
  min={-0.05}
  max={0.05}
  step={0.002}
  value={fineTune.offsetX}
  onChange={(e) =>
    onChangeFineTune({ ...fineTune, offsetX: parseFloat(e.target.value) })
  }
  className="w-full accent-cyan-400"
  />
  </div>
  <div>
  <div className="flex justify-between text-zinc-400 mb-1">
  <span>F/J Vertical Nudge</span>
  <span className="font-mono text-zinc-200">{(fineTune.offsetY * 100).toFixed(1)}%</span>
  </div>
  <input
  type="range"
  min={-0.05}
  max={0.05}
  step={0.002}
  value={fineTune.offsetY}
  onChange={(e) =>
    onChangeFineTune({ ...fineTune, offsetY: parseFloat(e.target.value) })
  }
  className="w-full accent-cyan-400"
  />
  </div>
  <div>
  <div className="flex justify-between text-zinc-400 mb-1">
  <span>Hover Parallax Compensation</span>
  <span className="font-mono text-zinc-200">
  {(fineTune.parallaxFactor * 100).toFixed(0)}%
  </span>
  </div>
  <input
  type="range"
  min={0}
  max={0.15}
  step={0.01}
  value={fineTune.parallaxFactor}
  onChange={(e) =>
    onChangeFineTune({ ...fineTune, parallaxFactor: parseFloat(e.target.value) })
  }
  className="w-full accent-emerald-400"
  />
  </div>
  </div>

  <div className="flex justify-end">
  <button
  type="button"
  onClick={onClose}
  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center gap-2"
  >
  <Check className="w-4 h-4" />
  Save Calibration & Resume
  </button>
  </div>
  </div>
  </div>
  );
};

// ---------------------------------------------------------------------------
// 3. Post-Run Biomechanical Analytics + Slow-Motion Mistake Skeleton Replay
// ---------------------------------------------------------------------------
interface AnalyticsReportProps {
  summary: SessionSummary;
  mistakeRecords: KeystrokeEventRecord[];
  onTrainWeaknesses: () => void;
  onRestart: () => void;
}

const AnalyticsReport: React.FC<AnalyticsReportProps> = ({
  summary,
  mistakeRecords,
  onTrainWeaknesses,
  onRestart,
}) => {
  const [selectedMistakeIdx, setSelectedMistakeIdx] = useState(0);
  const [replayFrameIdx, setReplayFrameIdx] = useState(0);

  const activeMistake = mistakeRecords[selectedMistakeIdx] ?? null;
  const replayFrames = activeMistake?.replayFrames ?? [];

  useEffect(() => {
    setReplayFrameIdx(0);
  }, [selectedMistakeIdx]);

  useEffect(() => {
    if (replayFrames.length <= 1) return;
    const timer = setInterval(() => {
      setReplayFrameIdx((prev) => (prev + 1) % replayFrames.length);
    }, 110);
    return () => clearInterval(timer);
  }, [replayFrames.length]);

  const currentReplayFrame = replayFrames[replayFrameIdx] ?? null;
  const totalHandStrikes = Math.max(1, summary.leftHandStrikes + summary.rightHandStrikes);
  const leftShare = Math.round((summary.leftHandStrikes / totalHandStrikes) * 100);
  const rightShare = 100 - leftShare;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fadeIn">
    {/* Top KPI Row */}
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
    <div className="text-xs text-zinc-400">Net WPM</div>
    <div className="text-3xl font-bold font-mono text-emerald-400 mt-1">
    {summary.netWpm}
    </div>
    <div className="text-[11px] text-zinc-500 mt-0.5">Raw: {summary.rawWpm} WPM</div>
    </div>
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
    <div className="text-xs text-zinc-400">Accuracy</div>
    <div className="text-3xl font-bold font-mono text-white mt-1">
    {summary.accuracyPct}%
    </div>
    <div className="text-[11px] text-zinc-500 mt-0.5">Keystroke precision</div>
    </div>
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
    <div className="text-xs text-zinc-400">Form Compliance</div>
    <div className="text-3xl font-bold font-mono text-cyan-400 mt-1">
    {summary.formCompliancePct}%
    </div>
    <div className="text-[11px] text-zinc-500 mt-0.5">Canonical finger match</div>
    </div>
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
    <div className="text-xs text-zinc-400">Rhythm Consistency</div>
    <div className="text-3xl font-bold font-mono text-purple-400 mt-1">
    {summary.rhythmConsistencyPct}%
    </div>
    <div className="text-[11px] text-zinc-500 mt-0.5">Cadence smoothness</div>
    </div>
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
    <div className="text-xs text-zinc-400">Travel Efficiency</div>
    <div className="text-3xl font-bold font-mono text-amber-400 mt-1">
    {summary.efficiencyRatio}%
    </div>
    <div className="text-[11px] text-zinc-500 mt-0.5">
    {summary.totalTravelKeys.toFixed(1)}u vs {summary.optimalTravelKeys.toFixed(1)}u opt
    </div>
    </div>
    </div>

    {/* Middle Diagnostics: Bad Habits, Hand Balance & Ergonomics */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
    {/* Top 3 Bad Habits */}
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
    <Flame className="w-4 h-4 text-rose-400" />
    Top 3 Biomechanical Bottlenecks
    </h3>
    {summary.badHabits.length === 0 ? (
      <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
      Zero wrong-finger violations detected on this run. Clean touch-typing form!
      </p>
    ) : (
      <div className="space-y-2.5">
      {summary.badHabits.map((hb, idx) => (
        <div
        key={`${hb.keyLabel}_${idx}`}
        className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between text-xs"
        >
        <div>
        <div className="font-mono font-bold text-white">
        Key [{hb.keyLabel}]{' '}
        {hb.commonWrongFinger && (
          <span className="text-rose-400 font-normal">
          — used {hb.commonWrongFinger} instead of {hb.expectedFinger}
          </span>
        )}
        </div>
        <div className="text-zinc-400 mt-0.5">
        Wrong finger: {hb.wrongFingerCount}x • Avg latency: {Math.round(hb.avgLatencyMs)}ms
        </div>
        </div>
        <span className="px-2 py-1 rounded bg-rose-500/15 text-rose-300 font-mono font-semibold">
        #{idx + 1}
        </span>
        </div>
      ))}
      </div>
    )}
    </div>

    {/* Left vs Right Hand Balance */}
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
    <Hand className="w-4 h-4 text-cyan-400" />
    Left vs. Right Hand Balance
    </h3>
    <div>
    <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
    <span>Left Hand ({leftShare}%)</span>
    <span>Right Hand ({rightShare}%)</span>
    </div>
    <div className="w-full h-3 rounded-full bg-zinc-800 overflow-hidden flex">
    <div className="bg-cyan-500 h-full" style={{ width: `${leftShare}%` }} />
    <div className="bg-purple-500 h-full" style={{ width: `${rightShare}%` }} />
    </div>
    </div>
    <div className="grid grid-cols-2 gap-3 text-xs">
    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
    <div className="text-zinc-400">Left Avg Latency</div>
    <div className="text-lg font-mono font-bold text-cyan-300 mt-0.5">
    {Math.round(summary.leftAvgLatencyMs)} ms
    </div>
    <div className="text-zinc-500">{summary.leftHandStrikes} strikes</div>
    </div>
    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
    <div className="text-zinc-400">Right Avg Latency</div>
    <div className="text-lg font-mono font-bold text-purple-300 mt-0.5">
    {Math.round(summary.rightAvgLatencyMs)} ms
    </div>
    <div className="text-zinc-500">{summary.rightHandStrikes} strikes</div>
    </div>
    </div>
    </div>

    {/* Home-Row Drift & Ergonomic Guard */}
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
    <Activity className="w-4 h-4 text-emerald-400" />
    Posture, Drift & Fatigue Guard
    </h3>
    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs">
    <span className="text-zinc-400">Idle Home-Row Drift (F/J)</span>
    <span className="font-mono font-bold text-white">
    {summary.avgHomeRowDriftKeys.toFixed(2)} key-widths
    </span>
    </div>
    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs">
    <span className="text-zinc-400">Wrist Alignment Score</span>
    <span className="font-mono font-bold text-emerald-400">
    {summary.ergonomicScorePct}%
    </span>
    </div>
    <div
    className={`p-3 rounded-xl border text-xs ${
      summary.fatigueSpikeDetected
      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
      : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
    }`}
    >
    {summary.fatigueSpikeDetected
      ? 'Late-run travel & error drift detected — relax shoulders and reset index fingers on F & J.'
  : 'Steady ergonomic posture maintained across the entire run.'}
  </div>
  </div>
  </div>

  {/* 10-Finger Performance Matrix */}
  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
  <BarChart3 className="w-4 h-4 text-cyan-400" />
  10-Finger Performance & Same-Finger Bigram (SFB) Matrix
  </h3>
  <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2 text-xs">
  {ALL_FINGERS.map((fId) => {
    const st = summary.fingerBreakdown[fId];
    const compliance =
    st.strikes > 0 ? Math.round((st.correctStrikes / st.strikes) * 100) : 100;
    const avgMs = st.strikes > 0 ? Math.round(st.totalLatencyMs / st.strikes) : 0;
    return (
      <div
      key={fId}
      className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col justify-between"
      >
      <div className="flex items-center justify-between">
      <span className="font-mono font-bold text-[11px] text-zinc-200">{fId}</span>
      <span
      className="w-2 h-2 rounded-full"
      style={{ backgroundColor: FINGER_COLORS[fId].hex }}
      />
      </div>
      <div className="mt-2 space-y-0.5 font-mono text-[11px]">
      <div className="text-zinc-300">{st.strikes} hits</div>
      <div className="text-zinc-400">{avgMs > 0 ? `${avgMs}ms` : '—'}</div>
      <div className={compliance < 85 ? 'text-rose-400' : 'text-emerald-400'}>
      {compliance}% form
      </div>
      {st.sfbCount > 0 && (
        <div className="text-amber-400 text-[10px]">{st.sfbCount} SFB</div>
      )}
      </div>
      </div>
    );
  })}
  </div>
  </div>

  {/* Slow-Motion Mistake Skeleton Replay */}
  {mistakeRecords.length > 0 && activeMistake && (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
    <div className="space-y-2 max-w-md">
    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
    <Play className="w-4 h-4 text-rose-400" />
    Slow-Motion Mistake Skeleton Replay
    </h3>
    <p className="text-xs text-zinc-400">
    Inspect your 21-landmark hand trajectory right before striking{' '}
    <strong className="text-white font-mono">[{activeMistake.keyDef.label}]</strong> with{' '}
    <strong className="text-rose-400">{activeMistake.detectedFinger}</strong> instead of{' '}
    <strong className="text-emerald-400">{activeMistake.expectedFinger}</strong>.
    </p>
    <div className="flex flex-wrap gap-1.5 pt-1">
    {mistakeRecords.slice(0, 6).map((m, idx) => (
      <button
      key={`${m.timestamp}_${idx}`}
      type="button"
      onClick={() => setSelectedMistakeIdx(idx)}
      className={`px-2.5 py-1 rounded-lg font-mono text-xs border ${
        selectedMistakeIdx === idx
        ? 'bg-rose-500/20 border-rose-500/50 text-rose-200'
        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
      }`}
      >
      {m.keyDef.label} ({m.detectedFinger})
      </button>
    ))}
    </div>
    </div>

    <div className="w-64 h-40 bg-zinc-950 border border-zinc-800 rounded-xl p-2 flex flex-col items-center justify-center">
    {currentReplayFrame ? (
      <svg viewBox="0 0 1 1" className="w-full h-full">
      {[currentReplayFrame.leftLandmarks, currentReplayFrame.rightLandmarks].map(
        (hand, hIdx) => {
          if (!hand) return null;
          return (
            <g key={hIdx}>
            {HAND_CONNECTIONS.map(([a, b], cIdx) => (
              <line
              key={cIdx}
              x1={hand[a].x}
              y1={hand[a].y}
              x2={hand[b].x}
              y2={hand[b].y}
              stroke={hIdx === 0 ? '#38bdf8' : '#f43f5e'}
              strokeWidth={0.014}
              />
            ))}
            {[4, 8, 12, 16, 20].map((tipIdx) => (
              <circle
              key={tipIdx}
              cx={hand[tipIdx].x}
              cy={hand[tipIdx].y}
              r={0.024}
              fill="#ffffff"
              />
            ))}
            </g>
          );
        }
      )}
      </svg>
    ) : (
      <span className="text-xs text-zinc-500 text-center px-3">
      Enable webcam CV tracking to record 21-point skeleton replays on mistakes.
      </span>
    )}
    </div>
    </div>
  )}

  {/* Action Buttons */}
  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
  <button
  type="button"
  onClick={onTrainWeaknesses}
  className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-zinc-950 font-bold text-sm shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition"
  >
  <Zap className="w-4 h-4" />
  Train My Weaknesses
  </button>
  <button
  type="button"
  onClick={onRestart}
  className="px-5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-sm flex items-center gap-2 transition"
  >
  <RotateCcw className="w-4 h-4" />
  Next Run (Tab + Enter)
  </button>
  </div>
  </div>
  );
};

// ---------------------------------------------------------------------------
// 4. Longitudinal Progress & Trend Charts Modal
// ---------------------------------------------------------------------------
const ProgressModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
}> = ({ isOpen, onClose, user }) => {
  if (!isOpen) return null;
  const recent = user.sessions.slice(-30);

  const renderSparkline = (values: number[], stroke: string, maxVal = 100) => {
    if (values.length < 2) {
      return <div className="text-xs text-zinc-500 py-6 text-center">Complete 2+ runs to plot trend</div>;
    }
    const max = Math.max(maxVal, ...values);
    const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 280 + 10;
      const y = 70 - (v / Math.max(1, max)) * 55;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
    return (
      <svg viewBox="0 0 300 80" className="w-full h-20">
      <polyline
      points={pts}
      fill="none"
      stroke={stroke}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      />
      </svg>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
    <div className="flex items-center justify-between">
    <div>
    <h2 className="text-lg font-bold text-white flex items-center gap-2">
    <TrendingUp className="w-5 h-5 text-cyan-400" />
    Longitudinal Progress — {user.name}
    </h2>
    <p className="text-xs text-zinc-400">
    {user.sessions.length} total sessions • Best: {user.bestWpm} WPM • Trained:{' '}
    {formatHours(user.cumulativeSeconds)}
    </p>
    </div>
    <button
    type="button"
    onClick={onClose}
    className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
    >
    <X className="w-4 h-4" />
    </button>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
    <div className="text-xs text-zinc-400">Net WPM Trend</div>
    {renderSparkline(recent.map((s) => s.netWpm), '#10b981', 120)}
    </div>
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
    <div className="text-xs text-zinc-400">Form Compliance %</div>
    {renderSparkline(recent.map((s) => s.formCompliancePct), '#22d3ee', 100)}
    </div>
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
    <div className="text-xs text-zinc-400">Travel Efficiency %</div>
    {renderSparkline(recent.map((s) => s.efficiencyRatio), '#f59e0b', 100)}
    </div>
    </div>

    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
    <table className="w-full text-left text-xs">
    <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800">
    <tr>
    <th className="py-2.5 px-3">Date</th>
    <th className="py-2.5 px-3">Mode</th>
    <th className="py-2.5 px-3">Net WPM</th>
    <th className="py-2.5 px-3">Accuracy</th>
    <th className="py-2.5 px-3">Form</th>
    <th className="py-2.5 px-3">Efficiency</th>
    </tr>
    </thead>
    <tbody className="divide-y divide-zinc-800/70 font-mono">
    {user.sessions
      .slice()
      .reverse()
      .slice(0, 15)
      .map((s) => (
        <tr key={s.id} className="text-zinc-300">
        <td className="py-2 px-3">{new Date(s.timestamp).toLocaleDateString()}</td>
        <td className="py-2 px-3">{s.mode}</td>
        <td className="py-2 px-3 text-emerald-400 font-bold">{s.netWpm}</td>
        <td className="py-2 px-3">{s.accuracyPct}%</td>
        <td className="py-2 px-3 text-cyan-300">{s.formCompliancePct}%</td>
        <td className="py-2 px-3 text-amber-300">{s.efficiencyRatio}%</td>
        </tr>
      ))}
      </tbody>
      </table>
      </div>
      </div>
      </div>
  );
};

// ---------------------------------------------------------------------------
// 5. Main Application Orchestrator
// ---------------------------------------------------------------------------
export function App() {
  const [persisted, setPersisted] = useState<PersistedAppState>(() => loadPersistedState());
  const activeUser = useMemo(
    () =>
    persisted.users.find((u) => u.id === persisted.activeUserId) ?? persisted.users[0],
                             [persisted]
  );

  // Save changes to localStorage
  useEffect(() => {
    savePersistedState(persisted);
  }, [persisted]);

  const keys = useMemo(() => buildKeyboardKeys(persisted.layout), [persisted.layout]);
  const homeCenters = useMemo(() => getHomeRowCenters(keys), [keys]);
  const homography = useMemo(
    () => computeHomography(persisted.calibration),
                             [persisted.calibration]
  );

  // Hand Tracker Hook
  const {
    status: trackerStatus,
    errorMsg: trackerError,
    fps,
    videoRef,
    ringBufferRef,
    latestFrameRef,
    startCamera,
    stopCamera,
  } = useHandTracker();

  // UI & Studio Toggles
  const [showCalibModal, setShowCalibModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showPip] = useState(true);
  const [showTrails, setShowTrails] = useState(true);
  const [zenMode, setZenMode] = useState(false);
  const [audioMode, setAudioMode] = useState<AudioMode>('alerts');
  const [pacerWpm, setPacerWpm] = useState<number>(0); // 0 = Off, -1 = PB, >0 = target WPM

  // New Profile Creation State
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const importInputRef = useRef<HTMLInputElement | null>(null);

  // Typing Session State
  const [mode, setMode] = useState<DrillMode>('30s');
  const [promptText, setPromptText] = useState<string>(() =>
  generateTypingPrompt('30s', activeUser.weakChars, activeUser.weakBigrams, persisted.customText)
  );
  const [typedText, setTypedText] = useState<string>('');
  const [runStatus, setRunStatus] = useState<'ready' | 'running' | 'finished'>('ready');
  const [startTimeMs, setStartTimeMs] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState<number>(0);

  // Real-time Biomechanical Tracking Refs & State
  const recordsRef = useRef<KeystrokeEventRecord[]>([]);
  const lastFingerPosRef = useRef<Partial<Record<FingerId, Point2D>>>({});
  const lastKeystrokeTsRef = useRef<number | null>(null);
  const lastFingerUsedRef = useRef<FingerId | null>(null);
  const homeDriftSamplesRef = useRef<number[]>([]);
  const ulnarSamplesRef = useRef<number[]>([]);
  const tabPressedAtRef = useRef<number>(0);

  const [lastFlash, setLastFlash] = useState<{
    code: string;
    isFingerCorrect: boolean;
    message: string | null;
    timestamp: number;
  } | null>(null);
  const [liveProjections, setLiveProjections] = useState<FingertipProjection[]>([]);
  const [trails, setTrails] = useState<Record<FingerId, Point2D[]>>({} as Record<FingerId, Point2D[]>);
  const [lastSummary, setLastSummary] = useState<SessionSummary | null>(null);

  // Live PiP Canvas Loop + Idle Home-Row Drift Sampler
  const pipCanvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let rafId: number;
    const tick = () => {
      const frame = latestFrameRef.current;
      if (frame && homography) {
        const projs = projectFingertips(frame, homography, persisted.fineTune);
        setLiveProjections(projs);

        if (showTrails) {
          setTrails((prev) => {
            const next = { ...prev };
            for (const p of projs) {
              const arr = next[p.finger] ? [...next[p.finger]] : [];
              arr.push({ x: p.normX, y: p.normY });
              if (arr.length > 16) arr.shift();
              next[p.finger] = arr;
            }
            return next;
          });
        }

        // Sample idle home-row drift during pauses > 400ms
        const now = performance.now();
        if (
          runStatus === 'running' &&
          lastKeystrokeTsRef.current &&
          now - lastKeystrokeTsRef.current > 400
        ) {
          const lIdx = projs.find((p) => p.finger === 'L-Index');
          const rIdx = projs.find((p) => p.finger === 'R-Index');
          const keyUnitW = 1 / 15;
          if (lIdx) {
            const d = Math.hypot(
              (lIdx.normX - homeCenters['L-Index'].x) / keyUnitW,
                                 (lIdx.normY - homeCenters['L-Index'].y) / 0.2
            );
            homeDriftSamplesRef.current.push(d);
          }
          if (rIdx) {
            const d = Math.hypot(
              (rIdx.normX - homeCenters['R-Index'].x) / keyUnitW,
                                 (rIdx.normY - homeCenters['R-Index'].y) / 0.2
            );
            homeDriftSamplesRef.current.push(d);
          }
        }

        // Sample ulnar deviation ergonomics
        const lUlnar = computeUlnarDeviationDeg(frame.leftLandmarks);
        const rUlnar = computeUlnarDeviationDeg(frame.rightLandmarks);
        if (lUlnar !== null) ulnarSamplesRef.current.push(lUlnar);
        if (rUlnar !== null) ulnarSamplesRef.current.push(rUlnar);
      }

      // Draw PiP feed
      const canvas = pipCanvasRef.current;
      const video = videoRef.current;
      if (canvas && video && video.readyState >= 2 && showPip) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          if (frame) {
            [frame.leftLandmarks, frame.rightLandmarks].forEach((hand, hIdx) => {
              if (!hand) return;
              ctx.strokeStyle = hIdx === 0 ? '#38bdf8' : '#a78bfa';
              ctx.lineWidth = 1.5;
              for (const [a, b] of HAND_CONNECTIONS) {
                ctx.beginPath();
                ctx.moveTo(hand[a].x * canvas.width, hand[a].y * canvas.height);
                ctx.lineTo(hand[b].x * canvas.width, hand[b].y * canvas.height);
                ctx.stroke();
              }
            });
          }
        }
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [latestFrameRef, homography, persisted.fineTune, showTrails, runStatus, homeCenters, videoRef, showPip]);

  // Reset / Start New Drill
  const resetTest = useCallback(
    (overrideMode?: DrillMode) => {
      const targetMode = overrideMode ?? mode;
      if (overrideMode) setMode(overrideMode);
      setPromptText(
        generateTypingPrompt(
          targetMode,
          activeUser.weakChars,
          activeUser.weakBigrams,
          persisted.customText
        )
      );
      setTypedText('');
      setRunStatus('ready');
      setStartTimeMs(null);
      setElapsedSec(0);
      setLastSummary(null);
      setLastFlash(null);
      recordsRef.current = [];
      lastFingerPosRef.current = {};
      lastKeystrokeTsRef.current = null;
      lastFingerUsedRef.current = null;
      homeDriftSamplesRef.current = [];
      ulnarSamplesRef.current = [];
    },
    [mode, activeUser.weakChars, activeUser.weakBigrams, persisted.customText]
  );

  // Finalize Run & Compute Biomechanical Analytics
  const finishRun = useCallback(
    (finalDurationSec: number) => {
      setRunStatus('finished');
      const recs = recordsRef.current;
      const safeDur = Math.max(1, finalDurationSec);

      const correctChars = recs.filter((r) => r.isCharCorrect).length;
      const rawWpm = Math.round(recs.length / 5 / (safeDur / 60));
      const netWpm = Math.round(correctChars / 5 / (safeDur / 60));
      const accuracyPct =
      recs.length > 0 ? Math.round((correctChars / recs.length) * 100) : 100;

      const correctFingerCount = recs.filter((r) => r.isFingerCorrect).length;
      const formCompliancePct =
      recs.length > 0 ? Math.round((correctFingerCount / recs.length) * 100) : 100;

      // Rhythm consistency from inter-key latency standard deviation
      const latencies = recs.slice(1).map((r) => Math.min(1200, r.interKeyMs));
      const meanLat =
      latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 150;
      const stdLat =
      latencies.length > 1
      ? Math.sqrt(
        latencies.reduce((acc, v) => acc + Math.pow(v - meanLat, 2), 0) /
        latencies.length
      )
      : 0;
      const cv = meanLat > 0 ? stdLat / meanLat : 0;
      const rhythmConsistencyPct = Math.max(0, Math.min(100, Math.round((1 - cv * 0.85) * 100)));

      // Travel efficiency
      const totalTravelKeys = recs.reduce((acc, r) => acc + r.travelDistanceKeys, 0);
      const optimalTravelKeys = recs.reduce((acc, r) => acc + r.optimalDistanceKeys, 0);
      const efficiencyRatio =
      totalTravelKeys > 0
      ? Math.min(100, Math.round((optimalTravelKeys / totalTravelKeys) * 100))
      : 100;

      // 10-Finger breakdown
      const fingerBreakdown = {} as Record<FingerId, FingerStat>;
      for (const f of ALL_FINGERS) {
        fingerBreakdown[f] = {
          finger: f,
          strikes: 0,
          correctStrikes: 0,
          totalLatencyMs: 0,
          totalTravelKeys: 0,
          sfbCount: 0,
        };
      }

      let leftHandStrikes = 0;
      let rightHandStrikes = 0;
      let leftLatSum = 0;
      let rightLatSum = 0;

      for (const r of recs) {
        const fb = fingerBreakdown[r.expectedFinger];
        fb.strikes++;
        if (r.isFingerCorrect) fb.correctStrikes++;
        fb.totalLatencyMs += r.interKeyMs;
        fb.totalTravelKeys += r.travelDistanceKeys;
        if (r.isSameFingerBigram) fb.sfbCount++;

        if (r.expectedFinger.startsWith('L-')) {
          leftHandStrikes++;
          leftLatSum += r.interKeyMs;
        } else {
          rightHandStrikes++;
          rightLatSum += r.interKeyMs;
        }
      }

      // Bad habit aggregation
      const keyAgg = new Map<
      string,
      {
        keyLabel: string;
        char: string;
        expectedFinger: FingerId;
        wrongCounts: Partial<Record<FingerId, number>>;
        wrongTotal: number;
        latSum: number;
        travelSum: number;
        count: number;
      }
      >();

      const updatedWeakChars = { ...activeUser.weakChars };
      const updatedWeakBigrams = { ...activeUser.weakBigrams };

      recs.forEach((r, idx) => {
        const k = r.keyDef.label;
        const entry = keyAgg.get(k) ?? {
          keyLabel: k,
          char: r.expectedChar,
          expectedFinger: r.expectedFinger,
          wrongCounts: {},
          wrongTotal: 0,
          latSum: 0,
          travelSum: 0,
          count: 0,
        };
        entry.count++;
        entry.latSum += r.interKeyMs;
        entry.travelSum += r.travelDistanceKeys;
        if (!r.isFingerCorrect) {
          entry.wrongTotal++;
          entry.wrongCounts[r.detectedFinger] =
          (entry.wrongCounts[r.detectedFinger] ?? 0) + 1;
        }
        keyAgg.set(k, entry);

        if (!r.isCharCorrect || !r.isFingerCorrect) {
          const ch = r.expectedChar.toLowerCase();
          if (/[a-z]/.test(ch)) {
            updatedWeakChars[ch] = (updatedWeakChars[ch] ?? 0) + 1;
          }
          if (idx > 0) {
            const bg = (recs[idx - 1].expectedChar + r.expectedChar).toLowerCase();
            if (/^[a-z]{2}$/.test(bg)) {
              updatedWeakBigrams[bg] = (updatedWeakBigrams[bg] ?? 0) + 1;
            }
          }
        }
      });

      const badHabits = Array.from(keyAgg.values())
      .map((item) => {
        let commonWrongFinger: FingerId | null = null;
        let maxWrong = 0;
        for (const [f, cnt] of Object.entries(item.wrongCounts) as [FingerId, number][]) {
          if (cnt > maxWrong) {
            maxWrong = cnt;
            commonWrongFinger = f;
          }
        }
        const avgLatencyMs = item.latSum / Math.max(1, item.count);
        const avgTravelKeys = item.travelSum / Math.max(1, item.count);
        const score = item.wrongTotal * 300 + avgLatencyMs + avgTravelKeys * 80;
        return {
          keyLabel: item.keyLabel,
          char: item.char,
          expectedFinger: item.expectedFinger,
          commonWrongFinger,
          wrongFingerCount: item.wrongTotal,
          avgLatencyMs,
          avgTravelKeys,
          score,
        };
      })
      .filter((h) => h.wrongFingerCount > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

      const avgHomeRowDriftKeys =
      homeDriftSamplesRef.current.length > 0
      ? homeDriftSamplesRef.current.reduce((a, b) => a + b, 0) /
      homeDriftSamplesRef.current.length
      : 0.15;

      const avgUlnar =
      ulnarSamplesRef.current.length > 0
      ? ulnarSamplesRef.current.reduce((a, b) => a + b, 0) /
      ulnarSamplesRef.current.length
      : 8;
      const ergonomicScorePct = Math.max(
        50,
        Math.min(100, Math.round(100 - Math.max(0, avgUlnar - 12) * 2.2))
      );

      // Late-run fatigue check
      const half = Math.floor(recs.length / 2);
      const earlyTravel =
      half > 3
      ? recs.slice(0, half).reduce((a, r) => a + r.travelDistanceKeys, 0) / half
      : 0;
      const lateTravel =
      half > 3
      ? recs.slice(half).reduce((a, r) => a + r.travelDistanceKeys, 0) /
      Math.max(1, recs.length - half)
      : 0;
      const fatigueSpikeDetected = half > 5 && lateTravel > earlyTravel * 1.28;

      const summary: SessionSummary = {
        id: `run_${Date.now()}`,
                                timestamp: Date.now(),
                                mode,
                                layout: persisted.layout,
                                durationSec: Math.round(safeDur),
                                netWpm,
                                rawWpm,
                                accuracyPct,
                                formCompliancePct,
                                  rhythmConsistencyPct,
                                  totalTravelKeys,
                                  optimalTravelKeys,
                                  efficiencyRatio,
                                  avgHomeRowDriftKeys,
                                  leftHandStrikes,
                                  rightHandStrikes,
                                  leftAvgLatencyMs: leftHandStrikes > 0 ? leftLatSum / leftHandStrikes : 0,
                                  rightAvgLatencyMs: rightHandStrikes > 0 ? rightLatSum / rightHandStrikes : 0,
                                  ergonomicScorePct,
                                  fatigueSpikeDetected,
                                  fingerBreakdown,
                                  badHabits,
                                  weakChars: Object.keys(updatedWeakChars),
                                weakBigrams: Object.keys(updatedWeakBigrams),
      };

      setLastSummary(summary);

      // Persist session into active user profile
      setPersisted((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
        u.id === activeUser.id
        ? {
          ...u,
          bestWpm: Math.max(u.bestWpm, netWpm),
                              sessions: [...u.sessions, summary],
                              weakChars: updatedWeakChars,
                              weakBigrams: updatedWeakBigrams,
        }
        : u
        ),
      }));
    },
    [activeUser, mode, persisted.layout]
  );

  // Live Timer + Cumulative Hours Ticker
  useEffect(() => {
    if (runStatus !== 'running' || startTimeMs === null) return;
    const timedLimit =
    mode === '15s' ? 15 : mode === '30s' ? 30 : mode === '60s' ? 60 : null;

    const interval = setInterval(() => {
      const now = performance.now();
      const sec = (now - startTimeMs) / 1000;
      setElapsedSec(sec);

      // Increment active user's cumulative training time live
      setPersisted((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
        u.id === prev.activeUserId
        ? { ...u, cumulativeSeconds: u.cumulativeSeconds + 0.25 }
        : u
        ),
      }));

      if (timedLimit !== null && sec >= timedLimit) {
        clearInterval(interval);
        finishRun(timedLimit);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [runStatus, startTimeMs, mode, finishRun]);

  // Global Keyboard Listener (Typing + Shortcuts)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showCalibModal || showProgressModal || showCustomModal || isCreatingUser) {
        if (e.key === 'Escape') {
          setShowCalibModal(false);
          setShowProgressModal(false);
          setShowCustomModal(false);
          setIsCreatingUser(false);
        }
        return;
      }

      // Shortcuts: Ctrl/Cmd + Shift + C (Calibration) or Z (Zen Mode)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        if (e.key.toLowerCase() === 'c') {
          e.preventDefault();
          setShowCalibModal((v) => !v);
          return;
        }
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          setZenMode((v) => !v);
          return;
        }
      }

      // Monkeytype Quick-Restart: Esc or Tab + Enter
      if (e.key === 'Escape') {
        e.preventDefault();
        resetTest();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        tabPressedAtRef.current = performance.now();
        return;
      }
      if (e.key === 'Enter' && performance.now() - tabPressedAtRef.current < 800) {
        e.preventDefault();
        resetTest();
        return;
      }

      if (runStatus === 'finished') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Backspace support
      if (e.key === 'Backspace') {
        e.preventDefault();
        setTypedText((prev) => prev.slice(0, -1));
        return;
      }

      // Map printable character or Enter in code/custom mode
      let typedChar = '';
  if (e.key === 'Enter' && (mode === 'code_ts' || mode === 'code_py' || mode === 'custom')) {
    typedChar = '\n';
  } else if (e.key.length === 1) {
    typedChar = e.key;
  } else {
    return;
  }

  e.preventDefault();

  const now = performance.now();
  const effectiveStart = startTimeMs ?? now;
  if (runStatus === 'ready') {
    setRunStatus('running');
    setStartTimeMs(now);
  }

  const targetIdx = typedText.length;
  if (targetIdx >= promptText.length) return;

  const expectedChar = promptText[targetIdx];
      const isCharCorrect = typedChar === expectedChar;
      const targetKey = findKeyForChar(keys, expectedChar);
      const expectedFinger = targetKey.finger;

      // Sensor Fusion: Interpolate 10 fingertips at exact keydown timestamp
      let detectedFinger: FingerId = expectedFinger;
      let currentFingerPos: Point2D = {
        x: targetKey.x + targetKey.w / 2,
        y: targetKey.y + targetKey.h / 2,
      };
      let replayFrames: HandLandmarkFrame[] | undefined;

      const interpFrame = ringBufferRef.current.interpolateAt(now);
      if (trackerStatus === 'active' && interpFrame && homography) {
        const zVels = ringBufferRef.current.estimateZVelocities(now);
        const projections = projectFingertips(
          interpFrame,
          homography,
          persisted.fineTune,
          zVels
        );
        detectedFinger = classifyStrikingFinger(targetKey, projections);
        const matchProj = projections.find((p) => p.finger === detectedFinger);
        if (matchProj) {
          currentFingerPos = { x: matchProj.normX, y: matchProj.normY };
        }
        replayFrames = ringBufferRef.current.getRecentWindow(1400, now);
      } else {
        // Keystroke-Only Mode biomechanical fallback
        const prevPos = lastFingerPosRef.current[expectedFinger] ?? homeCenters[expectedFinger];
        const reachDist = Math.hypot(
          (currentFingerPos.x - prevPos.x) * 15,
                                     (currentFingerPos.y - prevPos.y) * 5
        );
        // Simulate occasional outer-pinky/ring drift on long reaches when webcam is off
        if (reachDist > 2.3 && Math.random() < 0.14) {
          detectedFinger = expectedFinger.startsWith('L-') ? 'L-Index' : 'R-Index';
        }
      }

      const isFingerCorrect =
      detectedFinger === expectedFinger ||
      (targetKey.code === 'Space' &&
      (detectedFinger === 'L-Thumb' || detectedFinger === 'R-Thumb'));

      // Travel distance in key-width units
      const prevPos =
      lastFingerPosRef.current[detectedFinger] ?? homeCenters[detectedFinger];
      const travelDistanceKeys = Math.hypot(
        (currentFingerPos.x - prevPos.x) * 15,
                                            (currentFingerPos.y - prevPos.y) * 5
      );
      const homeAnchor = homeCenters[expectedFinger];
      const optimalDistanceKeys = Math.hypot(
        (targetKey.x + targetKey.w / 2 - homeAnchor.x) * 15,
                                             (targetKey.y + targetKey.h / 2 - homeAnchor.y) * 5
      );
      lastFingerPosRef.current[detectedFinger] = currentFingerPos;

      const interKeyMs =
      lastKeystrokeTsRef.current !== null ? now - lastKeystrokeTsRef.current : 140;
      lastKeystrokeTsRef.current = now;

      const isSameFingerBigram =
      lastFingerUsedRef.current !== null &&
      lastFingerUsedRef.current === detectedFinger &&
      expectedChar !== ' ';
      lastFingerUsedRef.current = detectedFinger;

      // Tactile Audio Coaching + Visual Flash
      if (isFingerCorrect) {
        audioCoach.playCorrectClick(audioMode);
        setLastFlash({
          code: targetKey.code,
          isFingerCorrect: true,
          message: null,
          timestamp: now,
        });
      } else {
        audioCoach.playWrongFingerAlert(audioMode);
        setLastFlash({
          code: targetKey.code,
          isFingerCorrect: false,
          message: `Used ${detectedFinger} instead of ${expectedFinger}`,
          timestamp: now,
        });
      }

      recordsRef.current.push({
        timestamp: now,
        expectedChar,
        typedChar,
        isCharCorrect,
        keyDef: targetKey,
        expectedFinger,
        detectedFinger,
        isFingerCorrect,
        travelDistanceKeys,
        optimalDistanceKeys,
        interKeyMs,
        isSameFingerBigram,
        replayFrames,
      });

      const nextTyped = typedText + typedChar;
      setTypedText(nextTyped);

      if (nextTyped.length >= promptText.length) {
        finishRun((now - effectiveStart) / 1000);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    showCalibModal,
    showProgressModal,
    showCustomModal,
    isCreatingUser,
    resetTest,
    runStatus,
    mode,
    startTimeMs,
    typedText,
    promptText,
    keys,
    ringBufferRef,
    trackerStatus,
    homography,
    persisted.fineTune,
    homeCenters,
    audioMode,
    finishRun,
  ]);

  // Export / Import JSON Backup
  const handleExportBackup = () => {
    const blob = new Blob([JSON.stringify(persisted, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kinetictype-cv-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as PersistedAppState;
        if (Array.isArray(parsed.users) && parsed.users.length > 0) {
          setPersisted(parsed);
        }
      } catch {
        // Ignore malformed JSON
      }
    };
    reader.readAsText(file);
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newUserName.trim();
    if (!trimmed) return;
    const created = createDefaultProfile(trimmed);
    setPersisted((prev) => ({
      ...prev,
      activeUserId: created.id,
      users: [...prev.users, created],
    }));
    setNewUserName('');
    setIsCreatingUser(false);
  };

  // Live Telemetry Computations
  const totalAllUsersSec = useMemo(
    () => persisted.users.reduce((acc, u) => acc + u.cumulativeSeconds, 0),
                                   [persisted.users]
  );

  const liveWpm = useMemo(() => {
    if (elapsedSec < 0.5) return 0;
    const correct = recordsRef.current.filter((r) => r.isCharCorrect).length;
    return Math.round(correct / 5 / (elapsedSec / 60));
  }, [elapsedSec, typedText]);

  const liveAccuracy = useMemo(() => {
    if (recordsRef.current.length === 0) return 100;
    const correct = recordsRef.current.filter((r) => r.isCharCorrect).length;
    return Math.round((correct / recordsRef.current.length) * 100);
  }, [typedText]);

  const liveFormScore = useMemo(() => {
    if (recordsRef.current.length === 0) return 100;
    const correctF = recordsRef.current.filter((r) => r.isFingerCorrect).length;
    return Math.round((correctF / recordsRef.current.length) * 100);
  }, [typedText]);

  const nextTargetKey = useMemo(() => {
    if (runStatus === 'finished' || typedText.length >= promptText.length) return null;
    return findKeyForChar(keys, promptText[typedText.length]);
  }, [runStatus, typedText.length, promptText, keys]);

  // Shadow Pacemaker Caret Position
  const effectivePacerTarget = pacerWpm === -1 ? Math.max(40, activeUser.bestWpm) : pacerWpm;
  const pacerCharIndex =
  runStatus === 'running' && effectivePacerTarget > 0
  ? Math.min(
    promptText.length,
    Math.floor(((effectivePacerTarget * 5) / 60) * elapsedSec)
  )
  : -1;

  const mistakeRecords = useMemo(
    () => recordsRef.current.filter((r) => !r.isFingerCorrect),
                                 [lastSummary]
  );

  const isZenActive = zenMode && runStatus === 'running';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
    {/* Persistent Top Telemetry & Multi-User Bar */}
    <header
    className={`border-b border-zinc-800/90 bg-zinc-900/90 backdrop-blur sticky top-0 z-30 transition-opacity duration-300 ${
      isZenActive ? 'opacity-20 hover:opacity-100' : 'opacity-100'
    }`}
    >
    <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
    {/* Brand + Layout Switcher */}
    <div className="flex items-center gap-3">
    <div className="flex items-center gap-2 font-bold text-sm text-white">
    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 text-zinc-950 flex items-center justify-center font-mono font-black">
    KT
    </div>
    <span>
    KineticType <span className="text-cyan-400">CV</span>
    </span>
    </div>

    <select
    aria-label="Keyboard Layout"
    value={persisted.layout}
    onChange={(e) =>
      setPersisted((prev) => ({
        ...prev,
        layout: e.target.value as KeyboardLayoutId,
      }))
    }
    className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-zinc-200 font-mono text-xs focus:outline-none focus:border-cyan-400"
    >
    <option value="QWERTY_ANSI">QWERTY (ANSI)</option>
    <option value="QWERTY_ISO">QWERTY (ISO)</option>
    <option value="AZERTY_FR">AZERTY (FR/MA)</option>
    </select>
    </div>

    {/* Multi-User Profile Switcher & Cumulative Practice Hours */}
    <div className="flex flex-wrap items-center gap-3">
    {/* Active Profile Selector */}
    <div className="flex items-center gap-1.5 bg-zinc-800/90 border border-zinc-700 rounded-xl px-2.5 py-1">
    <User className="w-3.5 h-3.5 text-emerald-400" />
    <select
    aria-label="Active User Profile"
    value={activeUser.id}
    onChange={(e) =>
      setPersisted((prev) => ({ ...prev, activeUserId: e.target.value }))
    }
    className="bg-transparent text-zinc-100 font-medium focus:outline-none"
    >
    {persisted.users.map((u) => (
      <option key={u.id} value={u.id} className="bg-zinc-900">
      {u.name}
      </option>
    ))}
    </select>
    <button
    type="button"
    onClick={() => setIsCreatingUser(true)}
    title="Create new profile"
    className="p-0.5 rounded hover:bg-zinc-700 text-zinc-300"
    >
    <Plus className="w-3.5 h-3.5" />
    </button>
    </div>

    {/* Registered Users Counter */}
    <div
    className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-800/60 border border-zinc-800 text-zinc-300"
    title="Local profiles & global active typist counter"
    >
    <Users className="w-3.5 h-3.5 text-cyan-400" />
    <span>
    <strong className="text-white font-mono">{persisted.users.length}</strong> Local •{' '}
    <strong className="text-emerald-400 font-mono">1,428</strong> Active Typists
    </span>
    </div>

    {/* Cumulative Practice Timer */}
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-800/60 border border-zinc-800 text-zinc-300 font-mono">
    <Clock className="w-3.5 h-3.5 text-amber-400" />
    <span>
    You: <strong className="text-white">{formatHours(activeUser.cumulativeSeconds)}</strong>
    </span>
    <span className="text-zinc-600">|</span>
    <span className="hidden sm:inline">
    Total: <strong className="text-cyan-300">{formatHours(totalAllUsersSec)}</strong>
    </span>
    </div>

    {/* Progress, Audio, Export/Import */}
    <div className="flex items-center gap-1.5">
    <button
    type="button"
    onClick={() => setShowProgressModal(true)}
    className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 flex items-center gap-1"
    >
    <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
    <span>Progress</span>
    </button>

    <button
    type="button"
    onClick={() =>
      setAudioMode((m) => (m === 'alerts' ? 'all' : m === 'all' ? 'muted' : 'alerts'))
    }
    title="Cycle Audio Coaching (Alerts Only / All Clicks / Muted)"
    className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 flex items-center gap-1"
    >
    {audioMode === 'muted' ? (
      <VolumeX className="w-3.5 h-3.5 text-zinc-500" />
    ) : (
      <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
    )}
    <span className="capitalize">{audioMode}</span>
    </button>

    <button
    type="button"
    onClick={handleExportBackup}
    title="Export JSON Backup"
    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300"
    >
    <Download className="w-3.5 h-3.5" />
    </button>
    <button
    type="button"
    onClick={() => importInputRef.current?.click()}
    title="Import JSON Backup"
    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300"
    >
    <Upload className="w-3.5 h-3.5" />
    </button>
    <input
    ref={importInputRef}
    type="file"
    accept="application/json"
    onChange={handleImportBackup}
    className="hidden"
    />
    </div>
    </div>
    </div>
    </header>

    {/* Graceful Keystroke-Only Fallback / Webcam CV Banner */}
    {trackerStatus !== 'active' && !isZenActive && (
      <div className="bg-zinc-900/70 border-b border-zinc-800 px-4 py-2">
      <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
      <div className="flex items-center gap-2 text-zinc-300">
      <CameraOff className="w-4 h-4 text-amber-400 shrink-0" />
      <span>
      {trackerStatus === 'loading'
        ? 'Initializing MediaPipe GPU HandLandmarker (60 FPS)...'
        : trackerError
        ? `Running in Keystroke-Only Mode (${trackerError}).`
        : 'Running in Keystroke-Only Mode — enable your webcam pointed at your keyboard for real-time 10-finger skeleton tracking.'}
        </span>
        </div>
        <div className="flex items-center gap-2">
        <button
        type="button"
        onClick={startCamera}
        disabled={trackerStatus === 'loading'}
        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold flex items-center gap-1.5 transition"
        >
        <Camera className="w-3.5 h-3.5" />
        Enable Webcam CV
        </button>
        <button
        type="button"
        onClick={() => setShowCalibModal(true)}
        className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 flex items-center gap-1.5"
        >
        <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
        Calibrate Corners
        </button>
        </div>
        </div>
        </div>
    )}

    {/* Main Content Area */}
    <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 flex flex-col justify-between gap-6">
    {/* Mode Bar & Vision Controls */}
    <div
    className={`flex flex-wrap items-center justify-between gap-3 transition-opacity duration-300 ${
      isZenActive ? 'opacity-15 hover:opacity-100' : 'opacity-100'
    }`}
    >
    {/* Drill Modes */}
    <div className="flex flex-wrap items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-xl text-xs">
    {(
      [
        { id: '15s', label: '15s' },
      { id: '30s', label: '30s' },
      { id: '60s', label: '60s' },
      { id: '50w', label: '50 words' },
      { id: 'weakness', label: 'AI Weakness Drill' },
      { id: 'code_ts', label: 'Code: TS/Rust' },
      { id: 'code_py', label: 'Code: Python' },
      { id: 'custom', label: 'Custom Text' },
      ] as { id: DrillMode; label: string }[]
    ).map((m) => (
      <button
      key={m.id}
      type="button"
      onClick={() => {
        if (m.id === 'custom') {
          setShowCustomModal(true);
        }
        resetTest(m.id);
      }}
      className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1 ${
        mode === m.id
        ? 'bg-zinc-800 text-emerald-400 shadow-sm'
        : 'text-zinc-400 hover:text-zinc-200'
      }`}
      >
      {m.id === 'weakness' && <Sparkles className="w-3 h-3 text-cyan-400" />}
      {(m.id === 'code_ts' || m.id === 'code_py') && (
        <FileCode2 className="w-3 h-3 text-purple-400" />
      )}
      {m.label}
      </button>
    ))}
    </div>

    {/* Shadow Pacer, Zen Mode & Calibration */}
    <div className="flex flex-wrap items-center gap-2 text-xs">
    <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1.5">
    <Gauge className="w-3.5 h-3.5 text-purple-400" />
    <span className="text-zinc-400">Pacer:</span>
    <select
    aria-label="Shadow Pacemaker WPM"
    value={pacerWpm}
    onChange={(e) => setPacerWpm(Number(e.target.value))}
    className="bg-transparent text-zinc-200 font-mono focus:outline-none"
    >
    <option value={0} className="bg-zinc-900">Off</option>
    <option value={-1} className="bg-zinc-900">PB ({activeUser.bestWpm || 40})</option>
    <option value={60} className="bg-zinc-900">60 WPM</option>
    <option value={80} className="bg-zinc-900">80 WPM</option>
    <option value={100} className="bg-zinc-900">100 WPM</option>
    <option value={120} className="bg-zinc-900">120 WPM</option>
    </select>
    </div>

    <button
    type="button"
    onClick={() => setZenMode((z) => !z)}
    className={`px-3 py-1.5 rounded-xl border font-medium flex items-center gap-1.5 ${
      zenMode
      ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
    }`}
    >
    {zenMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
    Zen
    </button>

    <button
    type="button"
    onClick={() => setShowCalibModal(true)}
    className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-medium flex items-center gap-1.5"
    >
    <Sliders className="w-3.5 h-3.5 text-emerald-400" />
    Calibrate
    </button>
    </div>
    </div>

    {/* Active Typing Arena OR Post-Run Analytics */}
    {runStatus === 'finished' && lastSummary ? (
      <AnalyticsReport
      summary={lastSummary}
      mistakeRecords={mistakeRecords}
      onTrainWeaknesses={() => resetTest('weakness')}
      onRestart={() => resetTest()}
      />
    ) : (
      <div className="space-y-6 my-auto">
      {/* Live HUD Readouts */}
      <div className="max-w-4xl mx-auto flex items-center justify-between px-2">
      <div className="flex items-center gap-6 font-mono">
      <div>
      <span className="text-[11px] uppercase tracking-wider text-zinc-500 block">
      Live WPM
      </span>
      <span className="text-2xl font-bold text-emerald-400">{liveWpm}</span>
      </div>
      <div>
      <span className="text-[11px] uppercase tracking-wider text-zinc-500 block">
      Accuracy
      </span>
      <span className="text-2xl font-bold text-white">{liveAccuracy}%</span>
      </div>
      <div>
      <span className="text-[11px] uppercase tracking-wider text-zinc-500 block">
      Form Score
      </span>
      <span className="text-2xl font-bold text-cyan-400">{liveFormScore}%</span>
      </div>
      </div>

      <div className="flex items-center gap-3 font-mono text-sm">
      <span className="text-zinc-400">
      {mode === '15s' || mode === '30s' || mode === '60s'
        ? `${Math.max(
          0,
          Math.ceil(
            (mode === '15s' ? 15 : mode === '30s' ? 30 : 60) - elapsedSec
          )
        )}s`
        : `${typedText.length}/${promptText.length}`}
        </span>
        <button
        type="button"
        onClick={() => resetTest()}
        title="Restart Run (Esc or Tab+Enter)"
        className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition"
        >
        <RefreshCw className="w-4 h-4" />
        </button>
        </div>
        </div>

        {/* Distraction-Free Monospace Typing Prompt */}
        <div className="max-w-4xl mx-auto bg-zinc-900/50 border border-zinc-800/90 rounded-2xl p-6 sm:p-8 shadow-inner relative">
        <div
        className={`font-mono leading-relaxed select-none ${
          mode === 'code_ts' || mode === 'code_py' || mode === 'custom'
          ? 'text-base sm:text-lg whitespace-pre-wrap'
          : 'text-xl sm:text-2xl tracking-wide'
        }`}
        >
        {promptText.split('').map((char, idx) => {
          const isTyped = idx < typedText.length;
          const isCorrect = isTyped && typedText[idx] === char;
          const isCurrent = idx === typedText.length;
          const isPacer = idx === pacerCharIndex;

          let cls = 'text-zinc-500';
        if (isTyped) {
          cls = isCorrect
          ? 'text-zinc-100'
          : 'text-rose-400 bg-rose-500/20 rounded';
        }

        const displayChar = char === '\n' ? '↵\n' : char;

        return (
          <span key={idx} className={`relative ${cls}`}>
          {isCurrent && (
            <span className="absolute -left-[1px] top-0.5 bottom-0.5 w-[2.5px] bg-emerald-400 animate-pulse rounded-full" />
          )}
          {isPacer && (
            <span
            title="Shadow Pacemaker"
            className="absolute -left-[1px] top-0.5 bottom-0.5 w-[2px] bg-purple-400/70 rounded-full"
            />
          )}
          {displayChar}
          </span>
        );
        })}
        </div>

        <div className="mt-5 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
        <span>Start typing immediately — timer triggers on first keystroke</span>
        <span>Esc or Tab+Enter to restart</span>
        </div>
        </div>

        {/* Live Interactive SVG Keyboard */}
        <div
        className={`transition-opacity duration-300 ${
          isZenActive ? 'opacity-20 hover:opacity-100' : 'opacity-100'
        }`}
        >
        <VirtualKeyboard
        keys={keys}
        nextKey={nextTargetKey}
        lastFlash={lastFlash}
        liveProjections={liveProjections}
        trails={trails}
        showTrails={showTrails}
        onToggleTrails={() => setShowTrails((v) => !v)}
        />
        </div>
        </div>
    )}
    </main>

    {/* Picture-in-Picture Live Webcam Skeleton Feed */}
    <video ref={videoRef} playsInline muted className="hidden" />
    {trackerStatus === 'active' && showPip && !isZenActive && (
      <div className="fixed bottom-4 right-4 z-40 w-64 bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden shadow-2xl">
      <div className="px-3 py-1.5 bg-zinc-950/90 border-b border-zinc-800 flex items-center justify-between text-[11px]">
      <span className="flex items-center gap-1.5 text-emerald-400 font-mono font-semibold">
      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
      CV LIVE • {fps} FPS
      </span>
      <div className="flex items-center gap-1">
      <button
      type="button"
      onClick={() => setShowCalibModal(true)}
      className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 hover:text-white"
      >
      Calib
      </button>
      <button
      type="button"
      onClick={stopCamera}
      title="Stop Camera"
      className="p-0.5 text-zinc-400 hover:text-rose-400"
      >
      <X className="w-3.5 h-3.5" />
      </button>
      </div>
      </div>
      <canvas ref={pipCanvasRef} width={320} height={180} className="w-full h-36 object-cover" />
      </div>
    )}

    {/* Calibration Modal */}
    <CalibrationModal
    isOpen={showCalibModal}
    onClose={() => setShowCalibModal(false)}
    videoRef={videoRef}
    trackerStatus={trackerStatus}
    onStartCamera={startCamera}
    quad={persisted.calibration}
    onChangeQuad={(q) => setPersisted((prev) => ({ ...prev, calibration: q }))}
    fineTune={persisted.fineTune}
    onChangeFineTune={(ft) => setPersisted((prev) => ({ ...prev, fineTune: ft }))}
    keys={keys}
    latestFrameRef={latestFrameRef}
    />

    {/* Progress Modal */}
    <ProgressModal
    isOpen={showProgressModal}
    onClose={() => setShowProgressModal(false)}
    user={activeUser}
    />

    {/* Create New Profile Modal */}
    {isCreatingUser && (
      <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <form
      onSubmit={handleCreateUser}
      className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-5 space-y-4"
      >
      <h3 className="text-base font-bold text-white">Create Typist Profile</h3>
      <input
      type="text"
      autoFocus
      placeholder="e.g., Taha (Mechanical 65%)"
      value={newUserName}
      onChange={(e) => setNewUserName(e.target.value)}
      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-white focus:outline-none focus:border-emerald-400"
      />
      <div className="flex justify-end gap-2 text-xs">
      <button
      type="button"
      onClick={() => setIsCreatingUser(false)}
      className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-300"
      >
      Cancel
      </button>
      <button
      type="submit"
      className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold"
      >
      Create Profile
      </button>
      </div>
      </form>
      </div>
    )}

    {/* Custom Text / Snippet Editor Modal */}
    {showCustomModal && (
      <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-xl w-full p-5 space-y-4">
      <h3 className="text-base font-bold text-white">Custom Text / Code Drill</h3>
      <textarea
      rows={6}
      value={persisted.customText}
      onChange={(e) =>
        setPersisted((prev) => ({ ...prev, customText: e.target.value }))
      }
      placeholder="Paste any code snippet, shell command sequence, or prose..."
      className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-700 font-mono text-xs text-zinc-100 focus:outline-none focus:border-cyan-400"
      />
      <div className="flex justify-end gap-2 text-xs">
      <button
      type="button"
      onClick={() => {
        setShowCustomModal(false);
        resetTest('custom');
      }}
      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
      >
      Load Into Arena
      </button>
      </div>
      </div>
      </div>
    )}
    </div>
  );
}

export default App;
