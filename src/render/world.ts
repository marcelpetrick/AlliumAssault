import {
  CascadedShadowGenerator,
  Color3,
  Color4,
  DefaultRenderingPipeline,
  DirectionalLight,
  FreeCamera,
  GlowLayer,
  HemisphericLight,
  ImageProcessingConfiguration,
  Matrix,
  MeshBuilder,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  Vector3,
  type AbstractEngine,
  type Mesh,
} from '@babylonjs/core';
import type { Game, GameEvent } from '../core/game';
import { WEAPONS } from '../core/weapons';
import { clamp } from '../core/math';
import { hashString } from '../core/rng';
import { BuddyKit, BuddyView } from './buddyView';
import { Decorations } from './decorations';
import { Effects } from './effects';
import { Environment } from './environment';
import { TerrainView } from './terrainView';
import type { Theme } from './themes';

export type Quality = 'high' | 'low';

const MIN_DISTANCE = 12;
const MAX_DISTANCE = 85;

/** One Babylon scene presenting one match: world, characters, effects and camera director. */
export class World {
  readonly scene: Scene;
  readonly camera: FreeCamera;
  private readonly shadows: CascadedShadowGenerator | null = null;
  private readonly terrainView: TerrainView;
  private readonly environment: Environment;
  private readonly decorations: Decorations;
  private readonly effects: Effects;
  private readonly buddyViews = new Map<number, BuddyView>();
  private readonly marker: Mesh;
  private readonly markerMaterial: StandardMaterial;
  private readonly focus: Vector3;
  private readonly goal: { x: number; y: number };
  private distance = 80;
  private goalDistance = 30;
  private manualUntil = -1;
  /** Keep the camera on a fresh explosion for a moment, like Worms does. */
  private hold: { x: number; y: number; until: number } | null = null;
  /** Temporary zoom-out while a strike plays: the zoom to restore and the zoom that was forced. */
  private strikeView: { distance: number; forced: number; until: number } | null = null;
  /** World point under the mouse, for the air strike cursor. */
  private pointer: { x: number; y: number } | null = null;
  private shakeAmount = 0;
  private time = 0;

