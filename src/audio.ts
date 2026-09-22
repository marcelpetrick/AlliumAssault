// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

export type Sfx =
  | 'explosion'
  | 'flap'
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
  | 'thud'
  | 'ignite'
  | 'yelp'
  | 'bray'
  | 'hallelujah'
  | 'bullet'
  | 'spinup'
  | 'bat'
  | 'homerun'
  | 'step'
  | 'teleport'
  | 'pickup'
  | 'heal'
  | 'clunk'
  | 'armed'
  | 'beep'
  | 'hookShot'
  | 'hookBite'
  | 'reel'
  | 'throw'
  | 'pop'
  | 'build'
  | 'warp'
  | 'torchLight'
  | 'siren';

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
  filter: BiquadFilterNode;
  osc: OscillatorNode | null;
  sources: AudioScheduledSourceNode[];
}

/** A voice with an oscillator mixed into its noise. */
interface ToneVoice extends Voice {
  osc: OscillatorNode;
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
  private chargeVoice: ToneVoice | null = null;
  private fireVoice: Voice | null = null;
  private toolVoice: { tool: 'torch' | 'drill'; voice: ToneVoice } | null = null;
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
      case 'throw':
        // An arm swung hard: a short airy whoosh with a soft grunt under it, and no launch roar.
        this.noise(0.22, 'bandpass', 500, 1700, 0.3);
        this.tone('sine', 260 * pitch, 150 * pitch, 0.16, 0.14);
        this.tone('triangle', 520 * pitch, 380 * pitch, 0.1, 0.05, 0.04);
        break;
      case 'pop':
        // A small charge going off: the big explosion in miniature, not a shotgun blast.
        this.noise(0.28 * i + 0.1, 'lowpass', 1800, 240, 0.5 * i);
        this.tone('sine', 190 * pitch, 70, 0.18, 0.35 * i);
        break;
      case 'flap':
        // A bedsheet on a stick, shaken twice: two airy flaps and nothing else. No bang, no boom.
        this.noise(0.16, 'bandpass', 900, 1500, 0.22);
        this.noise(0.14, 'bandpass', 700, 1200, 0.18, 0.18);
        this.tone('sine', 180 * pitch, 150 * pitch, 0.12, 0.05, 0.05);
        break;
      case 'build':
        // Planks dropped and knocked into place: two wooden knocks and a short ring.
        this.tone('triangle', 240 * pitch, 150, 0.12, 0.28);
        this.noise(0.08, 'bandpass', 1200, 500, 0.25);
        this.tone('triangle', 300 * pitch, 190, 0.1, 0.22, 0.11);
        this.tone('sine', 900 * pitch, 640, 0.14, 0.07, 0.12);
        break;
      case 'warp':
        // A buddy folded away and unfolded elsewhere: a swoop down, a pop, a swoop back up.
        this.tone('sine', 1200 * pitch, 180, 0.22, 0.16);
        this.tone('sine', 220, 1500 * pitch, 0.26, 0.16, 0.2);
        this.tone('square', 60, 40, 0.1, 0.06, 0.18);
        this.noise(0.35, 'bandpass', 2200, 5200, 0.12, 0.16);
        break;
      case 'torchLight':
        // Gas catching at the nozzle: a click, then a soft rush that the running torch takes over.
        this.tone('square', 1400, 900, 0.03, 0.1);
        this.noise(0.28, 'bandpass', 700, 2200, 0.22, 0.03);
        break;
      case 'siren':
        // Sudden Death: a slow two-tone warning, deeper and longer than the self-destruct alarm.
        [0, 0.55, 1.1].forEach((d) => {
          this.tone('sawtooth', 320, 460, 0.28, 0.16, d);
          this.tone('sawtooth', 460, 320, 0.26, 0.14, d + 0.27);
        });
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
      case 'ignite':
        // Whoomph of napalm catching: low thump and a rushing burst of air.
        this.noise(0.6, 'lowpass', 2400, 300, 0.7);
        this.tone('sine', 120 * pitch, 50, 0.4, 0.4);
        break;
      case 'yelp':
        // "Hot hot hot!": quick squeaky rising hop.
        this.tone('square', 600 * pitch, 1300 * pitch, 0.12, 0.12);
        this.tone('triangle', 900 * pitch, 1600 * pitch, 0.1, 0.1, 0.09);
        break;
      case 'thud':
        // Stone slab plonking down, with a sad little trombone slide.
        this.noise(0.12, 'lowpass', 600, 120, 0.4);
        this.tone('sine', 110, 60, 0.2, 0.35);
        [0, 0.28, 0.56].forEach((d, k) => {
          this.tone('sawtooth', 311 - k * 18, 294 - k * 18, 0.26, 0.05, 0.25 + d);
        });
        break;
      case 'alarm':
        // Frantic rising siren right before the bang.
        [0, 0.09, 0.18].forEach((d) => {
          this.tone('square', 700 * pitch, 1400 * pitch, 0.08, 0.1, d);
        });
        this.tone('sawtooth', 90, 40, 0.9, 0.25);
        break;
      case 'bat':
        // Wooden crack: a sharp click, a hollow knock and a swish.
        this.noise(0.06, 'highpass', 4000, 1800, 0.5);
        this.tone('triangle', 520 * pitch, 300, 0.1, 0.35);
        this.tone('sine', 1250 * pitch, 900, 0.05, 0.12);
        this.noise(0.25, 'bandpass', 2400, 600, 0.12);
        break;
      case 'homerun':
        // That one goes all the way: a stadium's worth of noise swelling behind the crack. Filtered
        // noise rising and falling is what a crowd is, and a couple of whistles ride on top of it.
        this.noise(1.9, 'bandpass', 900, 1500, 0.3, 0.35);
        this.noise(1.6, 'highpass', 2200, 3000, 0.12, 0.5);
        [0.35, 0.62, 0.95].forEach((d) => {
          this.tone('sine', 2100 * pitch, 2600 * pitch, 0.18, 0.05, d);
        });
        this.tone('triangle', 180, 120, 0.7, 0.07, 0.2);
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
        [523, 659, 784, 1047].forEach((f, k) => {
          this.tone('triangle', f, f, 0.22, 0.2, k * 0.14);
        });
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
        [880, 1320, 1760, 2640, 3520].forEach((f, k) => {
          this.tone('sine', f, f * 1.5, 0.16, 0.16, k * 0.05);
        });
        this.tone('triangle', 220, 880, 0.35, 0.18);
        this.noise(0.45, 'highpass', 2500, 7000, 0.14);
        break;
      case 'clunk':
        // Heavy metal disc set down on rock.
        this.tone('sine', 150, 70, 0.14, 0.2);
        this.noise(0.1, 'lowpass', 900, 300, 0.12);
        break;
      case 'armed':
        // Two rising clicks: the mine is live now.
        [1400, 2100].forEach((f, k) => {
          this.tone('square', f, f, 0.04, 0.07, k * 0.09);
        });
        break;
      case 'beep':
        // The warning while a triggered mine counts down.
        this.tone('square', 2600, 2600, 0.06, 0.09);
        break;
      case 'hookShot':
        // Compressed air, then the rope paying out.
        this.noise(0.18, 'highpass', 1800, 700, 0.1);
        this.tone('sawtooth', 320, 120, 0.16, 0.05);
        break;
      case 'hookBite':
        // Metal biting rock.
        this.tone('square', 900, 260, 0.08, 0.09);
        this.noise(0.12, 'bandpass', 1400, 500, 0.1);
        break;
      case 'reel':
        this.tone('square', 640, 720, 0.04, 0.04);
        break;
      case 'pickup':
        [523, 784, 1047].forEach((f, k) => {
          this.tone('square', f, f, 0.09, 0.06, k * 0.07);
        });
        break;
      case 'heal':
        [392, 523, 659, 784].forEach((f, k) => {
          this.tone('triangle', f, f * 1.02, 0.3, 0.12, k * 0.08);
        });
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
    v.filter.frequency.setTargetAtTime(350 + level * level * 2600, t, 0.03);
    v.filter.Q.setTargetAtTime(1.2 + level * 3, t, 0.05);
    v.osc.frequency.setTargetAtTime(70 + level * 170, t, 0.03);
    v.gain.gain.setTargetAtTime(0.06 + level * 0.3, t, 0.03);
  }

  /** Crackling fire whose loudness follows the number of burning flames; 0 stops it. */
  setFire(flames: number): void {
    if (flames <= 0 || !this.ctx || this.muted) {
      this.stopVoice(this.fireVoice);
      this.fireVoice = null;
      return;
    }
    this.fireVoice ??= this.startVoice('bandpass', null);
    const t = this.ctx.currentTime;
    // Random flutter on the filter makes the noise crackle.
    this.fireVoice.filter.frequency.setTargetAtTime(700 + Math.random() * 1600, t, 0.02);
    this.fireVoice.gain.gain.setTargetAtTime(Math.min(0.12 + flames * 0.025, 0.55) * (0.7 + Math.random() * 0.3), t, 0.03);
  }

  /** Roaring blowtorch or grinding drill while that tool is in use; null stops it. */
  setTool(tool: 'torch' | 'drill' | null): void {
    if (this.toolVoice && this.toolVoice.tool !== tool) {
      this.stopVoice(this.toolVoice.voice);
      this.toolVoice = null;
    }
    if (!tool || !this.ctx || this.muted || this.toolVoice) return;
    const drill = tool === 'drill';
    const v = this.startVoice(drill ? 'lowpass' : 'bandpass', drill ? 'square' : 'sawtooth');
    const t = this.ctx.currentTime;
    v.filter.frequency.setValueAtTime(drill ? 900 : 1600, t);
    v.filter.Q.setValueAtTime(drill ? 4 : 0.6, t);
    v.osc.frequency.setValueAtTime(drill ? 38 : 55, t);
    v.gain.gain.setTargetAtTime(drill ? 0.35 : 0.3, t, 0.08);
    this.toolVoice = { tool, voice: v };
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
          v.osc?.frequency.setTargetAtTime(Math.max(380, 1100 + f.vy * 22), t, 0.05);
          v.filter.frequency.setTargetAtTime(900 + speed * 45, t, 0.05);
          v.gain.gain.setTargetAtTime(0.08 + Math.min(speed, 40) * 0.006, t, 0.05);
        } else {
          v.filter.frequency.setTargetAtTime(250 + speed * 40, t, 0.05);
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
  get voices(): { charge: boolean; torch: boolean; drill: boolean; fire: boolean; flights: number; played: Partial<Record<Sfx, number>> } {
    return {
      charge: this.chargeVoice !== null,
      torch: this.toolVoice?.tool === 'torch',
      drill: this.toolVoice?.tool === 'drill',
      fire: this.fireVoice !== null,
      flights: this.flightVoices.size,
      played: { ...this.played },
    };
  }

  /** Stop every continuous sound (pause, mute, match change). */
  silence(): void {
    this.setCharge(null);
    this.setTool(null);
    this.setFire(0);
    this.setFlights([]);
  }

  /** A swelling "Ha-le-lu-jah!" choir chord: detuned voices through a vowel filter with vibrato. */
  private choir(): void {
    const { ctx } = this.engine;
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
    const { ctx } = this.engine;
    const t0 = ctx.currentTime;
    const duration = 4.2;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(0.35, t0 + 1.8);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    out.connect(this.engine.master);
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
    const { ctx } = this.engine;
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

  /** Audio graph handles; only valid after unlock(), which every caller checks first. */
  private get engine(): { ctx: AudioContext; master: GainNode; noise: AudioBuffer } {
    if (!this.ctx || !this.master || !this.noiseBuffer) throw new Error('Audio used before unlock()');
    return { ctx: this.ctx, master: this.master, noise: this.noiseBuffer };
  }

  /** Filtered looping noise, optionally mixed with an oscillator, starting silent. */
  private startVoice(filterType: BiquadFilterType, oscType: OscillatorType): ToneVoice;
  private startVoice(filterType: BiquadFilterType, oscType: null): Voice;
  private startVoice(filterType: BiquadFilterType, oscType: OscillatorType | null): Voice {
    const { ctx } = this.engine;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(this.engine.master);
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
    setTimeout(() => {
      v.gain.disconnect();
    }, 400);
  }

  private envelope(gain: number, duration: number, delay: number): GainNode {
    const { ctx } = this.engine;
    const g = ctx.createGain();
    const t0 = ctx.currentTime + delay;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    g.connect(this.engine.master);
    return g;
  }

  private tone(type: OscillatorType, from: number, to: number, duration: number, gain: number, delay = 0): void {
    const { ctx } = this.engine;
    const osc = ctx.createOscillator();
    const t0 = ctx.currentTime + delay;
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t0 + duration);
    osc.connect(this.envelope(gain, duration, delay));
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  private noise(duration: number, type: BiquadFilterType, from: number, to: number, gain: number, delay = 0): void {
    const { ctx } = this.engine;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    const t0 = ctx.currentTime + delay;
    filter.type = type;
    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t0 + duration);
    src.connect(filter);
    filter.connect(this.envelope(gain, duration, delay));
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + duration + 0.05);
  }
}
