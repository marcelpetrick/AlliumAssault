export type Sfx =
  | 'explosion'
  | 'fire'
  | 'shot'
  | 'punch'
  | 'jump'
  | 'land'
  | 'bounce'
  | 'splash'
  | 'turn'
  | 'hurt'
  | 'death'
  | 'victory'
  | 'click';

const MUTE_KEY = 'allium.muted';

/** Tiny synthesizer: every sound effect is generated with Web Audio, no asset files. */
export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  muted: boolean;

  constructor() {
    let stored = false;
    try {
      stored = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      // storage unavailable: keep default
    }
    this.muted = stored;
  }

  /** Browsers only allow audio after a user gesture. */
  unlock(): void {
    if (!this.ctx) {
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(ctx.destination);
      const length = ctx.sampleRate;
      this.noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // ignore
    }
    return this.muted;
  }

  play(sfx: Sfx, intensity = 1): void {
    if (!this.ctx || this.muted) return;
    const i = Math.min(Math.max(intensity, 0.2), 1.5);
    const pitch = 0.9 + Math.random() * 0.2;
    switch (sfx) {
      case 'explosion':
        this.noise(0.9 * i + 0.2, 'lowpass', 1400, 70, 0.9 * i);
        this.tone('sine', 95 * pitch, 30, 0.6, 0.7 * i);
        break;
      case 'fire':
        this.noise(0.35, 'bandpass', 700, 2600, 0.35);
        this.tone('sawtooth', 190 * pitch, 80, 0.25, 0.08);
        break;
      case 'shot':
        this.noise(0.2, 'highpass', 2500, 500, 0.55);
        this.tone('square', 130, 45, 0.12, 0.15);
        break;
      case 'punch':
        this.noise(0.14, 'lowpass', 900, 150, 0.7);
        this.tone('sine', 220 * pitch, 70, 0.18, 0.45);
        break;
      case 'jump':
        this.tone('sine', 320 * pitch, 760 * pitch, 0.18, 0.22);
        break;
      case 'land':
        this.tone('sine', 150 * pitch, 55, 0.12, 0.25 * i);
        break;
      case 'bounce':
        this.tone('triangle', 520 * pitch, 300, 0.07, 0.14);
        break;
      case 'splash':
        this.noise(0.7, 'bandpass', 1600, 350, 0.45);
        break;
      case 'turn':
        this.tone('sine', 660, 660, 0.12, 0.18);
        this.tone('sine', 990, 990, 0.2, 0.16, 0.11);
        break;
      case 'hurt':
        this.tone('square', 760 * pitch, 340 * pitch, 0.22, 0.09);
        break;
      case 'death':
        this.tone('sawtooth', 420, 90, 0.55, 0.12);
        break;
      case 'victory':
        [523, 659, 784, 1047].forEach((f, k) => this.tone('triangle', f, f, 0.22, 0.2, k * 0.14));
        break;
      case 'click':
        this.tone('triangle', 900, 1150, 0.05, 0.08);
        break;
    }
  }

  private envelope(gain: number, duration: number, delay: number): GainNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const t0 = ctx.currentTime + delay;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    g.connect(this.master!);
    return g;
  }

  private tone(type: OscillatorType, from: number, to: number, duration: number, gain: number, delay = 0): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const t0 = ctx.currentTime + delay;
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t0 + duration);
    osc.connect(this.envelope(gain, duration, delay));
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  private noise(duration: number, type: BiquadFilterType, from: number, to: number, gain: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    const t0 = ctx.currentTime;
    filter.type = type;
    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t0 + duration);
    src.connect(filter);
    filter.connect(this.envelope(gain, duration, 0));
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + duration + 0.05);
  }
}
