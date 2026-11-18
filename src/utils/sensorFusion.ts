import type {
    CalibrationFineTune,
    FingerId,
    FingertipProjection,
    HandLandmarkFrame,
    KeyDef,
    Point3D,
} from '../types';
import { type Matrix3x3, applyHomography } from './homography';

const FINGERTIP_MAP: { index: number; left: FingerId; right: FingerId }[] = [
    { index: 4, left: 'L-Thumb', right: 'R-Thumb' },
{ index: 8, left: 'L-Index', right: 'R-Index' },
{ index: 12, left: 'L-Middle', right: 'R-Middle' },
{ index: 16, left: 'L-Ring', right: 'R-Ring' },
{ index: 20, left: 'L-Pinky', right: 'R-Pinky' },
];

export class HandRingBuffer {
    private frames: HandLandmarkFrame[] = [];
    private maxCapacity: number;

    constructor(maxCapacity = 180) {
        this.maxCapacity = maxCapacity;
    }

    push(frame: HandLandmarkFrame): void {
        this.frames.push(frame);
        if (this.frames.length > this.maxCapacity) {
            this.frames.shift();
        }
    }

    clear(): void {
        this.frames = [];
    }

    getLatest(): HandLandmarkFrame | null {
        return this.frames.length > 0 ? this.frames[this.frames.length - 1] : null;
    }

    getRecentWindow(windowMs: number, endTimestamp: number): HandLandmarkFrame[] {
        const startTs = endTimestamp - windowMs;
        return this.frames.filter((f) => f.timestamp >= startTs && f.timestamp <= endTimestamp);
    }

    /**
     * Temporally interpolates all 21 landmarks for both hands to the exact keydown timestamp.
     */
    interpolateAt(targetTs: number): HandLandmarkFrame | null {
        if (this.frames.length === 0) return null;
        if (this.frames.length === 1) return this.frames[0];

        let afterIdx = this.frames.findIndex((f) => f.timestamp >= targetTs);
        if (afterIdx === -1) return this.frames[this.frames.length - 1];
        if (afterIdx === 0) return this.frames[0];

        const f0 = this.frames[afterIdx - 1];
        const f1 = this.frames[afterIdx];
        const dt = f1.timestamp - f0.timestamp;
        const alpha = dt > 1e-4 ? Math.max(0, Math.min(1, (targetTs - f0.timestamp) / dt)) : 0;

        return {
            timestamp: targetTs,
            leftLandmarks: lerpLandmarks(f0.leftLandmarks, f1.leftLandmarks, alpha),
            rightLandmarks: lerpLandmarks(f0.rightLandmarks, f1.rightLandmarks, alpha),
        };
    }

    /**
     * Computes downward z-velocity (positive = plunging toward keycap) right before keydown.
     */
    estimateZVelocities(targetTs: number): Partial<Record<FingerId, number>> {
        const fNow = this.interpolateAt(targetTs);
        const fPrev = this.interpolateAt(targetTs - 45);
        if (!fNow || !fPrev) return {};

        const out: Partial<Record<FingerId, number>> = {};
        for (const item of FINGERTIP_MAP) {
            if (fNow.leftLandmarks && fPrev.leftLandmarks) {
                out[item.left] = fNow.leftLandmarks[item.index].z - fPrev.leftLandmarks[item.index].z;
            }
            if (fNow.rightLandmarks && fPrev.rightLandmarks) {
                out[item.right] = fNow.rightLandmarks[item.index].z - fPrev.rightLandmarks[item.index].z;
            }
        }
        return out;
    }
}

function lerpLandmarks(a: Point3D[] | null, b: Point3D[] | null, alpha: number): Point3D[] | null {
    if (!a && !b) return null;
    if (!a) return b;
    if (!b) return a;
    return a.map((pt, i) => ({
        x: pt.x + (b[i].x - pt.x) * alpha,
                             y: pt.y + (b[i].y - pt.y) * alpha,
                             z: pt.z + (b[i].z - pt.z) * alpha,
    }));
}

export function projectFingertips(
    frame: HandLandmarkFrame,
    H: Matrix3x3,
    fineTune: CalibrationFineTune,
    zVelocities: Partial<Record<FingerId, number>> = {}
): FingertipProjection[] {
    const projections: FingertipProjection[] = [];

    for (const item of FINGERTIP_MAP) {
        if (frame.leftLandmarks?.[item.index]) {
            const lm = frame.leftLandmarks[item.index];
            const mapped = applyHomography(H, { x: lm.x, y: lm.y }, fineTune, lm.z);
            projections.push({
                finger: item.left,
                hand: 'Left',
                normX: mapped.x,
                normY: mapped.y,
                z: lm.z,
                zVelocity: zVelocities[item.left] ?? 0,
            });
        }
        if (frame.rightLandmarks?.[item.index]) {
            const lm = frame.rightLandmarks[item.index];
            const mapped = applyHomography(H, { x: lm.x, y: lm.y }, fineTune, lm.z);
            projections.push({
                finger: item.right,
                hand: 'Right',
                normX: mapped.x,
                normY: mapped.y,
                z: lm.z,
                zVelocity: zVelocities[item.right] ?? 0,
            });
        }
    }

    return projections;
}

/**
 * Fuses 2D key-center distance (in key-width units) with downward z-dip velocity
 * to identify which physical finger struck the target key.
 */
export function classifyStrikingFinger(
    targetKey: KeyDef,
    projections: FingertipProjection[]
): FingerId {
    if (projections.length === 0) return targetKey.finger;

    const cx = targetKey.x + targetKey.w / 2;
    const cy = targetKey.y + targetKey.h / 2;
    const keyUnitW = 1 / 15;
    const keyUnitH = 0.2;

    let bestFinger: FingerId = projections[0].finger;
    let bestCost = Infinity;

    for (const p of projections) {
        // Spacebar spans a wide horizontal bar; clamp X distance inside spacebar bounds
        const dx =
        targetKey.code === 'Space'
        ? Math.max(0, Math.abs(p.normX - cx) - targetKey.w * 0.42) / keyUnitW
        : (p.normX - cx) / keyUnitW;
        const dy = (p.normY - cy) / keyUnitH;
        const distKeys = Math.hypot(dx, dy);

        // Reward downward plunging z-velocity and lower wrist-relative z depth
        const zPlungeBonus = Math.min(0.45, Math.max(-0.2, p.zVelocity * 18));
        const cost = distKeys - zPlungeBonus;

        if (cost < bestCost) {
            bestCost = cost;
            bestFinger = p.finger;
        }
    }

    return bestFinger;
}

/**
 * Computes ulnar deviation angle (degrees) between wrist (0), middle MCP (9), and pinky MCP (17).
 */
export function computeUlnarDeviationDeg(landmarks: Point3D[] | null): number | null {
    if (!landmarks || landmarks.length < 21) return null;
    const wrist = landmarks[0];
    const midMcp = landmarks[9];
    const vX = midMcp.x - wrist.x;
    const vY = midMcp.y - wrist.y;
    const angleRad = Math.atan2(Math.abs(vX), Math.max(1e-4, Math.abs(vY)));
    return (angleRad * 180) / Math.PI;
}