  constructor(
    engine: AbstractEngine,
    readonly game: Game,
    readonly theme: Theme,
    quality: Quality,
  ) {
    const scene = new Scene(engine);
    this.scene = scene;
    scene.clearColor = Color4.FromColor3(theme.skyHorizon, 1);
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogDensity = theme.fogDensity;
    scene.fogColor = theme.fog;

    const t = game.terrain;
    this.focus = new Vector3(t.width / 2, t.height * 0.4, 0);
    this.goal = { x: this.focus.x, y: this.focus.y };
    this.camera = new FreeCamera('camera', new Vector3(this.focus.x, this.focus.y, -this.distance), scene);
    this.camera.fov = 0.72;
    this.camera.minZ = 0.3;
    this.camera.maxZ = 2500;
    this.camera.inputs.clear();

    const hemi = new HemisphericLight('ambient', new Vector3(0.2, 1, -0.4), scene);
    hemi.diffuse = theme.ambientSky;
    hemi.groundColor = theme.ambientGround;
    hemi.intensity = theme.ambientIntensity;
    hemi.specular = Color3.Black();

    const sunDir = new Vector3(...theme.sunDirection).normalize();
    const sun = new DirectionalLight('sun', sunDir, scene);
    sun.diffuse = theme.sunColor;
    sun.intensity = theme.sunIntensity;
    sun.position = new Vector3(t.width / 2, t.height / 2, 0).subtract(sunDir.scale(150));

    if (quality === 'high') {
      const csm = new CascadedShadowGenerator(2048, sun);
      csm.numCascades = 3;
      csm.lambda = 0.85;
      csm.shadowMaxZ = 150;
      csm.stabilizeCascades = true;
      csm.usePercentageCloserFiltering = true;
      csm.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
      csm.darkness = 0.3;
      csm.normalBias = 0.02;
      this.shadows = csm;
    }
    const addCaster = (mesh: Mesh) => this.shadows?.addShadowCaster(mesh, false);

    this.environment = new Environment(scene, theme, t.width, t.waterLevel);
    this.terrainView = new TerrainView(scene, t, theme, addCaster);
    this.decorations = new Decorations(scene, t, theme, hashString(game.config.seed));

    const kit = new BuddyKit(scene);
    for (const b of game.buddies) {
      const color = Color3.FromHexString(game.teams[b.team].config.color);
      this.buddyViews.set(b.id, new BuddyView(scene, b, kit, color, addCaster));
    }

    this.marker = MeshBuilder.CreateCylinder('marker', { height: 0.55, diameterTop: 0.5, diameterBottom: 0, tessellation: 4 }, scene);
    this.markerMaterial = new StandardMaterial('markerMat', scene);
    this.marker.material = this.markerMaterial;
    this.marker.isPickable = false;

    // Only explicitly registered meshes glow, so emissive scenery stays crisp.
    const glow = new GlowLayer('glow', scene, { blurKernelSize: 32, mainTextureRatio: 0.5 });
    glow.intensity = 0.8;
    glow.addIncludedOnlyMesh(this.marker);
    this.effects = new Effects(
      scene,
      (amount) => (this.shakeAmount = Math.max(this.shakeAmount, amount)),
      (mesh) => glow.addIncludedOnlyMesh(mesh),
    );
    const pipeline = new DefaultRenderingPipeline('post', quality === 'high', scene, [this.camera]);
    pipeline.fxaaEnabled = true;
    pipeline.bloomEnabled = quality === 'high';
    pipeline.bloomThreshold = 0.8;
    pipeline.bloomWeight = 0.3;
    pipeline.bloomKernel = 64;
    pipeline.bloomScale = 0.5;
    pipeline.imageProcessingEnabled = true;
    pipeline.imageProcessing.toneMappingEnabled = true;
    pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    pipeline.imageProcessing.exposure = theme.exposure;
    pipeline.imageProcessing.contrast = 1.12;
    pipeline.imageProcessing.vignetteEnabled = true;
    pipeline.imageProcessing.vignetteWeight = 1.4;
    pipeline.imageProcessing.vignetteColor = new Color4(0, 0, 0, 0);
    if (quality === 'high') pipeline.samples = 4;
  }

  handleEvents(events: GameEvent[]): void {
    let crateArrived: { x: number; y: number } | null = null;
    for (const e of events) {
      switch (e.type) {
        case 'explosion':
          this.effects.explosion(e.x, e.y, e.radius, this.theme.dirt);
          this.decorations.clearAround(e.x, e.y, e.radius);
          if (e.radius > 1.5) this.hold = { x: e.x, y: e.y, until: this.time + 1.8 };
          break;
        case 'shot':
          this.effects.tracer(e.x0, e.y0, e.x1, e.y1);
          if (e.weapon === 'minigun') this.effects.muzzle(e.x0, e.y0);
          break;
        case 'fire':
          if (!['walker', 'flyer', 'self'].includes(WEAPONS[e.weapon].kind)) this.effects.muzzle(e.x, e.y);
          break;
        case 'punch':
          this.effects.punch(e.x, e.y);
          if (e.weapon === 'bat') this.hold = { x: e.x + e.dx * 8, y: e.y + 3, until: this.time + 0.6 };
          break;
        case 'splash':
          this.effects.splash(e.x, e.y);
          break;
        case 'land':
          this.buddyViews.get(e.buddy)?.onLand(e.speed);
          break;
        case 'damage':
          this.buddyViews.get(e.buddy)?.onHurt();
          break;
        case 'airstrike': {
          if (e.plane) this.effects.plane(e.startX, e.altitude, e.dir, e.speed);
          this.hold = { x: e.target, y: e.ground + (e.altitude - e.ground) * 0.3, until: this.time + 4.5 };
          const previous = this.strikeView?.distance ?? this.goalDistance;
          this.goalDistance = Math.max(this.goalDistance, 44);
          this.strikeView = { distance: previous, forced: this.goalDistance, until: this.time + 4.5 };
          break;
        }
        case 'crateSpawn':
          this.effects.teleport(e.x, e.y);
          crateArrived = { x: e.x, y: e.y };
          break;
        case 'cratePickup': {
          const finder = this.game.buddies.find((b) => b.id === e.buddy);
          if (finder) this.effects.pickup(finder.body.x, finder.body.y + 0.5, e.kind === 'health');
          break;
        }
        case 'turnStart':
          this.manualUntil = -1;
          this.hold = null;
          break;
      }
    }
    // Show a freshly teleported crate during the turn intro (after turnStart reset the camera).
    if (crateArrived) {
      this.hold = { x: crateArrived.x, y: crateArrived.y + 1, until: this.time + this.game.introTime };
      this.manualUntil = -1;
    }
  }

