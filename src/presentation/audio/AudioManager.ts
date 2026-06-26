import Phaser from 'phaser';

// Synthesizes all game sounds procedurally via the Web Audio API.
// No asset files required for sounds — every effect is generated from
// oscillators and noise, keeping the bundle tiny while still providing
// satisfying audio feedback.

export class AudioManager {
  private readonly scene: Phaser.Scene;
  private ctx: AudioContext | null = null;
  private musicVolume = 0.7;
  private sfxVolume = 1.0;
  private voiceVolume = 1.0;
  private walkCooldown = 0;
  private musicOsc?: OscillatorNode;
  private musicGain?: GainNode;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // Must be called after a user gesture (browser audio policy)
  init(): void {
    if (this.ctx) return;
    // Access via Phaser's managed sound context
    const soundManager = this.scene.sound;
    if ('context' in soundManager && soundManager.context instanceof AudioContext) {
      this.ctx = soundManager.context;
    } else {
      this.ctx = new AudioContext();
    }
    this.startAmbienceLoop();
  }

  setMusicVolume(v: number): void {
    this.musicVolume = v;
    if (this.musicGain) this.musicGain.gain.value = v * 0.15;
  }

  setSfxVolume(v: number): void {
    this.sfxVolume = v;
  }

  setVoiceVolume(v: number): void {
    this.voiceVolume = v;
  }

  playExplosion(size: 'small' | 'medium' | 'large'): void {
    if (!this.ctx) return;
    const duration = size === 'small' ? 0.25 : size === 'medium' ? 0.45 : 0.7;
    const freq = size === 'small' ? 120 : size === 'medium' ? 80 : 50;
    this.playNoiseBurst(freq, duration, this.sfxVolume * 0.8);
  }

  playWalk(): void {
    if (!this.ctx || this.walkCooldown > 0) return;
    this.walkCooldown = 0.18;
    this.playTone(180 + Math.random() * 40, 0.04, this.sfxVolume * 0.15);
  }

  playJump(): void {
    if (!this.ctx) return;
    this.playToneRamp(250, 420, 0.12, this.sfxVolume * 0.3);
  }

  playLand(): void {
    if (!this.ctx) return;
    this.playToneRamp(180, 80, 0.1, this.sfxVolume * 0.35);
  }

  playWeaponFire(weaponId: string): void {
    if (!this.ctx) return;
    switch (weaponId) {
      case 'bazooka':
        this.playNoiseBurst(200, 0.12, this.sfxVolume * 0.5);
        this.playToneRamp(600, 80, 0.15, this.sfxVolume * 0.35);
        break;
      case 'impact_clove':
      case 'classic_grenade':
        this.playToneRamp(400, 100, 0.1, this.sfxVolume * 0.4);
        break;
      case 'garlic_uppercut':
        this.playNoiseBurst(150, 0.08, this.sfxVolume * 0.6);
        this.playTone(300, 0.08, this.sfxVolume * 0.5);
        break;
      default:
        this.playTone(440, 0.08, this.sfxVolume * 0.3);
    }
  }

  playHurt(): void {
    if (!this.ctx) return;
    // Cute garlic squeak
    this.playToneRamp(500, 300, 0.12, this.sfxVolume * 0.4);
    this.playToneRamp(650, 400, 0.08, this.sfxVolume * 0.3);
  }

  playDeath(): void {
    if (!this.ctx) return;
    // Descending wail
    this.playToneRamp(400, 80, 0.5, this.sfxVolume * 0.45);
    this.playExplosion('small');
  }

  playTurnStart(): void {
    if (!this.ctx) return;
    // Ascending three-note chime
    [0, 0.1, 0.22].forEach((delay, i) => {
      const freqs = [440, 550, 660];
      const f = freqs[i] ?? 440;
      this.playToneDelayed(f, 0.12, this.sfxVolume * 0.3, delay);
    });
  }

  playVictory(): void {
    if (!this.ctx) return;
    [0, 0.12, 0.24, 0.36, 0.5].forEach((delay, i) => {
      const freqs = [440, 550, 660, 550, 880];
      const f = freqs[i] ?? 440;
      this.playToneDelayed(f, 0.18, this.sfxVolume * 0.4, delay);
    });
  }

  tickWalkCooldown(dt: number): void {
    if (this.walkCooldown > 0) this.walkCooldown -= dt;
  }

  destroy(): void {
    if (this.musicOsc) {
      try {
        this.musicOsc.stop();
      } catch {
        /* already stopped */
      }
    }
  }

  // ── Synthesis helpers ─────────────────────────────────────────────────────

  private playTone(freq: number, duration: number, volume: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = 'square';
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.05);
  }

  private playToneRamp(startFreq: number, endFreq: number, duration: number, volume: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);
    osc.type = 'sawtooth';
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.05);
  }

  private playToneDelayed(freq: number, duration: number, volume: number, delayS: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = 'sine';
    const start = ctx.currentTime + delayS;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(start + duration + 0.05);
  }

  private playNoiseBurst(cutoffFreq: number, duration: number, volume: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoffFreq;

    const gain = ctx.createGain();
    gain.gain.value = volume;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }

  // Very subtle low-frequency drone for ambience
  private startAmbienceLoop(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 55;
    osc.type = 'sine';
    gain.gain.value = this.musicVolume * 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    this.musicOsc = osc;
    this.musicGain = gain;
  }
}
