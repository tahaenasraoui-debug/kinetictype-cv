import type { AudioMode } from '../types';

class AudioCoachEngine {
    private ctx: AudioContext | null = null;

    private ensureContext(): AudioContext | null {
        if (typeof window === 'undefined') return null;
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
        return this.ctx;
    }

    playCorrectClick(mode: AudioMode): void {
        if (mode !== 'all') return;
        const ctx = this.ensureContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.025);

        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.03);
    }

    playWrongFingerAlert(mode: AudioMode): void {
        if (mode === 'muted') return;
        const ctx = this.ensureContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        [0, 0.065].forEach((offset) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(165, now + offset);
            osc.frequency.exponentialRampToValueAtTime(110, now + offset + 0.05);

            gain.gain.setValueAtTime(0.075, now + offset);
            gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.055);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + offset);
            osc.stop(now + offset + 0.06);
        });
    }
}

export const audioCoach = new AudioCoachEngine();
