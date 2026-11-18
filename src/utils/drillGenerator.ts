import type { DrillMode } from '../types';

const COMMON_WORDS = [
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it', 'for', 'not', 'on', 'with',
'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out',
'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no',
'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them',
'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new',
'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us', 'system', 'kernel', 'memory',
'vector', 'matrix', 'tensor', 'compile', 'thread', 'stream', 'buffer', 'latency', 'signal',
'frame', 'query', 'index', 'binary', 'struct', 'module', 'syntax', 'parser', 'socket', 'cache',
'planet', 'rhythm', 'muscle', 'swift', 'exact', 'focus', 'anchor', 'travel', 'finger', 'strike',
'zero', 'quick', 'brown', 'jumps', 'above', 'quiet', 'zephyr', 'quartz', 'complex', 'dynamic',
];

const TS_RUST_SNIPPETS = [
    `const solveHomography = (src: Point2D[], dst: Point2D[]): number[] => {\n  const matrix: number[][] = [];\n  for (let i = 0; i < 4; i++) {\n    matrix.push([src[i].x, src[i].y, 1, 0, 0, 0]);\n  }\n  return matrix.flat();\n};`,
    `pub fn interpolate_frame(prev: &[f32; 3], next: &[f32; 3], alpha: f32) -> [f32; 3] {\n    [\n        prev[0] + (next[0] - prev[0]) * alpha,\n        prev[1] + (next[1] - prev[1]) * alpha,\n        prev[2] + (next[2] - prev[2]) * alpha,\n    ]\n}`,
    `interface RingBuffer<T> {\n  capacity: number;\n  items: Array<T | null>;\n  push(item: T): void;\n  latest(): T | undefined;\n}`,
];

const PYTHON_SNIPPETS = [
    `def compute_wpm(chars: int, elapsed_sec: float) -> float:\n    if elapsed_sec <= 0.0:\n        return 0.0\n    words = chars / 5.0\n    return round(words / (elapsed_sec / 60.0), 2)`,
    `class SensorFusionEngine:\n    def __init__(self, window_ms: int = 150):\n        self.window_ms = window_ms\n        self.buffer: list[tuple[float, list[float]]] = []\n\n    def ingest(self, ts: float, landmarks: list[float]) -> None:\n        self.buffer.append((ts, landmarks))`,
];

export function generateTypingPrompt(
    mode: DrillMode,
    weakChars: Record<string, number> = {},
    weakBigrams: Record<string, number> = {},
    customText = ''
): string {
    if (mode === 'custom') {
        const trimmed = customText.trim();
        return trimmed.length > 0
        ? trimmed
        : 'Paste any custom code snippet, terminal workflow, or prose passage in the Custom Text editor to train real-world muscle memory.';
    }

    if (mode === 'code_ts') {
        return TS_RUST_SNIPPETS[Math.floor(Math.random() * TS_RUST_SNIPPETS.length)];
    }

    if (mode === 'code_py') {
        return PYTHON_SNIPPETS[Math.floor(Math.random() * PYTHON_SNIPPETS.length)];
    }

    const wordCount = mode === '15s' ? 40 : mode === '30s' ? 75 : mode === '60s' ? 130 : 50;

    // Score every candidate word by weakness overlap when running AI Weakness Drill
    const scored = COMMON_WORDS.map((word) => {
        let weight = 1;
        if (mode === 'weakness') {
            for (const ch of word) {
                weight += (weakChars[ch] ?? 0) * 4;
            }
            for (let i = 0; i < word.length - 1; i++) {
                const bg = word.slice(i, i + 2);
                weight += (weakBigrams[bg] ?? 0) * 6;
            }
        }
        return { word, weight };
    });

    const totalWeight = scored.reduce((acc, s) => acc + s.weight, 0);
    const chosen: string[] = [];

    for (let i = 0; i < wordCount; i++) {
        let r = Math.random() * totalWeight;
        let picked = scored[0].word;
        for (const item of scored) {
            r -= item.weight;
            if (r <= 0) {
                picked = item.word;
                break;
            }
        }
        chosen.push(picked);
    }

    return chosen.join(' ');
}
