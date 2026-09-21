// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import { Engine } from '@babylonjs/core/Engines/engine';
import pkg from '../package.json';
import { Audio, type FlightSound } from './audio';
import { FLYER_SPEED } from './core/flyer';
import { Game, MAP_WEAPONS, type GameEvent, type MatchConfig } from './core/game';
import { LETTER_KEYS, weaponForKey, WEAPONS } from './core/weapons';
import { THEMES } from './render/themes';
import type { Quality } from './render/quality';
import { World } from './render/world';
import { Hud } from './ui/hud';
import { Menu } from './ui/menu';
import { demoMatch, randomSeed } from './ui/presets';

const STEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 8;
/**
 * Frames per second the render loop draws. The simulation always runs at a fixed 60 Hz, so drawing
 * faster than this on a 120 or 144 Hz display costs two to three times the GPU work for frames that
 * show the same state. While a menu is open nothing moves at all, so the scene is redrawn rarely.
 */
const TARGET_FPS = 60;
const PAUSED_FPS = 20;
/**
 * Ceilings on the drawing buffer, per graphics setting: total pixels, and how far the device pixel
 * ratio is followed. A maximised window on a HiDPI screen would otherwise be drawn at several times
 * these numbers. Full is deliberately generous — the game is meant to look right on a desktop even
 * where that costs frames — while Low keeps a weak GPU playable.
 */
