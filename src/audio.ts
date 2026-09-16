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
  | 'click'
  | 'select'
  | 'tick'
  | 'baa'
  | 'hop'
  | 'plane'
  | 'alarm'
  | 'bray'
  | 'hallelujah'
  | 'bullet'
  | 'spinup'
  | 'bat'
  | 'step'
  | 'teleport'
  | 'pickup'
  | 'heal';

/** Something in flight that should be heard for as long as it flies. */
export interface FlightSound {
  id: number;
  /** 'rocket' hisses and whistles, 'lob' only whooshes softly. */
  kind: 'rocket' | 'lob';
  vx: number;
  vy: number;
}

/** A sound that keeps playing until stopped; its parameters are updated every frame. */
interface Voice {
  gain: GainNode;
  filter: BiquadFilterNode | null;
  osc: OscillatorNode | null;
  sources: AudioScheduledSourceNode[];
}

const MAX_FLIGHT_VOICES = 6;
/** Master gain before the limiter (was 0.55). */
const MASTER_VOLUME = 1.1;

const MUTE_KEY = 'allium.muted';

/** Tiny synthesizer: every sound effect is generated with Web Audio, no asset files. */
export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private chargeVoice: Voice | null = null;
  private torchVoice: Voice | null = null;
  private readonly flightVoices = new Map<number, Voice>();
  /** How often each sound effect was played (for tests). */
  readonly played: Partial<Record<Sfx, number>> = {};
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
      this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
      // Everything is louder than before; a compressor keeps big explosions from clipping.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.knee.value = 6;
      limiter.ratio.value = 8;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.2;
      this.master.connect(limiter);
      limiter.connect(ctx.destination);
      const length = ctx.sampleRate;
      this.noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
    if (this.muted) this.silence();
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // ignore
    }
    return this.muted;
  }

  play(sfx: Sfx, intensity = 1): void {
    if (!this.ctx || this.muted) return;
    this.played[sfx] = (this.played[sfx] ?? 0) + 1;
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
        // A little "hup!": a quick rising voice blip plus a puff of air.
        this.tone('triangle', 300 * pitch, 620 * pitch, 0.13, 0.2);
        this.tone('sine', 620 * pitch, 900 * pitch, 0.1, 0.1, 0.05);
        this.noise(0.18, 'bandpass', 900, 2600, 0.12);
        break;
      case 'land':
        this.noise(0.12, 'lowpass', 700, 120, 0.35 * i);
        this.tone('sine', 150 * pitch, 55, 0.14, 0.28 * i);
        break;
      case 'bullet':
        this.noise(0.07, 'highpass', 3200, 900, 0.38);
        this.tone('square', 150 * pitch, 60, 0.05, 0.1);
        break;
      case 'spinup':
        this.tone('sawtooth', 80, 420, 0.3, 0.06);
        break;
      case 'hallelujah':
        this.choir();
        break;
      case 'bray':
        // Hee-haw: alternating high and low nasal tones.
        [0, 0.34, 0.68].forEach((d, k) => {
          this.tone('sawtooth', (k % 2 ? 260 : 560) * pitch, (k % 2 ? 220 : 480) * pitch, 0.3, 0.1, d);
          this.tone('square', (k % 2 ? 130 : 280) * pitch, (k % 2 ? 110 : 240) * pitch, 0.3, 0.04, d);
        });
        break;
      case 'alarm':
        // Frantic rising siren right before the bang.
        [0, 0.09, 0.18].forEach((d) => this.tone('square', 700 * pitch, 1400 * pitch, 0.08, 0.1, d));
        this.tone('sawtooth', 90, 40, 0.9, 0.25);
        break;
      case 'bat':
        // Wooden crack: a sharp click, a hollow knock and a swish.
        this.noise(0.06, 'highpass', 4000, 1800, 0.5);
        this.tone('triangle', 520 * pitch, 300, 0.1, 0.35);
        this.tone('sine', 1250 * pitch, 900, 0.05, 0.12);
        this.noise(0.25, 'bandpass', 2400, 600, 0.12);
        break;
      case 'step':
        // Soft papery patter of a garlic clove's feet.
        this.noise(0.05, 'bandpass', 1500 * pitch, 700, 0.22);
        this.tone('sine', 210 * pitch, 150, 0.05, 0.09);
        break;
      case 'bounce':
        // A clunk you can hear: thud body plus a metallic tick, both scaled by the impact.
        this.noise(0.09, 'lowpass', 1800, 250, 0.45 * i);
        this.tone('triangle', 330 * pitch, 140, 0.12, 0.3 * i);
        this.tone('square', 1250 * pitch, 900, 0.04, 0.05 * i);
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
      case 'select':
        this.tone('square', 440, 440, 0.04, 0.05);
        this.tone('triangle', 880, 1320, 0.08, 0.1, 0.04);
        break;
      case 'tick':
        this.tone('square', 1500, 1500, 0.035, 0.12);
        break;
      case 'baa':
        this.bleat(pitch);
        break;
      case 'plane':
        this.planeFlyby();
        break;
      case 'teleport':
        // Bright shimmering sweep, loud enough to notice a crate arriving anywhere on the map.
        [880, 1320, 1760, 2640, 3520].forEach((f, k) => this.tone('sine', f, f * 1.5, 0.16, 0.16, k * 0.05));
        this.tone('triangle', 220, 880, 0.35, 0.18);
        this.noise(0.45, 'highpass', 2500, 7000, 0.14);
        break;
      case 'pickup':
        [523, 784, 1047].forEach((f, k) => this.tone('square', f, f, 0.09, 0.06, k * 0.07));
        break;
      case 'heal':
        [392, 523, 659, 784].forEach((f, k) => this.tone('triangle', f, f * 1.02, 0.3, 0.12, k * 0.08));
        break;
      case 'hop':
        this.tone('sine', 260 * pitch, 520 * pitch, 0.07, 0.1);
        break;
    }
  }

  /**
   * Charge whoosh: plays while `level` (0..1) is not null, rising in pitch and loudness.
   * Call every frame; null stops it.
   */
  setCharge(level: number | null): void {
    if (level === null || !this.ctx || this.muted) {
      this.stopVoice(this.chargeVoice);
      this.chargeVoice = null;
      return;
    }
    this.chargeVoice ??= this.startVoice('bandpass', 'sawtooth');
    const v = this.chargeVoice;
    const t = this.ctx.currentTime;
    v.filter!.frequency.setTargetAtTime(350 + level * level * 2600, t, 0.03);
    v.filter!.Q.setTargetAtTime(1.2 + level * 3, t, 0.05);
    v.osc!.frequency.setTargetAtTime(70 + level * 170, t, 0.03);
    v.gain.gain.setTargetAtTime(0.06 + level * 0.3, t, 0.03);
  }

  /** Roaring blowtorch while `on`. */
  setTorch(on: boolean): void {
    if (!on || !this.ctx || this.muted) {
      this.stopVoice(this.torchVoice);
      this.torchVoice = null;
      return;
    }
    if (this.torchVoice) return;
    const v = this.startVoice('bandpass', 'sawtooth');
    const t = this.ctx.currentTime;
    v.filter!.frequency.setValueAtTime(1600, t);
    v.filter!.Q.setValueAtTime(0.6, t);
    v.osc!.frequency.setValueAtTime(55, t);
    v.gain.gain.setTargetAtTime(0.3, t, 0.08);
    this.torchVoice = v;
  }

  /** Keep one flight voice per airborne projectile; call every frame with what is flying. */
  setFlights(flights: readonly FlightSound[]): void {
    const live = new Set<number>();
    if (this.ctx && !this.muted) {
      for (const f of flights.slice(0, MAX_FLIGHT_VOICES)) {
        live.add(f.id);
        let v = this.flightVoices.get(f.id);
        if (!v) {
          v = f.kind === 'rocket' ? this.startVoice('bandpass', 'sine') : this.startVoice('bandpass', null);
          this.flightVoices.set(f.id, v);
        }
        const speed = Math.hypot(f.vx, f.vy);
        const t = this.ctx.currentTime;
        if (f.kind === 'rocket') {
          // Whistle drops in pitch while falling, like a cartoon bomb.
          v.osc!.frequency.setTargetAtTime(Math.max(380, 1100 + f.vy * 22), t, 0.05);
          v.filter!.frequency.setTargetAtTime(900 + speed * 45, t, 0.05);
          v.gain.gain.setTargetAtTime(0.08 + Math.min(speed, 40) * 0.006, t, 0.05);
        } else {
          v.filter!.frequency.setTargetAtTime(250 + speed * 40, t, 0.05);
          v.gain.gain.setTargetAtTime(Math.min(speed, 30) * 0.009, t, 0.05);
        }
      }
    }
    for (const [id, v] of this.flightVoices) {
      if (live.has(id)) continue;
      this.stopVoice(v);
      this.flightVoices.delete(id);
    }
  }

  /** Continuous sounds currently playing (for tests). */
  get voices(): { charge: boolean; torch: boolean; flights: number; played: Partial<Record<Sfx, number>> } {
    return { charge: this.chargeVoice !== null, torch: this.torchVoice !== null, flights: this.flightVoices.size, played: { ...this.played } };
  }

  /** Stop every continuous sound (pause, mute, match change). */
  silence(): void {
    this.setCharge(null);
    this.setTorch(false);
    this.setFlights([]);
  }

  /** A swelling "Ha-le-lu-jah!" choir chord: detuned voices through a vowel filter with vibrato. */
  private choir(): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const syllables = [0, 0.3, 0.55, 0.8];
    const chords = [
      [440, 554, 659],
      [440, 554, 659],
      [494, 587, 740],
      [554, 659, 880],
    ];
    syllables.forEach((start, k) => {
      const length = k === syllables.length - 1 ? 0.9 : 0.26;
      for (const f of chords[k]) {
        for (const detune of [-6, 6]) {
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.value = f;
          osc.detune.value = detune;
          const vib = ctx.createOscillator();
          vib.frequency.value = 5.5;
          const vibDepth = ctx.createGain();
          vibDepth.gain.value = 5;
          vib.connect(vibDepth);
          vibDepth.connect(osc.frequency);
          const vowel = ctx.createBiquadFilter();
          vowel.type = 'bandpass';
          vowel.frequency.value = k === 1 ? 1300 : 900;
          vowel.Q.value = 3;
          osc.connect(vowel);
          vowel.connect(this.envelope(0.05, length, start));
          osc.start(t0 + start);
          vib.start(t0 + start);
          osc.stop(t0 + start + length + 0.05);
          vib.stop(t0 + start + length + 0.05);
        }
      }
    });
  }

  /** Propeller plane passing overhead: a buzzing drone that swells, then drops in pitch as it leaves. */
  private planeFlyby(): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const duration = 4.2;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(0.35, t0 + 1.8);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    out.connect(this.master!);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, t0);
    filter.frequency.linearRampToValueAtTime(1400, t0 + 1.8);
    filter.frequency.linearRampToValueAtTime(400, t0 + duration);
    filter.connect(out);
    const engine = ctx.createOscillator();
    engine.type = 'sawtooth';
    engine.frequency.setValueAtTime(118, t0);
    engine.frequency.setValueAtTime(118, t0 + 1.7);
    engine.frequency.exponentialRampToValueAtTime(84, t0 + 2.6);
    // Propeller flutter: amplitude modulation at a few dozen hertz.
    const flutter = ctx.createGain();
    flutter.gain.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 23;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.4;
    lfo.connect(lfoDepth);
    lfoDepth.connect(flutter.gain);
    engine.connect(flutter);
    flutter.connect(filter);
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.35;
    noise.connect(noiseGain);
    noiseGain.connect(filter);
    for (const node of [engine, lfo, noise]) {
      node.start(t0);
      node.stop(t0 + duration + 0.1);
    }
  }

  /** Nasal, wobbling "baa": a sawtooth through a vowel-like bandpass with fast vibrato. */
  private bleat(pitch: number): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420 * pitch, t0);
    osc.frequency.exponentialRampToValueAtTime(330 * pitch, t0 + 0.6);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 26;
    const depth = ctx.createGain();
    depth.gain.value = 18;
    lfo.connect(depth);
    depth.connect(osc.frequency);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1100;
    filter.Q.value = 2.5;
    osc.connect(filter);
    filter.connect(this.envelope(0.3, 0.65, 0));
    osc.start(t0);
    lfo.start(t0);
    osc.stop(t0 + 0.7);
    lfo.stop(t0 + 0.7);
  }

  /** Filtered looping noise, optionally mixed with an oscillator, starting silent. */
  private startVoice(filterType: BiquadFilterType, oscType: OscillatorType | null): Voice {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(this.master!);
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.connect(gain);
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;
    noise.connect(filter);
    noise.start(ctx.currentTime, Math.random() * 0.5);
    const sources: AudioScheduledSourceNode[] = [noise];
    let osc: OscillatorNode | null = null;
    if (oscType) {
      osc = ctx.createOscillator();
      osc.type = oscType;
      const oscGain = ctx.createGain();
      oscGain.gain.value = oscType === 'sine' ? 0.5 : 0.12;
      osc.connect(oscGain);
      oscGain.connect(gain);
      osc.start();
      sources.push(osc);
    }
    return { gain, filter, osc, sources };
  }

  private stopVoice(v: Voice | null): void {
    if (!v || !this.ctx) return;
    const t = this.ctx.currentTime;
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setTargetAtTime(0.0001, t, 0.04);
    for (const s of v.sources) s.stop(t + 0.3);
    setTimeout(() => v.gain.disconnect(), 400);
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