  update(dt: number): void {
    this.time += dt;
    const g = this.game;
    this.terrainView.update();
    for (const view of this.buddyViews.values()) view.update(g, dt, this.time);

    const active = g.activeBuddy;
    const showMarker = !!active?.alive && (g.phase === 'turnStart' || g.phase === 'aiming');
    this.marker.setEnabled(showMarker);
    if (showMarker && active) {
      this.markerMaterial.emissiveColor = Color3.FromHexString(g.teams[active.team].config.color).scale(0.8);
      this.marker.position.set(active.body.x, active.body.y + 2.35 + Math.sin(this.time * 5) * 0.18, 0);
      this.marker.rotation.y = this.time * 2.5;
    }

    this.effects.syncProjectiles(g, dt);
    this.effects.syncSheep(g);
    this.effects.syncFlyer(g, this.time);
    this.effects.syncCrates(g, dt);
    this.effects.updateTorch(g);
    const targeting = g.phase === 'aiming' && g.isHumanTurn && WEAPONS[g.weapon].kind === 'strike';
    this.effects.setStrikeCursor(targeting ? this.pointer : null, this.time);
    if (this.strikeView && this.time > this.strikeView.until) {
      // Only undo the forced zoom; if the player zoomed in the meantime, keep their choice.
      if (this.goalDistance === this.strikeView.forced) this.goalDistance = this.strikeView.distance;
      this.strikeView = null;
    }
    this.effects.updateAim(g, this.time);
    this.effects.update(dt);
    this.updateCamera(dt);
    this.environment.update(this.time, this.camera.position, dt);
  }

  render(): void {
    this.scene.render();
  }

  /** Pan by screen pixels; the camera stops auto-following for a few seconds. */
  pan(dx: number, dy: number): void {
    const perPixel = (2 * this.distance * Math.tan(this.camera.fov / 2)) / this.scene.getEngine().getRenderHeight();
    this.goal.x -= dx * perPixel * this.scene.getEngine().getHardwareScalingLevel();
    this.goal.y += dy * perPixel * this.scene.getEngine().getHardwareScalingLevel();
    this.manualUntil = this.time + 4;
  }

  zoom(delta: number): void {
    this.goalDistance = clamp(this.goalDistance * (1 + delta * 0.0012), MIN_DISTANCE, MAX_DISTANCE);
  }

  /** World point the camera is centred on (for tests). */
  get focusPoint(): { x: number; y: number } {
    return { x: this.focus.x, y: this.focus.y };
  }

