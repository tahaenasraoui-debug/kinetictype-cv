import type { CalibrationFineTune, CalibrationQuad, Point2D } from '../types';

export type Matrix3x3 = [
    number, number, number,
number, number, number,
number, number, number
];

function solveLinearSystem8x8(A: number[][], b: number[]): number[] | null {
    const n = 8;
    const M = A.map((row, i) => [...row, b[i]]);

    for (let col = 0; col < n; col++) {
        let pivotRow = col;
        let maxVal = Math.abs(M[col][col]);
        for (let row = col + 1; row < n; row++) {
            const val = Math.abs(M[row][col]);
            if (val > maxVal) {
                maxVal = val;
                pivotRow = row;
            }
        }
        if (maxVal < 1e-10) return null;

        if (pivotRow !== col) {
            [M[col], M[pivotRow]] = [M[pivotRow], M[col]];
        }

        const pivot = M[col][col];
        for (let j = col; j <= n; j++) {
            M[col][j] /= pivot;
        }

        for (let row = 0; row < n; row++) {
            if (row !== col) {
                const factor = M[row][col];
                for (let j = col; j <= n; j++) {
                    M[row][j] -= factor * M[col][j];
                }
            }
        }
    }

    return M.map((row) => row[n]);
}

export function computeHomography(quad: CalibrationQuad): Matrix3x3 | null {
    const src: Point2D[] = [
        quad.topLeft,
        quad.topRight,
        quad.bottomRight,
        quad.bottomLeft,
    ];
    const dst: Point2D[] = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
    ];

    const A: number[][] = [];
    const b: number[] = [];

    for (let i = 0; i < 4; i++) {
        const { x: u, y: v } = src[i];
        const { x, y } = dst[i];
        A.push([u, v, 1, 0, 0, 0, -x * u, -x * v]);
        b.push(x);
        A.push([0, 0, 0, u, v, 1, -y * u, -y * v]);
        b.push(y);
    }

    const h = solveLinearSystem8x8(A, b);
    if (!h) return null;

    return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

export function invertHomography(H: Matrix3x3): Matrix3x3 | null {
    const [a, b, c, d, e, f, g, h, i] = H;
    const A = e * i - f * h;
    const B = -(d * i - f * g);
    const C = d * h - e * g;
    const D = -(b * i - c * h);
    const E = a * i - c * g;
    const F = -(a * h - b * g);
    const G = b * f - c * e;
    const H_ = -(a * f - c * d);
    const I = a * e - b * d;

    const det = a * A + b * B + c * C;
    if (Math.abs(det) < 1e-12) return null;
    const invDet = 1 / det;

    return [
        A * invDet, D * invDet, G * invDet,
        B * invDet, E * invDet, H_ * invDet,
        C * invDet, F * invDet, I * invDet,
    ];
}

export function applyHomography(
    H: Matrix3x3,
    pt: Point2D,
    fineTune?: CalibrationFineTune,
    zDepth = 0
): Point2D {
    const w = H[6] * pt.x + H[7] * pt.y + H[8];
    const safeW = Math.abs(w) < 1e-8 ? 1e-8 : w;
    let x = (H[0] * pt.x + H[1] * pt.y + H[2]) / safeW;
    let y = (H[3] * pt.x + H[4] * pt.y + H[5]) / safeW;

    if (fineTune) {
        x += fineTune.offsetX;
        y += fineTune.offsetY + Math.max(0, -zDepth) * fineTune.parallaxFactor;
    }

    return { x, y };
}

export function autoDetectKeyboardQuad(video: HTMLVideoElement): CalibrationQuad | null {
    if (!video.videoWidth || !video.videoHeight) return null;
    const w = 160;
    const h = 120;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h).data;
    const gray = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
        gray[i] = 0.299 * img[i * 4] + 0.587 * img[i * 4 + 1] + 0.114 * img[i * 4 + 2];
    }

    const findCorner = (
        xMin: number,
        xMax: number,
        yMin: number,
        yMax: number,
        targetX: number,
        targetY: number
    ): Point2D => {
        let bestScore = -1;
        let bestX = targetX;
        let bestY = targetY;

        for (let y = Math.max(2, Math.floor(yMin * h)); y < Math.min(h - 2, Math.floor(yMax * h)); y++) {
            for (let x = Math.max(2, Math.floor(xMin * w)); x < Math.min(w - 2, Math.floor(xMax * w)); x++) {
                const gx =
                -gray[(y - 1) * w + (x - 1)] + gray[(y - 1) * w + (x + 1)] +
                -2 * gray[y * w + (x - 1)] + 2 * gray[y * w + (x + 1)] +
                -gray[(y + 1) * w + (x - 1)] + gray[(y + 1) * w + (x + 1)];
                const gy =
                -gray[(y - 1) * w + (x - 1)] - 2 * gray[(y - 1) * w + x] - gray[(y - 1) * w + (x + 1)] +
                gray[(y + 1) * w + (x - 1)] + 2 * gray[(y + 1) * w + x] + gray[(y + 1) * w + (x + 1)];
                const mag = Math.hypot(gx, gy);
                const nx = x / w;
                const ny = y / h;
                const distPenalty = 1 - 0.5 * Math.hypot(nx - targetX, ny - targetY);
                const score = mag * distPenalty;
                if (score > bestScore) {
                    bestScore = score;
                    bestX = nx;
                    bestY = ny;
                }
            }
        }
        return { x: bestX, y: bestY };
    };

    return {
        topLeft: findCorner(0.05, 0.35, 0.15, 0.45, 0.14, 0.28),
        topRight: findCorner(0.65, 0.95, 0.15, 0.45, 0.86, 0.28),
        bottomLeft: findCorner(0.03, 0.32, 0.55, 0.92, 0.10, 0.78),
        bottomRight: findCorner(0.68, 0.97, 0.55, 0.92, 0.90, 0.78),
    };
}