const MAX_RENDER_PIXELS = { high: 8_300_000, low: 2_100_000 };
const MAX_DENSITY = { high: 2, low: 1 };
/** Pointer travel in pixels below which a press counts as a click rather than a drag. */
const CLICK_SLOP = 6;
/** Distance walked between two footstep sounds. */
const STEP_LENGTH = 0.55;
const GAME_KEYS = ['Space', 'Tab', 'Backspace', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

/** Owns the engine, the current match, input, audio and all overlay UI. */
export class App {
  readonly engine: Engine;
  readonly audio = new Audio();
  readonly hud: Hud;
  readonly menu: Menu;
  game: Game | null = null;
  world: World | null = null;
  demo = true;
  paused = false;
  /** Simulation time scale; tests may raise it. */
  speed = 1;
  /** When true the render loop idles and frames only advance via stepFrames(). */
  manual = false;
  frames = 0;
  private accumulator = 0;
  private readonly keys = new Set<string>();
  private config: MatchConfig | null = null;
  private drag: { x: number; y: number; moved: number } | null = null;
  private afterGameOver = -1;
  /** The last air strike called, so tests can check which way the plane came in. */
  private lastStrike: { dir: 1 | -1; target: number; startX: number } | null = null;
  /** Last whole second announced by the turn-timer tick. */
  private lastTick = 0;
  /** Where the walking buddy last made a footstep sound. */
  private lastStep: { buddy: number; x: number } | null = null;
  /** 'low' when the URL forces it; otherwise whatever the menu's Graphics setting says. */
  private readonly forcedLowQuality: boolean;
  /** performance.now() of the last drawn frame, for the frame-rate cap. */
  private lastFrame = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    uiRoot: HTMLElement,
  ) {
    this.forcedLowQuality = new URLSearchParams(location.search).get('quality') === 'low';
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, antialias: true, powerPreference: 'high-performance' }, true);

    this.hud = new Hud(
      uiRoot,
      (id) => {
        if (this.game && !this.demo && !this.paused && this.game.isHumanTurn) this.game.selectWeapon(id);
        this.canvas.focus();
      },
      (screen) => {
        this.audio.unlock();
        this.audio.play('click');
        this.pause();
        if (screen === 'help') this.menu.showHelp('pause');
      },
    );
    this.menu = new Menu(uiRoot, pkg.version, {
      start: (config) => {
        this.startMatch(config);
      },
      resume: () => {
        this.resume();
      },
      restart: () => {
        if (this.config) this.startMatch(this.config);
      },
      rematch: () => {
        if (this.config) this.startMatch({ ...this.config, seed: randomSeed() });
      },
      quit: () => {
        this.showTitle();
      },
      toggleMute: () => this.audio.toggleMute(),
      isMuted: () => this.audio.muted,
      click: () => {
        this.audio.unlock();
        this.audio.play('click');
      },
    });

    this.bindInput();
    window.addEventListener('resize', () => {
      this.engine.resize();
      this.applyRenderScale();
    });
    this.showTitle();
    this.engine.runRenderLoop(() => {
      this.frame();
    });
  }

  showTitle(): void {
    this.startMatch(demoMatch(), true);
    this.applyRenderScale();
    this.menu.showTitle();
  }

  startMatch(config: MatchConfig, demo = false): void {
    this.world?.dispose();
    this.game = new Game(config);
    // The setting may have changed since the last match, so the buffer is sized again here.
    this.applyRenderScale();
    this.world = new World(this.engine, this.game, THEMES[config.theme] ?? THEMES.meadow, this.quality);
    this.hud.attach(this.game, this.world);
    this.hud.setVisible(!demo);
    this.demo = demo;
    this.paused = false;
    this.accumulator = 0;
    this.afterGameOver = -1;
    this.lastTick = 0;
    this.keys.clear();
    this.audio.silence();
    if (!demo) {
      this.config = config;
      this.menu.setDraft(config);
      this.menu.hide();
      this.canvas.focus();
    }
  }

  pause(): void {
    if (this.demo || this.paused) return;
    this.paused = true;
    this.keys.clear();
    // Held keys must not survive the pause: a rope would keep reeling on resume.
    if (this.game) Object.assign(this.game.input, { left: false, right: false, up: false, down: false });
    this.game?.cancelCharge();
    this.menu.showPause();
  }

  resume(): void {
    this.paused = false;
    this.keys.clear();
    this.menu.hide();
    this.canvas.focus();
  }

  /** Run the simulation instantly (used by tests and for skipping ahead). */
  fastForward(seconds: number): void {
    const game = this.game;
    if (!game) return;
    for (let s = 0; s < Math.round(seconds / STEP) && game.phase !== 'gameOver'; s++) {
      game.step(STEP);
      this.dispatch(game.drainEvents());
    }
  }

  /** Switch to manual stepping and advance + render `count` frames with a fixed dt (deterministic capture). */
  stepFrames(count: number, dt = 1 / 30): void {
    this.manual = true;
    for (let k = 0; k < count; k++) this.advance(dt);
  }

  /**
   * Size the drawing buffer for the chosen graphics setting: follow the device pixel ratio up to
   * MAX_DENSITY, but never draw more than MAX_RENDER_PIXELS in total, so a big window costs a big
   * window's worth of work and no more.
   */
  private applyRenderScale(): void {
    const quality = this.quality;
    const density = Math.min(window.devicePixelRatio || 1, MAX_DENSITY[quality]);
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    const pixels = width * height * density * density;
    const budget = MAX_RENDER_PIXELS[quality];
    const shrink = pixels > budget ? Math.sqrt(pixels / budget) : 1;
    this.engine.setHardwareScalingLevel(shrink / density);
  }

  private frame(): void {
    if (this.manual) return;
    const now = performance.now();
    const elapsed = now - this.lastFrame;
    // A millisecond of slack, so jitter on a display running at exactly the target rate does not
    // drop every other frame and halve the rate.
    if (elapsed < 1000 / (this.paused ? PAUSED_FPS : TARGET_FPS) - 1) return;
    this.lastFrame = now;
    this.advance(Math.min(elapsed / 1000, 0.1));
  }

  private advance(dt: number): void {
    const game = this.game;
    const world = this.world;
    if (!game || !world) return;
    if (!this.paused) {
      this.accumulator += dt * this.speed;
      let steps = 0;
      while (this.accumulator >= STEP && steps < MAX_STEPS_PER_FRAME * this.speed) {
        this.syncInput(game);
        game.step(STEP);
        this.accumulator -= STEP;
        steps++;
      }
      if (this.accumulator > STEP * 4) this.accumulator = 0;
      this.dispatch(game.drainEvents());
      world.update(dt);
    }
    this.syncSound(game);
    world.render();
    this.hud.update(this.paused ? 0 : dt);
    this.frames++;

    if (this.afterGameOver >= 0 && !this.paused) {
      this.afterGameOver -= dt;
      if (this.afterGameOver < 0) this.onGameOverDelay(game);
    }
  }

  /** Continuous sounds follow the simulation state rather than one-off events. */
  private syncSound(game: Game): void {
    if (this.demo || this.paused) {
      this.audio.silence();
      return;
    }
    this.audio.setCharge(game.charge);
    this.audio.setFire(game.flames.length);
    this.audio.setTool(game.phase === 'torching' || game.phase === 'spraying' ? 'torch' : game.phase === 'drilling' ? 'drill' : null);
    const flights: FlightSound[] = game.projectiles.map((p) => ({
      id: p.id,
      kind: WEAPONS[p.weapon].look.flight ?? 'lob',
      vx: p.vx,
      vy: p.vy,
    }));
    const f = game.flyer;
    if (f) flights.push({ id: f.id, kind: 'lob', vx: Math.cos(f.angle) * FLYER_SPEED, vy: Math.sin(f.angle) * FLYER_SPEED });
    this.audio.setFlights(flights);
    const walker = game.activeBuddy;
    if (walker?.walking && walker.body.grounded) {
      if (this.lastStep?.buddy !== walker.id) this.lastStep = { buddy: walker.id, x: walker.body.x };
      if (Math.abs(walker.body.x - this.lastStep.x) >= STEP_LENGTH) {
        this.audio.play('step');
        this.lastStep.x = walker.body.x;
      }
    } else {
      this.lastStep = null;
    }
    const second = game.countingDown ? Math.ceil(game.turnTimeLeft) : 0;
    if (second !== this.lastTick && second > 0 && second <= 5) this.audio.play('tick');
    this.lastTick = second;
  }

  private onGameOverDelay(game: Game): void {
    if (this.demo) {
      const onTitle = this.menu.screen === 'title';
      this.startMatch(demoMatch(), true);
      if (onTitle) this.menu.showTitle();
      return;
    }
    const winner = game.winner === null ? null : game.teams[game.winner].config;
    this.audio.play('victory');
    this.menu.showVictory(winner && { name: winner.name, color: winner.color }, game.turn);
  }

  private dispatch(events: GameEvent[]): void {
    if (!events.length) return;
    this.world?.handleEvents(events);
    this.hud.handleEvents(events);
    for (const e of events) {
      if (e.type === 'gameOver') this.afterGameOver = this.demo ? 4 : 2;
      if (this.demo) continue;
      switch (e.type) {
        case 'explosion':
          if (e.radius >= 1.2) this.audio.play('explosion', e.radius / 2.8);
          else if (e.radius > 0.5) this.audio.play('pop', e.radius / 2.8);
          break;
        case 'shot': {
          const { shotSound } = WEAPONS[e.weapon].look;
          if (shotSound) this.audio.play(shotSound);
          break;
        }
        case 'fire': {
          const { fireSound } = WEAPONS[e.weapon].look;
          if (fireSound) this.audio.play(fireSound);
          break;
        }
        case 'suddenDeath':
          this.audio.play('siren');
          break;
        case 'platformPlaced':
        case 'teleport': {
          const { fireSound } = WEAPONS[e.weapon].look;
          if (fireSound) this.audio.play(fireSound);
          break;
        }
        case 'panic':
          this.audio.play(e.seconds >= 3 ? 'alarm' : 'beep');
          break;
        case 'ignite':
          this.audio.play('ignite');
          break;
        case 'scorch':
          this.audio.play('yelp');
          break;
        case 'grave':
          this.audio.play('thud');
          break;
        case 'hallelujah':
          this.audio.play('hallelujah');
          break;
        case 'sheepHop':
          this.audio.play('hop');
          break;
        case 'airstrike':
          this.audio.play(e.plane ? 'plane' : 'bray');
          this.lastStrike = { dir: e.dir, target: e.target, startX: e.startX };
          break;
        case 'ropeShot':
          this.audio.play('hookShot');
          break;
        case 'ropeBite':
          this.audio.play('hookBite');
          break;
        case 'mineArmed':
          this.audio.play('armed');
          break;
        case 'mineTriggered':
          this.audio.play('beep');
          break;
        case 'crateSpawn':
          this.audio.play('teleport');
          break;
        case 'cratePickup':
          this.audio.play(e.kind === 'health' ? 'heal' : 'pickup');
          break;
        case 'punch':
          this.audio.play(WEAPONS[e.weapon].look.hitSound ?? 'punch');
          // A bat that connects sends its victim over the island, and the crowd knows it.
          if (e.hit && WEAPONS[e.weapon].look.homerun) this.audio.play('homerun');
          break;
        case 'jump':
          this.audio.play('jump');
          break;
        case 'land':
          if (e.speed > 5) this.audio.play('land', e.speed / 15);
          break;
        case 'bounce':
          this.audio.play('bounce', e.speed / 12);
          break;
        case 'weapon':
          if (this.game?.isHumanTurn) this.audio.play('select');
          break;
        case 'splash':
          this.audio.play('splash');
          break;
        case 'turnStart':
          this.audio.play('turn');
          break;
        case 'damage':
          this.audio.play('hurt');
          break;
        case 'death':
        case 'drown':
          this.audio.play('death');
          break;
      }
    }
  }

  private syncInput(game: Game): void {
    if (this.demo || !game.isHumanTurn) return;
    const k = this.keys;
    game.input.left = k.has('ArrowLeft') || k.has('KeyA');
    game.input.right = k.has('ArrowRight') || k.has('KeyD');
    game.input.up = k.has('ArrowUp') || k.has('KeyW');
    game.input.down = k.has('ArrowDown') || k.has('KeyS');
  }

  private bindInput(): void {
    window.addEventListener('keydown', (e) => {
      this.audio.unlock();
      if (e.code === 'KeyM' && !(e.target instanceof HTMLInputElement)) this.audio.toggleMute();
      if (e.code === 'Escape') {
        if (this.menu.screen === 'help' || this.menu.screen === 'about' || (this.menu.screen === 'setup' && this.demo)) this.menu.back();
        else if (this.paused && this.menu.screen === 'pause') this.resume();
        else if (!this.demo && !this.menu.screen) this.pause();
        return;
      }
      const game = this.game;
      if (this.menu.screen || !game || this.demo || this.paused) return;
      if (GAME_KEYS.includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (!game.isHumanTurn || e.repeat) return;
      switch (e.code) {
        case 'Space':
          game.pressFire();
          break;
        case 'Enter':
        case 'NumpadEnter':
          game.jump(false);
          break;
        case 'Backspace':
          game.jump(true);
          break;
        case 'Tab':
          game.cycleWeapon();
          break;
        default: {
          if (/^Digit[0-9]$/.test(e.code)) {
            const id = weaponForKey(Number(e.code.slice(5)), e.shiftKey);
            if (id) game.selectWeapon(id);
            break;
          }
          // Weapons past the twenty digit slots have a letter key of their own.
          const letter = LETTER_KEYS[e.code];
          if (letter && !e.shiftKey) game.selectWeapon(letter);
        }
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'Space' && this.game?.isHumanTurn && !this.demo) this.game.releaseFire();
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      if (!this.demo && this.game?.isHumanTurn) this.game.cancelCharge();
    });

    this.canvas.addEventListener('pointerdown', (e) => {
      this.audio.unlock();
      if (!this.demo) this.drag = { x: e.clientX, y: e.clientY, moved: 0 };
    });
    window.addEventListener('pointermove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      // Only the map weapons use the picked point, and picking builds a full ray per event.
      if (this.targetingMap()) this.world?.setPointer(e.clientX - rect.left, e.clientY - rect.top);
      else this.world?.setPointer(null);
      if (!this.drag || !this.world) return;
      this.world.pan(e.clientX - this.drag.x, e.clientY - this.drag.y);
      this.drag = { x: e.clientX, y: e.clientY, moved: this.drag.moved + Math.hypot(e.clientX - this.drag.x, e.clientY - this.drag.y) };
    });
    window.addEventListener('pointerup', (e) => {
      // A left click (not a drag) on the map fires the selected map weapon.
      if (e.button === 0 && this.drag && this.drag.moved < CLICK_SLOP && e.target === this.canvas) {
        const rect = this.canvas.getBoundingClientRect();
        this.clickMap(e.clientX - rect.left, e.clientY - rect.top);
      }
      this.drag = null;
    });
    this.canvas.addEventListener('pointerleave', () => this.world?.setPointer(null));
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (this.demo) return;
        // While a board is being placed the wheel tilts it instead of zooming.
        if (this.targetingPlatform()) this.world?.rotatePlatform(e.deltaY);
        else this.world?.zoom(e.deltaY);
      },
      { passive: false },
    );
  }

  /** A human player is aiming a weapon that is pointed with the mouse, so the map cursor is live. */
  private targetingMap(): boolean {
    const game = this.game;
    if (!game || this.demo || this.paused || this.menu.screen) return false;
    return game.isHumanTurn && game.phase === 'aiming' && MAP_WEAPONS.includes(WEAPONS[game.weapon].kind);
  }

  private targetingPlatform(): boolean {
    const game = this.game;
    return game !== null && this.targetingMap() && WEAPONS[game.weapon].kind === 'platform';
  }

  /**
   * Full graphics unless the player picked Low in the menu, or the URL forces it with
   * `?quality=low` — which stays the escape hatch for a machine that cannot open the menu smoothly.
   */
  private get quality(): Quality {
    return this.forcedLowQuality ? 'low' : this.menu.renderQuality;
  }

  /** Handle a click on the map at CSS pixels relative to the canvas. */
  clickMap(cssX: number, cssY: number): void {
    const game = this.game;
    if (!game || !this.world || this.demo || this.paused || this.menu.screen || !game.isHumanTurn) return;
    const kind = WEAPONS[game.weapon].kind;
    if (!MAP_WEAPONS.includes(kind)) return;
    const at = this.world.pick(cssX, cssY);
    if (!at) return;
    if (kind === 'strike') game.strike(at.x);
    else if (kind === 'platform') game.placePlatform({ ...at, angle: this.world.platformAngle });
    else game.teleportTo(at.x, at.y);
  }

  state() {
    const g = this.game;
    return {
      demo: this.demo,
      paused: this.paused,
      screen: this.menu.screen,
      frames: this.frames,
      phase: g?.phase ?? null,
      turn: g?.turn ?? 0,
      turnTimeLeft: g?.turnTimeLeft ?? 0,
      activeTeam: g?.activeTeam ?? -1,
      activeBuddy: g?.activeBuddy?.name ?? null,
      humanTurn: g?.isHumanTurn ?? false,
      weapon: g?.weapon ?? null,
      charge: g?.charge ?? null,
      wind: g?.wind ?? 0,
      rope: g?.rope ? { state: g.rope.state, length: g.rope.length, pivots: g.rope.pivots.length, x: g.rope.hook.x, y: g.rope.hook.y } : null,
      strikeDir: g?.strikeDir ?? 1,
      choosingApproach: g?.choosingApproach ?? false,
      lastStrike: this.lastStrike,
      winner: g?.winner ?? null,
      terrainRevision: g?.terrain.revision ?? 0,
      platforms: g?.terrain.platforms ?? [],
      waterLevel: g?.terrain.waterLevel ?? 0,
      waterRising: g?.waterRising ?? false,
      projectiles: g?.projectiles.length ?? 0,
      sheep: g?.sheep ? { x: g.sheep.body.x, y: g.sheep.body.y } : null,
      graves: (g?.graves ?? []).map((grave) => ({ name: grave.name, x: grave.body.x, y: grave.body.y })),
      crates: (g?.crates ?? []).map((c) => ({ id: c.id, kind: c.kind, weapon: c.weapon, x: c.body.x, y: c.body.y })),
      mines: (g?.mines ?? []).map((m) => ({ id: m.id, owner: m.owner, team: m.team, state: m.state, x: m.body.x, y: m.body.y })),
      ammo: g?.activeTeamData ? { ...g.activeTeamData.ammo } : null,
      sound: this.audio.voices,
      // What the running scene was built with, which is not the pending menu choice.
      quality: this.world?.quality ?? this.quality,
      shadows: this.world !== null && this.world.quality === 'high',
      camera: this.world?.focusPoint ?? null,
      buddies: (g?.buddies ?? []).map((b) => ({
        id: b.id,
        name: b.name,
        team: b.team,
        hp: b.hp,
        alive: b.alive,
        x: b.body.x,
        y: b.body.y,
        aim: b.aim,
        facing: b.facing,
      })),
    };
  }
}