  /** CSS pixels relative to the canvas → point on the gameplay plane (z = 0). */
  pick(cssX: number, cssY: number): { x: number; y: number } | null {
    const engine = this.scene.getEngine();
    const canvas = engine.getRenderingCanvas()!;
    const px = (cssX * engine.getRenderWidth()) / canvas.clientWidth;
    const py = (cssY * engine.getRenderHeight()) / canvas.clientHeight;
    const ray = this.scene.createPickingRay(px, py, Matrix.Identity(), this.camera);
    if (Math.abs(ray.direction.z) < 1e-6) return null;
    const t = -ray.origin.z / ray.direction.z;
    if (t <= 0) return null;
    return { x: ray.origin.x + ray.direction.x * t, y: ray.origin.y + ray.direction.y * t };
  }

  /** Track the mouse for the air strike cursor; null when it left the canvas. */
  setPointer(cssX: number | null, cssY = 0): void {
    this.pointer = cssX === null ? null : this.pick(cssX, cssY);
  }

  /** World position → CSS pixels relative to the canvas, or null when behind the camera. */
  project(x: number, y: number, z = 0): { x: number; y: number } | null {
    const engine = this.scene.getEngine();
    const w = engine.getRenderWidth();
    const h = engine.getRenderHeight();
    const p = Vector3.Project(new Vector3(x, y, z), Matrix.IdentityReadOnly, this.camera.getTransformationMatrix(), this.camera.viewport.toGlobal(w, h));
    if (p.z < 0 || p.z > 1) return null;
    const canvas = engine.getRenderingCanvas()!;
    return { x: (p.x * canvas.clientWidth) / w, y: (p.y * canvas.clientHeight) / h };
  }

  dispose(): void {
    this.terrainView.dispose();
    this.decorations.dispose();
    this.environment.dispose();
    this.scene.dispose();
  }

  private cameraTarget(): { x: number; y: number; fast: boolean } | null {
    const g = this.game;
    const p = g.projectiles[0] ?? g.sheep?.body ?? g.flyer;
    if (p) return { x: p.x, y: p.y, fast: true };
    if (this.hold && this.time < this.hold.until) return { x: this.hold.x, y: this.hold.y, fast: true };
    if (g.phase === 'settling' || g.phase === 'deaths' || g.phase === 'gameOver') {
      const doomed = g.buddies.find((b) => b.alive && b.hp <= 0);
      if (g.phase === 'deaths' && doomed) return { x: doomed.body.x, y: doomed.body.y, fast: false };
      let fastest = null;
      let speed = 2;
      for (const b of g.buddies) {
        const s = Math.hypot(b.body.vx, b.body.vy);
        if (b.alive && s > speed) {
          speed = s;
          fastest = b;
        }
      }
      if (fastest) return { x: fastest.body.x, y: fastest.body.y, fast: true };
      return null;
    }
    const a = g.activeBuddy;
    return a ? { x: a.body.x, y: a.body.y, fast: false } : null;
  }

  private updateCamera(dt: number): void {
    const t = this.game.terrain;
    const target = this.cameraTarget();
    if (target && this.time > this.manualUntil) {
      this.goal.x = target.x;
      this.goal.y = target.y;
    }
    this.goal.x = clamp(this.goal.x, -5, t.width + 5);
    this.goal.y = clamp(this.goal.y, t.waterLevel + 3, t.height + 10);
    const rate = target?.fast ? 5 : 3;
    const k = 1 - Math.exp(-dt * rate);
    this.focus.x += (this.goal.x - this.focus.x) * k;
    this.focus.y += (this.goal.y - this.focus.y) * k;
    this.distance += (this.goalDistance - this.distance) * (1 - Math.exp(-dt * 2.5));

    this.shakeAmount *= Math.exp(-dt * 7);
    const sx = (Math.random() - 0.5) * this.shakeAmount;
    const sy = (Math.random() - 0.5) * this.shakeAmount;
    this.camera.position.set(this.focus.x + sx, this.focus.y + this.distance * 0.2 + sy, -this.distance);
    this.camera.setTarget(new Vector3(this.focus.x + sx * 0.5, this.focus.y + 1 + sy * 0.5, 0));
  }
}
