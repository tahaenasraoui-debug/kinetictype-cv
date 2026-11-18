export type FingerId =
| 'L-Pinky'
| 'L-Ring'
| 'L-Middle'
| 'L-Index'
| 'L-Thumb'
| 'R-Thumb'
| 'R-Index'
| 'R-Middle'
| 'R-Ring'
| 'R-Pinky';

export type KeyboardLayoutId = 'QWERTY_ANSI' | 'QWERTY_ISO' | 'AZERTY_FR';

export type DrillMode =
| '15s'
| '30s'
| '60s'
| '50w'
| 'weakness'
| 'code_ts'
| 'code_py'
| 'custom';

export type AudioMode = 'all' | 'alerts' | 'muted';

export interface Point2D {
    x: number;
    y: number;
}

export interface Point3D extends Point2D {
    z: number;
}

export interface CalibrationQuad {
    topLeft: Point2D;     // Esc
    topRight: Point2D;    // Backspace
    bottomLeft: Point2D;  // Left Ctrl
    bottomRight: Point2D; // Right Ctrl
}

export interface CalibrationFineTune {
    offsetX: number;         // normalized nudge [-0.05, 0.05]
    offsetY: number;         // normalized nudge [-0.05, 0.05]
    parallaxFactor: number;  // [0.0 = overhead 90deg, 0.15 = angled 45deg]
}

export interface KeyDef {
    code: string;
    label: string;
    shiftLabel?: string;
    chars: string[];
    x: number; // left edge in normalized [0, 1]
    y: number; // top edge in normalized [0, 1]
    w: number; // width in normalized [0, 1]
    h: number; // height in normalized [0, 1]
    finger: FingerId;
    row: number;
}

export interface HandLandmarkFrame {
    timestamp: number;
    leftLandmarks: Point3D[] | null;
    rightLandmarks: Point3D[] | null;
}

export interface FingertipProjection {
    finger: FingerId;
    hand: 'Left' | 'Right';
    normX: number;
    normY: number;
    z: number;
    zVelocity: number;
}

export interface KeystrokeEventRecord {
    timestamp: number;
    expectedChar: string;
    typedChar: string;
    isCharCorrect: boolean;
    keyDef: KeyDef;
    expectedFinger: FingerId;
    detectedFinger: FingerId;
    isFingerCorrect: boolean;
    travelDistanceKeys: number;
    optimalDistanceKeys: number;
    interKeyMs: number;
    isSameFingerBigram: boolean;
    ulnarAngleDeg?: number;
    replayFrames?: HandLandmarkFrame[];
}

export interface FingerStat {
    finger: FingerId;
    strikes: number;
    correctStrikes: number;
    totalLatencyMs: number;
    totalTravelKeys: number;
    sfbCount: number;
}

export interface SessionSummary {
    id: string;
    timestamp: number;
    mode: DrillMode;
    layout: KeyboardLayoutId;
    durationSec: number;
    netWpm: number;
    rawWpm: number;
    accuracyPct: number;
    formCompliancePct: number;
    rhythmConsistencyPct: number;
    totalTravelKeys: number;
    optimalTravelKeys: number;
    efficiencyRatio: number;
    avgHomeRowDriftKeys: number;
    leftHandStrikes: number;
    rightHandStrikes: number;
    leftAvgLatencyMs: number;
    rightAvgLatencyMs: number;
    ergonomicScorePct: number;
    fatigueSpikeDetected: boolean;
    fingerBreakdown: Record<FingerId, FingerStat>;
    badHabits: {
        keyLabel: string;
        char: string;
        expectedFinger: FingerId;
        commonWrongFinger: FingerId | null;
        wrongFingerCount: number;
        avgLatencyMs: number;
        avgTravelKeys: number;
        score: number;
    }[];
    weakChars: string[];
    weakBigrams: string[];
}

export interface UserProfile {
    id: string;
    name: string;
    createdAt: number;
    cumulativeSeconds: number;
    bestWpm: number;
    sessions: SessionSummary[];
    weakChars: Record<string, number>;
    weakBigrams: Record<string, number>;
}
