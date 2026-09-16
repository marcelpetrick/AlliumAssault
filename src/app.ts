import { Engine } from '@babylonjs/core';
import pkg from '../package.json';
import { Audio, type FlightSound } from './audio';
import { Game, type GameEvent, type MatchConfig } from './core/game';
import { WEAPON_ORDER, WEAPONS } from './core/weapons';
import { THEMES } from './render/themes';
import { World, type Quality } from './render/world';
import { Hud } from './ui/hud';
import { Menu } from './ui/menu';
import { demoMatch, randomSeed } from './ui/presets';

const STEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 8;
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
  /** Last whole second announced by the turn-timer tick. */
  private lastTick = 0;
  /** Where the walking buddy last made a footstep sound. */
  private lastStep: { buddy: number; x: number } | null = null;
  private readonly quality: Quality;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    uiRoot: HTMLElement,
  ) {
    this.quality = new URLSearchParams(location.search).get('quality') === 'low' ? 'low' : 'high';
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, antialias: true, powerPreference: 'high-performance' }, true);
    this.engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 1.5));

    this.hud = new Hud(uiRoot, (id) => {
      if (this.game && !this.demo && !this.paused && this.game.isHumanTurn) this.game.selectWeapon(id);
      this.canvas.focus();
    });
    this.menu = new Menu(uiRoot, pkg.version, {
      start: (config) => this.startMatch(config),
      resume: () => this.resume(),
      restart: () => this.config && this.startMatch(this.config),
      rematch: () => this.config && this.startMatch({ ...this.config, seed: randomSeed() }),
      quit: () => this.showTitle(),
      toggleMute: () => this.audio.toggleMute(),
      isMuted: () => this.audio.muted,
      click: () => {
        this.audio.unlock();
        this.audio.play('click');
      },
    });

    this.bindInput();
    window.addEventListener('resize', () => this.engine.resize());
    this.showTitle();
    this.engine.runRenderLoop(() => this.frame());
  }

  showTitle(): void {
    this.startMatch(demoMatch(), true);
    this.menu.showTitle();
  }

  startMatch(config: MatchConfig, demo = false): void {
    this.world?.dispose();
    this.game = new Game(config);
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

  private frame(): void {
    if (!this.manual) this.advance(Math.min(this.engine.getDeltaTime() / 1000, 0.1));
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
    const flights: FlightSound[] = game.projectiles.map((p) => ({ id: p.id, kind: p.weapon === 'bazooka' || p.weapon === 'airbomb' ? 'rocket' : 'lob', vx: p.vx, vy: p.vy }));
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
    const second = game.phase === 'aiming' ? Math.ceil(game.turnTimeLeft) : 0;
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
          this.audio.play(e.radius < 1.2 ? 'shot' : 'explosion', e.radius / 2.8);
          break;
        case 'fire':
          if (e.weapon === 'shotgun') this.audio.play('shot');
          else if (e.weapon === 'sheep') this.audio.play('baa');
          else if (WEAPONS[e.weapon].kind !== 'melee') this.audio.play('fire');
          break;
        case 'sheepHop':
          this.audio.play('hop');
          break;
        case 'airstrike':
          this.audio.play('plane');
          break;
        case 'crateSpawn':
          this.audio.play('teleport');
          break;
        case 'cratePickup':
          this.audio.play(e.kind === 'health' ? 'heal' : 'pickup');
          break;
        case 'punch':
          this.audio.play(e.weapon === 'bat' ? 'bat' : 'punch');
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
        if (this.menu.screen === 'help' || (this.menu.screen === 'setup' && this.demo)) this.menu.back();
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
        default:
          if (/^Digit[1-9]$/.test(e.code)) {
            const id = WEAPON_ORDER[Number(e.code.slice(5)) - 1];
            if (id) game.selectWeapon(id);
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
      this.world?.setPointer(e.clientX - rect.left, e.clientY - rect.top);
      if (!this.drag || !this.world) return;
      this.world.pan(e.clientX - this.drag.x, e.clientY - this.drag.y);
      this.drag = { x: e.clientX, y: e.clientY, moved: this.drag.moved + Math.hypot(e.clientX - this.drag.x, e.clientY - this.drag.y) };
    });
    window.addEventListener('pointerup', (e) => {
      // A click (not a drag) on the map calls the selected air strike.
      if (this.drag && this.drag.moved < CLICK_SLOP && e.target === this.canvas) {
        const rect = this.canvas.getBoundingClientRect();
        this.clickMap(e.clientX - rect.left, e.clientY - rect.top);
      }
      this.drag = null;
    });
    this.canvas.addEventListener('pointerleave', () => this.world?.setPointer(null));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (!this.demo) this.world?.zoom(e.deltaY);
      },
      { passive: false },
    );
  }

  /** Handle a click on the map at CSS pixels relative to the canvas. */
  clickMap(cssX: number, cssY: number): void {
    const game = this.game;
    if (!game || !this.world || this.demo || this.paused || this.menu.screen || !game.isHumanTurn) return;
    if (WEAPONS[game.weapon].kind !== 'strike') return;
    const at = this.world.pick(cssX, cssY);
    if (at) game.strike(at.x);
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
      activeTeam: g?.activeTeam ?? -1,
      activeBuddy: g?.activeBuddy?.name ?? null,
      humanTurn: g?.isHumanTurn ?? false,
      weapon: g?.weapon ?? null,
      charge: g?.charge ?? null,
      wind: g?.wind ?? 0,
      winner: g?.winner ?? null,
      terrainRevision: g?.terrain.revision ?? 0,
      projectiles: g?.projectiles.length ?? 0,
      sheep: g?.sheep ? { x: g.sheep.body.x, y: g.sheep.body.y } : null,
      crates: (g?.crates ?? []).map((c) => ({ id: c.id, kind: c.kind, weapon: c.weapon, x: c.body.x, y: c.body.y })),
      ammo: g?.activeTeamData ? { ...g.activeTeamData.ammo } : null,
      sound: this.audio.voices,
      buddies: (g?.buddies ?? []).map((b) => ({ id: b.id, name: b.name, team: b.team, hp: b.hp, alive: b.alive, x: b.body.x, y: b.body.y, aim: b.aim, facing: b.facing })),
    };
  }
}
