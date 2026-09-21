// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import type { Scene } from '@babylonjs/core/scene';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import type { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { MUZZLE_OFFSET } from '../core/constants';
import { defined } from '../core/assert';
import type { CrateKind } from '../core/crates';
import type { Flame } from '../core/fire';
import type { Game } from '../core/game';
import { WEAPONS, type WeaponLook } from '../core/weapons';
import { createSoftDotTexture } from './textures';

interface Transient {
  update(dt: number): boolean;
  dispose(): void;
}

interface BurstOptions {
  count: number;
  colors: [Color4, Color4, Color4];
  size: [number, number];
  life: [number, number];
  power: [number, number];
  radius: number;
  gravity: number;
  additive: boolean;
  cone?: boolean;
  grow?: number;
}

/** The sheep is drawn half again as large as it was: at its old size it read as a dot in flight. */
const SHEEP_SCALE = 1.5;

const CHARGE_DOTS = 14;

/**
 * Grace period on top of a one-shot system's longest particle life. Babylon disposes such a system
 * itself once its last particle dies, but a system whose effect stops reporting ready — which does
 * happen when a burst is created while the page is not rendering — never ages another particle and
 * would stay in the scene, drawn and paid for, until the match ends. Anything still around this
 * long after its last particle should have died is swept up.
 */
const BURST_GRACE = 1;

/** Seconds the napalm flames and their smoke are given to fade out after the last patch burns out. */
const FIRE_FADE = 3;

interface ProjectileView {
  node: TransformNode;
  trail: ParticleSystem | null;
}

interface PlaneView {
  node: TransformNode;
  propeller: Mesh;
  startX: number;
  dir: 1 | -1;
  speed: number;
  age: number;
}

interface GraveView {
  node: TransformNode;
  age: number;
  dispose(): void;
}

interface CrateView {
  node: TransformNode;
  age: number;
}

interface MineView {
  node: TransformNode;
  light: Mesh;
}

interface SheepView {
  id: number;
  node: TransformNode;
  body: TransformNode;
  legs: Mesh[];
}

/** Explosions, splashes, tracers, projectile models and the aiming reticle. */
export class Effects {
  private readonly dot: Texture;
  private readonly transients: Transient[] = [];
  private readonly flash: PointLight;
  private flashLevel = 0;
  private readonly projectiles = new Map<number, ProjectileView>();
  private sheep: SheepView | null = null;
  private flyer: SheepView | null = null;
  private readonly planes: PlaneView[] = [];
  private readonly crates = new Map<number, CrateView>();
  private readonly mines = new Map<number, MineView>();
  private rope: { mesh: Mesh; points: number } | null = null;
  private readonly graves = new Map<number, GraveView>();
  private readonly strikeCursor: Mesh;
  /** Where a teleport would put the buddy down; blue when the spot is free, red when it is not. */
  private readonly teleportCursor: TransformNode;
  private flame: ParticleSystem | null = null;
  private torchBody: { outer: Mesh; inner: Mesh } | null = null;
  private dust: ParticleSystem | null = null;
  private fire: ParticleSystem | null = null;
  private fireSmoke: ParticleSystem | null = null;
  private fireLight: PointLight | null = null;
  private readonly groundFire = new Map<number, { outer: Mesh; inner: Mesh }>();
  /**
   * The burning patches of the current frame. The two napalm particle systems are built once and
   * pick their start positions from here, so they must not close over the flames of the frame
   * that happened to create them.
   */
  private burning: readonly Flame[] = [];
  /** One-shot systems with the time by which they must be gone; see BURST_GRACE. */
  private readonly expiring: { ps: ParticleSystem; at: number }[] = [];
  /** Clock time at which the last flame went out, so the fire systems can be emptied afterwards. */
  private fireOutAt: number | null = null;
  /** The same for the blowtorch flame, which is also kept between turns. */
  private torchOutAt: number | null = null;
  private clock = 0;
  private readonly reticle: Mesh;
  private readonly chargeDots: Mesh[] = [];
  private readonly materials: Record<string, StandardMaterial>;
  /** Shared material of the earth lumps, built the first time a blast throws some. */
  private earthMaterial: StandardMaterial | null = null;

  constructor(
    private readonly scene: Scene,
    private readonly shake: (amount: number) => void,
    private readonly glow: (mesh: Mesh) => void,
  ) {
    this.dot = createSoftDotTexture(scene);
    this.flash = new PointLight('flash', Vector3.Zero(), scene);
    this.flash.intensity = 0;
    this.flash.diffuse = new Color3(1, 0.65, 0.3);
    this.flash.specular = new Color3(0.4, 0.3, 0.2);

    const mat = (name: string, diffuse: string, emissive = 0) => {
      const m = new StandardMaterial(name, scene);
      m.diffuseColor = Color3.FromHexString(diffuse);
      m.emissiveColor = m.diffuseColor.scale(emissive);
      m.specularColor = new Color3(0.4, 0.4, 0.4);
      return m;
    };
    this.materials = {
      olive: mat('fxOlive', '#58703a'),
      red: mat('fxRed', '#e0322f', 0.3),
      bomb: mat('fxBomb', '#2f4a2a'),
      cluster: mat('fxCluster', '#d42a24', 0.15),
      gold: mat('fxGold', '#f2c230', 0.45),
      concrete: mat('fxConcrete', '#9c9a94'),
      banana: mat('fxBanana', '#ffd83a', 0.25),
      bananaTip: mat('fxBananaTip', '#5a4020'),
      metal: mat('fxMetal', '#9aa3ad'),
      wool: mat('fxWool', '#f4f1ea', 0.25),
      crateWood: mat('fxCrateWood', '#b07a45', 0.08),
      crateBand: mat('fxCrateBand', '#5a3b22'),
      medWhite: mat('fxMedWhite', '#f5f5f2', 0.2),
      stone: mat('fxStone', '#a9adb3', 0.05),
      medRed: mat('fxMedRed', '#e12b2b', 0.4),
      sheepFace: mat('fxSheepFace', '#2b2522'),
      reticle: mat('fxReticle', '#ff3b3b', 1),
      clownBox: mat('fxClownBox', '#c8308f', 0.12),
      clownStripe: mat('fxClownStripe', '#ffd23f', 0.14),
      porcelain: mat('fxPorcelain', '#f4f2ec', 0.05),
      cobalt: mat('fxCobalt', '#1f4fa8', 0.06),
      beacon: mat('fxBeacon', '#3fa9ff', 1),
      beaconBad: mat('fxBeaconBad', '#ff3b3b', 1),
      tracer: mat('fxTracer', '#ffe27a', 1),
      mineShell: mat('fxMineShell', '#4c5157', 0.05),
      mineLight: mat('fxMineLight', '#ff2d2d', 1),
      rope: mat('fxRope', '#d8c08a', 0.1),
      flameOuter: mat('fxFlameOuter', '#f04b0b', 1),
      flameInner: mat('fxFlameInner', '#ffdc45', 1.2),
      groundOuter: mat('fxGroundOuter', '#e84b0d', 0.7),
      groundInner: mat('fxGroundInner', '#ffb72d', 1),
    };
    this.materials.flameOuter.alpha = 0.8;
    this.materials.flameInner.alpha = 0.9;
    this.materials.groundOuter.alpha = 0.5;
    this.materials.groundInner.alpha = 0.65;
    for (const flame of [this.materials.flameOuter, this.materials.flameInner, this.materials.groundOuter, this.materials.groundInner]) {
      flame.disableLighting = true;
      flame.backFaceCulling = false;
    }

    this.strikeCursor = MeshBuilder.CreateTorus('strikeCursor', { diameter: 1.2, thickness: 0.09, tessellation: 32 }, scene);
    this.strikeCursor.rotation.x = Math.PI / 2;
    this.strikeCursor.isPickable = false;
    const beam = MeshBuilder.CreateCylinder('strikeBeam', { height: 30, diameter: 0.05, tessellation: 6 }, scene);
    beam.parent = this.strikeCursor;
    beam.rotation.x = -Math.PI / 2;
    beam.position.z = -15;
    beam.isPickable = false;
    this.strikeCursor.setEnabled(false);

    // A cross rather than a ring: it marks one point — where the buddy will stand — and a ring
    // would read as an area of effect, which is the last thing a teleport has.
    this.teleportCursor = new TransformNode('teleportCursor', scene);
    for (const [w, h] of [
      [1.5, 0.12],
      [0.12, 1.5],
    ]) {
      const bar = MeshBuilder.CreateBox('teleportBar', { width: w, height: h, depth: 0.12 }, scene);
      bar.parent = this.teleportCursor;
      bar.isPickable = false;
      glow(bar);
    }
    const halo = MeshBuilder.CreateTorus('teleportHalo', { diameter: 1.05, thickness: 0.05, tessellation: 24 }, scene);
    halo.parent = this.teleportCursor;
    halo.rotation.x = Math.PI / 2;
    halo.isPickable = false;
    glow(halo);
    this.teleportCursor.setEnabled(false);

    this.reticle = MeshBuilder.CreateTorus('reticle', { diameter: 0.55, thickness: 0.07, tessellation: 24 }, scene);
    this.reticle.rotation.x = Math.PI / 2;
    this.reticle.material = this.materials.reticle;
    this.reticle.isPickable = false;
    glow(this.reticle);
    this.strikeCursor.material = this.materials.reticle;
    beam.material = this.materials.reticle;
    glow(this.strikeCursor);
    for (let k = 0; k < CHARGE_DOTS; k++) {
      const dot = MeshBuilder.CreateSphere(`charge-${k}`, { diameter: 0.14 + k * 0.022, segments: 8 }, scene);
      const t = k / (CHARGE_DOTS - 1);
      const m = new StandardMaterial(`chargeMat-${k}`, scene);
      m.diffuseColor = Color3.Lerp(new Color3(1, 0.9, 0.2), new Color3(1, 0.15, 0.1), t);
      m.emissiveColor = m.diffuseColor;
      dot.material = m;
      dot.isPickable = false;
      dot.setEnabled(false);
      glow(dot);
      this.chargeDots.push(dot);
    }
  }

  /**
   * `solid` is how much rock the blast found where it went off, 0 to 1: a blast in the open throws
   * no earth about, one inside a hill throws plenty.
   */
  explosion(x: number, y: number, radius: number, debris: Color3, solid = 0): void {
    const r = radius / 2.8;
    const at = new Vector3(x, y, -0.6);
    this.fireball(x, y, radius);
    // Half as many fire and smoke particles as before, and see-through: a dense wall of sprites hid
    // the buddies, the crater and the flying earth behind it.
    this.burst(at, {
      count: Math.round(42 * r) + 6,
      colors: [new Color4(1, 0.9, 0.45, 0.62), new Color4(1, 0.45, 0.08, 0.5), new Color4(0.35, 0.05, 0, 0)],
      size: [0.7 * r + 0.3, 1.9 * r + 0.4],
      life: [0.22, 0.5],
      power: [2.5 * r, 9 * r],
      radius: 0.4 * r,
      gravity: 3,
      additive: true,
      grow: 1.6,
    });
    this.burst(at, {
      count: Math.round(22 * r) + 4,
      colors: [new Color4(0.42, 0.4, 0.38, 0.4), new Color4(0.25, 0.24, 0.24, 0.3), new Color4(0.15, 0.15, 0.15, 0)],
      size: [1.2 * r + 0.3, 2.8 * r + 0.4],
      life: [0.9, 1.9],
      power: [0.8, 3 * r],
      radius: 0.8 * r,
      gravity: 2.5,
      additive: false,
      grow: 2,
    });
    if (solid > 0.05) this.earthChunks(x, y, radius, debris, solid);
    this.burst(at, {
      count: Math.round(45 * r) + 5,
      colors: [Color4.FromColor3(debris, 1), Color4.FromColor3(debris.scale(0.6), 1), Color4.FromColor3(debris.scale(0.4), 0)],
      size: [0.12, 0.32],
      life: [0.7, 1.3],
      power: [6 * r + 2, 15 * r + 2],
      radius: 0.3,
      gravity: -25,
      additive: false,
    });
    this.burst(at, {
      count: Math.round(30 * r) + 4,
      colors: [new Color4(1, 1, 0.7, 1), new Color4(1, 0.7, 0.2, 1), new Color4(1, 0.3, 0, 0)],
      size: [0.06, 0.16],
      life: [0.3, 0.7],
      power: [10 * r + 3, 22 * r + 3],
      radius: 0.2,
      gravity: -18,
      additive: true,
    });
    this.ring(x, y, radius);
    this.flash.position.set(x, y + 0.5, -2.5);
    this.flash.range = radius * 9;
    this.flashLevel = Math.max(this.flashLevel, 3 + 3 * r);
    this.shake(0.25 + radius * 0.15);
  }

  splash(x: number, y: number): void {
    this.burst(new Vector3(x, y, 0), {
      count: 70,
      colors: [new Color4(0.9, 0.97, 1, 0.95), new Color4(0.55, 0.8, 1, 0.8), new Color4(0.5, 0.8, 1, 0)],
      size: [0.18, 0.5],
      life: [0.6, 1.1],
      power: [5, 11],
      radius: 0.6,
      gravity: -25,
      additive: false,
      cone: true,
    });
  }

  muzzle(x: number, y: number): void {
    this.burst(new Vector3(x, y, -0.4), {
      count: 22,
      colors: [new Color4(1, 0.95, 0.6, 1), new Color4(1, 0.6, 0.2, 1), new Color4(0.5, 0.5, 0.5, 0)],
      size: [0.25, 0.7],
      life: [0.1, 0.3],
      power: [1.5, 4],
      radius: 0.15,
      gravity: 1,
      additive: true,
      grow: 1.5,
    });
  }

  punch(x: number, y: number): void {
    this.burst(new Vector3(x, y, -0.8), {
      count: 30,
      colors: [new Color4(1, 1, 1, 1), new Color4(1, 0.9, 0.3, 1), new Color4(1, 0.5, 0.1, 0)],
      size: [0.15, 0.45],
      life: [0.15, 0.4],
      power: [4, 9],
      radius: 0.2,
      gravity: 0,
      additive: true,
    });
    this.shake(0.3);
  }

  tracer(x0: number, y0: number, x1: number, y1: number): void {
    const tube = MeshBuilder.CreateTube('tracer', { path: [new Vector3(x0, y0, -0.4), new Vector3(x1, y1, -0.4)], radius: 0.05, tessellation: 6 }, this.scene);
    const m = this.materials.tracer.clone('tracerMat');
    tube.material = m;
    this.glow(tube);
    let life = 0.18;
    this.transients.push({
      update: (dt) => {
        life -= dt;
        m.alpha = Math.max(0, life / 0.18);
        return life > 0;
      },
      dispose: () => {
        tube.dispose();
        m.dispose();
      },
    });
  }

  /** Create, move and retire projectile models to match the simulation. */
  syncProjectiles(game: Game, dt: number): void {
    const live = new Set<number>();
    for (const p of game.projectiles) {
      live.add(p.id);
      let view = this.projectiles.get(p.id);
      if (!view) {
        view = this.createProjectile(WEAPONS[p.weapon].look.projectile);
        this.projectiles.set(p.id, view);
      }
      view.node.position.set(p.x, p.y, 0);
      const model = WEAPONS[p.weapon].look.projectile;
      if (model === 'mule') view.node.rotation.z = Math.sin(p.age * 3) * 0.08;
      else if (model === 'rocket' || model === 'bomb') view.node.rotation.z = Math.atan2(p.vy, p.vx);
      else view.node.rotation.z -= p.vx * dt * 2;
    }
    for (const [id, view] of this.projectiles) {
      if (live.has(id)) continue;
      if (view.trail) {
        view.trail.emitter = view.node.position.clone();
        view.trail.stop();
        this.retire(view.trail, view.trail.maxLifeTime);
      }
      view.node.dispose();
      this.projectiles.delete(id);
    }
  }

  /** Create, move and retire crate models; new crates scale in with a teleport shimmer. */
  syncCrates(game: Game, dt: number): void {
    const live = new Set<number>();
    for (const c of game.crates) {
      live.add(c.id);
      let view = this.crates.get(c.id);
      if (!view) {
        view = { node: this.createCrate(c.kind), age: 0 };
        this.crates.set(c.id, view);
      }
      view.age += dt;
      const grow = Math.min(1, view.age / 0.45);
      const pop = grow < 1 ? grow * (1 + Math.sin(grow * Math.PI) * 0.35) : 1;
      view.node.scaling.setAll(Math.max(0.01, pop));
      view.node.position.set(c.body.x, c.body.y, 0);
      view.node.rotation.y = grow < 1 ? (1 - grow) * 6 : 0;
    }
    for (const [id, view] of this.crates) {
      if (live.has(id)) continue;
      view.node.dispose();
      this.crates.delete(id);
    }
  }

  /**
   * Create, move and retire mine models. The lamp on top is dark while the mine is still arming,
   * glows once it is live, and flashes fast while its fuse burns down.
   */
  syncMines(game: Game, time: number): void {
    const live = new Set<number>();
    for (const m of game.mines) {
      live.add(m.id);
      let view = this.mines.get(m.id);
      if (!view) {
        view = this.createMine();
        this.mines.set(m.id, view);
      }
      view.node.position.set(m.body.x, m.body.y, 0);
      const blink = m.state === 'triggered' ? Math.sin(time * 34) > 0 : m.state === 'armed' ? Math.sin(time * 5) > -0.4 : false;
      view.light.setEnabled(blink);
    }
    for (const [id, view] of this.mines) {
      if (live.has(id)) continue;
      view.node.dispose(false, true);
      this.mines.delete(id);
    }
  }

  private createMine(): MineView {
    const node = new TransformNode('mine', this.scene);
    const part = (mesh: Mesh, material: StandardMaterial, y: number) => {
      mesh.material = material;
      mesh.position.set(0, y, 0);
      mesh.parent = node;
      mesh.isPickable = false;
      return mesh;
    };
    part(MeshBuilder.CreateCylinder('mineShell', { height: 0.22, diameter: 0.56, tessellation: 16 }, this.scene), this.materials.mineShell, 0);
    part(MeshBuilder.CreateTorus('mineRim', { diameter: 0.56, thickness: 0.07, tessellation: 18 }, this.scene), this.materials.metal, 0.02);
    const light = part(MeshBuilder.CreateSphere('mineLight', { diameter: 0.16, segments: 8 }, this.scene), this.materials.mineLight, 0.17);
    return { node, light };
  }

  /** The rope: a tube through the anchor, every corner it bends around, and the buddy. */
  syncRope(game: Game): void {
    const path = game.ropeLine();
    if (!path || path.length < 2) {
      this.rope?.mesh.setEnabled(false);
      return;
    }
    const points = path.map((p) => new Vector3(p.x, p.y, 0));
    // A tube can only be updated in place while it keeps the same number of points, and the rope
    // gains and loses one every time it wraps or unwraps a corner. Then it has to be rebuilt.
    if (this.rope && this.rope.points !== points.length) {
      this.rope.mesh.dispose();
      this.rope = null;
    }
    const mesh = MeshBuilder.CreateTube('rope', { path: points, radius: 0.055, tessellation: 6, updatable: true, instance: this.rope?.mesh }, this.scene);
    mesh.material = this.materials.rope;
    mesh.isPickable = false;
    mesh.setEnabled(true);
    this.rope = { mesh, points: points.length };
  }

  /** Blowtorch flame at the nozzle, pointing along the burn line, while the torch burns. */
  updateTorch(game: Game, time: number): void {
    const b = game.activeBuddy;
    const torch = game.torch;
    if (!torch || !b) {
      this.flame?.stop();
      this.torchBody?.outer.setEnabled(false);
      this.torchBody?.inner.setEnabled(false);
      this.torchOutAt ??= this.clock;
      if (this.clock - this.torchOutAt > FIRE_FADE) this.flame?.reset();
      return;
    }
    this.torchOutAt = null;
    this.torchBody ??= {
      outer: this.flameCone('torchOuter', this.materials.flameOuter),
      inner: this.flameCone('torchInner', this.materials.flameInner),
    };
    const nozzleX = b.body.x + torch.dx * 0.75;
    const nozzleY = b.body.y + torch.dy * 0.75 + 0.05;
    const angle = Math.atan2(torch.dy, torch.dx) - Math.PI / 2;
    const pulse = 1 + Math.sin(time * 27) * 0.09 + Math.sin(time * 41) * 0.04;
    for (const [mesh, length, width, depth] of [
      [this.torchBody.outer, 2.8 * pulse, 0.9, -0.65],
      [this.torchBody.inner, 2.15 * pulse, 0.48, -0.82],
    ] as const) {
      mesh.setEnabled(true);
      mesh.position.set(nozzleX + torch.dx * length * 0.5, nozzleY + torch.dy * length * 0.5, depth);
      mesh.rotation.z = angle;
      mesh.scaling.set(width, length, width);
    }
    if (!this.flame) {
      const ps = new ParticleSystem('torchFlame', 400, this.scene);
      ps.particleTexture = this.dot;
      ps.emitter = new Vector3();
      ps.createPointEmitter(new Vector3(0.8, -0.3, -0.3), new Vector3(1.6, 0.3, 0.3));
      ps.emitRate = 260;
      ps.minLifeTime = 0.16;
      ps.maxLifeTime = 0.38;
      ps.minSize = 0.28;
      ps.maxSize = 0.7;
      ps.minEmitPower = 4;
      ps.maxEmitPower = 7;
      ps.addColorGradient(0, new Color4(0.7, 0.85, 1, 1));
      ps.addColorGradient(0.3, new Color4(1, 0.75, 0.25, 1));
      ps.addColorGradient(1, new Color4(1, 0.25, 0.05, 0));
      ps.blendMode = ParticleSystem.BLENDMODE_ADD;
      this.flame = ps;
    }
    const ps = this.flame;
    const nozzle = ps.emitter as Vector3;
    nozzle.set(nozzleX, nozzleY, -0.5);
    ps.direction1.set(torch.dx * 0.8 - torch.dy * 0.2, torch.dy * 0.8 + torch.dx * 0.2 - 0.1, -0.3);
    ps.direction2.set(torch.dx * 1.6 + torch.dy * 0.2, torch.dy * 1.6 - torch.dx * 0.2 + 0.1, 0.3);
    if (!ps.isStarted() || ps.isStopping()) ps.start();
    this.flashLevel = Math.max(this.flashLevel, 1.2);
    this.flash.position.set(nozzle.x, nozzle.y, -1.5);
    this.flash.range = 6;
  }

  /**
   * Napalm ignition: a rolling fireball and a column of smoke, the scale of a concrete mule impact
   * but all flame, so the moment a canister bursts is unmistakable.
   */
  ignite(x: number, y: number): void {
    const at = new Vector3(x, y + 0.3, -0.6);
    this.burst(at, {
      count: 110,
      colors: [new Color4(1, 0.92, 0.5, 1), new Color4(1, 0.4, 0.06, 1), new Color4(0.4, 0.06, 0, 0)],
      size: [0.9, 2.6],
      life: [0.35, 0.85],
      power: [3, 11],
      radius: 0.5,
      // Burning fuel is buoyant: the fireball rolls upwards instead of falling.
      gravity: 5,
      additive: true,
      grow: 2.2,
    });
    this.burst(at, {
      count: 55,
      colors: [new Color4(0.3, 0.26, 0.24, 0.8), new Color4(0.18, 0.16, 0.16, 0.55), new Color4(0.1, 0.1, 0.1, 0)],
      size: [1.4, 3.2],
      life: [1.2, 2.4],
      power: [1, 4],
      radius: 1,
      gravity: 3,
      additive: false,
      grow: 2.4,
    });
    this.burst(at, {
      count: 40,
      colors: [new Color4(1, 1, 0.75, 1), new Color4(1, 0.65, 0.15, 1), new Color4(1, 0.3, 0, 0)],
      size: [0.08, 0.2],
      life: [0.5, 1.2],
      power: [8, 18],
      radius: 0.3,
      gravity: -14,
      additive: true,
    });
    this.ring(x, y, 2.4);
    this.flash.position.set(x, y + 0.8, -2.5);
    this.flash.range = 22;
    this.flashLevel = Math.max(this.flashLevel, 5);
    this.shake(0.5);
  }

  /**
   * Two particle systems for all burning napalm — tall flames and the smoke above them — each
   * particle starting at a random flame.
   */
  updateFlames(game: Game, time: number): void {
    const flames = game.flames;
    this.burning = flames;
    const live = new Set(flames.map((flame) => flame.id));
    for (const [id, meshes] of this.groundFire) {
      if (live.has(id)) continue;
      meshes.outer.dispose();
      meshes.inner.dispose();
      this.groundFire.delete(id);
    }
    if (!flames.length) {
      this.fire?.stop();
      this.fireSmoke?.stop();
      if (this.fireLight) this.fireLight.intensity = 0;
      this.fireOutAt ??= this.clock;
      // The two fire systems are kept for the next blaze, so their last particles have to go by
      // hand: a stalled effect would otherwise leave flames hanging in the air over cold ground.
      if (this.clock - this.fireOutAt > FIRE_FADE) {
        this.fire?.reset();
        this.fireSmoke?.reset();
      }
      return;
    }
    this.fireOutAt = null;
    for (const flame of flames) {
      let meshes = this.groundFire.get(flame.id);
      if (!meshes) {
        meshes = {
          outer: this.flameCone(`groundFlameOuter-${flame.id}`, this.materials.groundOuter),
          inner: this.flameCone(`groundFlameInner-${flame.id}`, this.materials.groundInner),
        };
        this.groundFire.set(flame.id, meshes);
      }
      const pulse = 1 + Math.sin(time * 12 + flame.id * 2.3) * 0.18;
      // Lower and narrower than the old pillars: a carpet of fire spread across the ground reads
      // as something to run across, where a wall of flame read as something that had dug in.
      const height = (1.1 + Math.sin(flame.id * 7) * 0.16) * pulse;
      meshes.outer.position.set(flame.x, flame.y + height * 0.5, -0.65);
      meshes.outer.scaling.set(0.58, height, 0.58);
      meshes.outer.rotation.z = Math.sin(time * 6 + flame.id) * 0.12;
      meshes.inner.position.set(flame.x, flame.y + height * 0.34, -0.82);
      meshes.inner.scaling.set(0.28, height * 0.68, 0.28);
      meshes.inner.rotation.z = meshes.outer.rotation.z;
    }
    const atRandomFlame = (position: Vector3, spread: number, lift: number): void => {
      const f = this.burning[Math.floor(Math.random() * this.burning.length)] ?? { x: 0, y: -100 };
      position.set(f.x + (Math.random() - 0.5) * spread, f.y + Math.random() * lift, -0.4 + (Math.random() - 0.5) * 0.8);
    };
    if (!this.fire) {
      const ps = new ParticleSystem('napalmFire', 1200, this.scene);
      ps.particleTexture = this.dot;
      ps.emitter = Vector3.Zero();
      ps.startPositionFunction = (_world, position) => {
        atRandomFlame(position, 0.9, 0.25);
      };
      ps.direction1.set(-0.5, 2.2, -0.2);
      ps.direction2.set(0.5, 4.5, 0.2);
      ps.minLifeTime = 0.35;
      ps.maxLifeTime = 0.85;
      ps.minSize = 0.5;
      ps.maxSize = 1.5;
      ps.minEmitPower = 1;
      ps.maxEmitPower = 2.4;
      // Hot and bright at the base, fading through orange to a dark ember at the tip.
      ps.addColorGradient(0, new Color4(1, 0.98, 0.7, 1));
      ps.addColorGradient(0.3, new Color4(1, 0.6, 0.12, 1));
      ps.addColorGradient(0.7, new Color4(0.9, 0.25, 0.04, 0.8));
      ps.addColorGradient(1, new Color4(0.3, 0.06, 0.02, 0));
      // Tongues of flame swell as they leave the ground, then taper away.
      ps.addSizeGradient(0, 0.55);
      ps.addSizeGradient(0.35, 1.1);
      ps.addSizeGradient(1, 0.35);
      ps.gravity = new Vector3(0, 3, 0);
      ps.blendMode = ParticleSystem.BLENDMODE_ADD;
      this.fire = ps;

      const smoke = new ParticleSystem('napalmSmoke', 400, this.scene);
      smoke.particleTexture = this.dot;
      smoke.emitter = Vector3.Zero();
      // Started above the flame tips, so the smoke trails off the fire instead of hiding it.
      smoke.startPositionFunction = (_world, position) => {
        atRandomFlame(position, 1.2, 0.6);
        position.y += 1.4;
      };
      smoke.direction1.set(-0.4, 1, -0.2);
      smoke.direction2.set(0.4, 2.2, 0.2);
      smoke.minLifeTime = 1.2;
      smoke.maxLifeTime = 2.6;
      smoke.minSize = 0.8;
      smoke.maxSize = 2;
      smoke.minEmitPower = 0.6;
      smoke.maxEmitPower = 1.6;
      smoke.addColorGradient(0, new Color4(0.28, 0.25, 0.23, 0));
      smoke.addColorGradient(0.25, new Color4(0.24, 0.22, 0.21, 0.32));
      smoke.addColorGradient(1, new Color4(0.16, 0.15, 0.15, 0));
      smoke.addSizeGradient(0, 0.8);
      smoke.addSizeGradient(1, 2.4);
      smoke.gravity = new Vector3(0, 1.5, 0);
      smoke.minAngularSpeed = -1;
      smoke.maxAngularSpeed = 1;
      smoke.blendMode = ParticleSystem.BLENDMODE_STANDARD;
      this.fireSmoke = smoke;

      this.fireLight = new PointLight('napalmLight', Vector3.Zero(), this.scene);
      this.fireLight.diffuse = new Color3(1, 0.5, 0.15);
      this.fireLight.specular = Color3.Black();
    }
    const smoke = defined(this.fireSmoke, 'napalm smoke');
    this.fire.emitRate = Math.min(110 * flames.length, 900);
    smoke.emitRate = Math.min(9 * flames.length, 70);
    if (!this.fire.isStarted() || this.fire.isStopping()) this.fire.start();
    if (!smoke.isStarted() || smoke.isStopping()) smoke.start();
    const cx = flames.reduce((sum, f) => sum + f.x, 0) / flames.length;
    const cy = flames.reduce((sum, f) => sum + f.y, 0) / flames.length;
    const light = defined(this.fireLight, 'napalm light');
    light.position.set(cx, cy + 1.2, -2);
    light.range = 16;
    light.intensity = 2.6 + Math.sin(time * 23) * 0.4 + Math.sin(time * 37) * 0.25;
  }

  /** Dirt spraying up out of the shaft while the drill runs. */
  updateDrill(game: Game, debris: Color3): void {
    const b = game.activeBuddy;
    if (!game.drill || !b) {
      this.dust?.stop();
      return;
    }
    if (!this.dust) {
      const ps = new ParticleSystem('drillDust', 300, this.scene);
      ps.particleTexture = this.dot;
      ps.emitter = new Vector3();
      ps.createConeEmitter(0.5, 0.9);
      ps.direction1.set(-1.5, 3, -0.5);
      ps.direction2.set(1.5, 5, 0.5);
      ps.emitRate = 120;
      ps.minLifeTime = 0.25;
      ps.maxLifeTime = 0.6;
      ps.minSize = 0.1;
      ps.maxSize = 0.3;
      ps.minEmitPower = 1;
      ps.maxEmitPower = 2.5;
      ps.gravity = new Vector3(0, -20, 0);
      ps.color1 = Color4.FromColor3(debris, 1);
      ps.color2 = Color4.FromColor3(debris.scale(0.7), 1);
      ps.colorDead = Color4.FromColor3(debris.scale(0.5), 0);
      this.dust = ps;
    }
    (this.dust.emitter as Vector3).set(b.body.x, b.body.y - b.body.radius, -0.5);
    if (!this.dust.isStarted()) this.dust.start();
    this.shake(0.05);
  }

  /** Create, move and retire tombstones; new ones pop up with a springy wobble. */
  syncGraves(game: Game, dt: number): void {
    const live = new Set<number>();
    for (const g of game.graves) {
      live.add(g.id);
      let view = this.graves.get(g.id);
      if (!view) {
        view = this.createGrave(g.name, Color3.FromHexString(game.teams[g.team].config.color));
        this.graves.set(g.id, view);
      }
      view.age += dt;
      const spring = view.age < 0.8 ? 1 + Math.sin(view.age * 18) * 0.25 * (1 - view.age / 0.8) : 1;
      view.node.scaling.set(2 - spring, spring, 1);
      view.node.position.set(g.body.x, g.body.y - g.body.radius, 0);
      view.node.rotation.z = g.body.grounded ? 0 : -g.body.vx * 0.05;
    }
    for (const [id, view] of this.graves) {
      if (live.has(id)) continue;
      view.dispose();
      this.graves.delete(id);
    }
  }

  /** Column of sparkles where a crate materialises. */
  teleport(x: number, y: number): void {
    this.burst(new Vector3(x, y + 0.4, -0.5), {
      count: 60,
      colors: [new Color4(0.7, 0.95, 1, 1), new Color4(0.5, 0.7, 1, 0.9), new Color4(0.8, 0.6, 1, 0)],
      size: [0.08, 0.26],
      life: [0.4, 0.9],
      power: [0.5, 2.5],
      radius: 0.5,
      gravity: 5,
      additive: true,
    });
  }

  /** Sparkle burst when a crate is collected. */
  pickup(x: number, y: number, health: boolean): void {
    const tint = health ? new Color4(0.5, 1, 0.55, 1) : new Color4(1, 0.85, 0.35, 1);
    this.burst(new Vector3(x, y, -0.6), {
      count: 45,
      colors: [tint, new Color4(1, 1, 1, 0.9), new Color4(tint.r, tint.g, tint.b, 0)],
      size: [0.1, 0.3],
      life: [0.35, 0.8],
      power: [2, 6],
      radius: 0.3,
      gravity: 2,
      additive: true,
    });
  }

  /** Crosshair where a click would call the air strike; null hides it. */
  /**
   * Mark where a teleport would put the buddy down. `ok` is the game's own answer to whether the
   * spot is free, so the colour on screen and what the click does can never disagree.
   */
  setTeleportCursor(at: { x: number; y: number } | null, ok: boolean, time: number): void {
    this.teleportCursor.setEnabled(at !== null);
    if (!at) return;
    this.teleportCursor.position.set(at.x, at.y, -0.6);
    this.teleportCursor.rotation.z = time * 1.6;
    this.teleportCursor.scaling.setAll(ok ? 1 + Math.sin(time * 6) * 0.07 : 0.8);
    const material = ok ? this.materials.beacon : this.materials.beaconBad;
    for (const mesh of this.teleportCursor.getChildMeshes()) mesh.material = material;
  }

  setStrikeCursor(at: { x: number; y: number } | null, time: number): void {
    this.strikeCursor.setEnabled(!!at);
    if (!at) return;
    this.strikeCursor.position.set(at.x, at.y, -0.8);
    this.strikeCursor.scaling.setAll(1 + Math.sin(time * 5) * 0.1);
  }

  /** Fly a plane across the sky; its path matches the simulation's bomb release points. */
  plane(startX: number, altitude: number, dir: 1 | -1, speed: number): void {
    const node = new TransformNode('plane', this.scene);
    const part = (mesh: Mesh, material: StandardMaterial, x: number, y: number, z = 0) => {
      mesh.material = material;
      mesh.position.set(x, y, z);
      mesh.parent = node;
      mesh.isPickable = false;
      return mesh;
    };
    const fuselage = part(
      MeshBuilder.CreateCylinder('fuselage', { height: 3.2, diameterTop: 0.35, diameterBottom: 0.6, tessellation: 14 }, this.scene),
      this.materials.olive,
      0,
      0,
    );
    fuselage.rotation.z = Math.PI / 2;
    part(MeshBuilder.CreateBox('wing', { width: 0.9, height: 0.08, depth: 4.2 }, this.scene), this.materials.olive, 0.2, 0);
    part(MeshBuilder.CreateBox('tailWing', { width: 0.45, height: 0.06, depth: 1.5 }, this.scene), this.materials.olive, -1.45, 0.05);
    part(MeshBuilder.CreateBox('fin', { width: 0.5, height: 0.7, depth: 0.06 }, this.scene), this.materials.red, -1.45, 0.35);
    part(MeshBuilder.CreateSphere('cockpit', { diameterX: 0.7, diameterY: 0.4, diameterZ: 0.35, segments: 10 }, this.scene), this.materials.metal, 0.55, 0.3);
    const nose = part(MeshBuilder.CreateSphere('nose', { diameter: 0.4, segments: 8 }, this.scene), this.materials.red, 1.6, 0);
    this.glow(nose);
    const propeller = part(MeshBuilder.CreateBox('propeller', { width: 0.05, height: 1.3, depth: 0.12 }, this.scene), this.materials.metal, 1.8, 0);
    node.scaling.set(dir * 1.6, 1.6, 1.6);
    node.position.set(startX, altitude, -1.5);
    this.planes.push({ node, propeller, startX, dir, speed, age: 0 });
  }

  /** Show the released sheep, facing its hop direction, legs tucked in mid-air. */
  syncSheep(game: Game): void {
    const s = game.sheep;
    if (this.sheep && this.sheep.id !== s?.id) {
      this.sheep.node.dispose();
      this.sheep = null;
    }
    if (!s) return;
    this.sheep ??= this.createSheep(s.id);
    const view = this.sheep;
    view.node.position.set(s.body.x, s.body.y, 0);
    // Only the model: the collision radius and the blast are the rules', and they stay put.
    view.node.scaling.set(s.facing * SHEEP_SCALE, SHEEP_SCALE, SHEEP_SCALE);
    const airborne = !s.body.grounded;
    view.body.rotation.z = airborne ? Math.atan2(s.body.vy, Math.abs(s.body.vx) + 1e-3) * 0.5 : 0;
    for (const leg of view.legs) leg.scaling.y = airborne ? 0.6 : 1;
  }

  /** Show the flying sheep, nose along its flight direction, legs tucked, cape flapping. */
  syncFlyer(game: Game, time: number): void {
    const f = game.flyer;
    if (this.flyer && this.flyer.id !== f?.id) {
      this.flyer.node.dispose();
      this.flyer = null;
    }
    if (!f) return;
    if (!this.flyer) {
      this.flyer = this.createSheep(f.id);
      const cape = MeshBuilder.CreateBox('cape', { width: 0.55, height: 0.04, depth: 0.42 }, this.scene);
      cape.material = this.materials.red;
      cape.position.set(-0.32, 0.3, 0);
      cape.parent = this.flyer.body;
      cape.isPickable = false;
      for (const leg of this.flyer.legs) leg.scaling.y = 0.5;
    }
    const view = this.flyer;
    const left = Math.cos(f.angle) < 0;
    view.node.position.set(f.x, f.y, 0);
    const fly = 1.4 * SHEEP_SCALE;
    view.node.scaling.set(left ? -fly : fly, fly, fly);
    view.body.rotation.z = left ? Math.PI - f.angle : f.angle;
    view.body.rotation.x = Math.sin(time * 18) * 0.08;
  }

  updateAim(game: Game, time: number): void {
    const b = game.activeBuddy;
    const show = !!b?.alive && game.phase === 'aiming';
    this.reticle.setEnabled(show);
    if (!b || !show) {
      for (const d of this.chargeDots) d.setEnabled(false);
      return;
    }
    const dir = game.aimDirection(b);
    this.reticle.position.set(b.body.x + dir.x * 3.4, b.body.y + dir.y * 3.4, -0.8);
    this.reticle.scaling.setAll(1 + Math.sin(time * 6) * 0.08);
    const lit = game.charge === null ? 0 : Math.ceil(game.charge * CHARGE_DOTS);
    this.chargeDots.forEach((d, k) => {
      d.setEnabled(k < lit);
      const dist = MUZZLE_OFFSET + 0.35 + k * 0.24;
      d.position.set(b.body.x + dir.x * dist, b.body.y + dir.y * dist, -0.8);
    });
  }

  update(dt: number): void {
    this.clock += dt;
    this.sweepBursts();
    for (let k = this.planes.length - 1; k >= 0; k--) {
      const p = this.planes[k];
      p.age += dt;
      p.node.position.x = p.startX + p.dir * p.speed * p.age;
      p.node.position.y += Math.sin(p.age * 3) * 0.004;
      p.propeller.rotation.x += dt * 40;
      if (p.age > 6) {
        p.node.dispose();
        this.planes.splice(k, 1);
      }
    }
    this.flashLevel *= Math.exp(-dt * 9);
    this.flash.intensity = this.flashLevel;
    for (let k = this.transients.length - 1; k >= 0; k--) {
      if (!this.transients[k].update(dt)) {
        this.transients[k].dispose();
        this.transients.splice(k, 1);
      }
    }
  }

  private createMissile(withTrail: boolean): ProjectileView {
    const node = new TransformNode('missile', this.scene);
    const body = MeshBuilder.CreateCylinder('missileBody', { height: 0.62, diameter: 0.17, tessellation: 12 }, this.scene);
    body.rotation.z = Math.PI / 2;
    body.material = this.materials.olive;
    body.parent = node;
    const nose = MeshBuilder.CreateCylinder('missileNose', { height: 0.22, diameterTop: 0, diameterBottom: 0.17, tessellation: 12 }, this.scene);
    nose.rotation.z = -Math.PI / 2;
    nose.position.x = 0.42;
    nose.material = this.materials.red;
    nose.parent = node;
    this.glow(nose);
    if (!withTrail) return { node, trail: null };
    const trail = new ParticleSystem('trail', 300, this.scene);
    trail.particleTexture = this.dot;
    trail.emitter = body;
    trail.createPointEmitter(new Vector3(-0.2, -0.2, -0.2), new Vector3(0.2, 0.2, 0.2));
    trail.emitRate = 90;
    trail.minLifeTime = 0.35;
    trail.maxLifeTime = 0.8;
    trail.minSize = 0.18;
    trail.maxSize = 0.4;
    trail.minEmitPower = 0.1;
    trail.maxEmitPower = 0.6;
    trail.addColorGradient(0, new Color4(1, 0.85, 0.4, 1));
    trail.addColorGradient(0.15, new Color4(1, 0.5, 0.15, 0.9));
    trail.addColorGradient(0.4, new Color4(0.55, 0.53, 0.5, 0.6));
    trail.addColorGradient(1, new Color4(0.5, 0.5, 0.5, 0));
    trail.addSizeGradient(0, 0.25);
    trail.addSizeGradient(1, 0.9);
    trail.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    trail.disposeOnStop = true;
    trail.start();
    return { node, trail };
  }

  private createProjectile(model: WeaponLook['projectile']): ProjectileView {
    switch (model) {
      case 'rocket':
        return this.createMissile(true);
      case 'bomb':
        return this.createMissile(false);
      case 'mule':
        return this.createMule();
      case 'redGrenade':
        return this.createGrenade(this.materials.cluster);
      case 'holyGrenade':
        return this.createHolyGrenade();
      case 'banana':
        return this.createBanana(1.4);
      case 'smallBanana':
        return this.createBanana(0.9);
      case 'bomblet':
        return this.createBomblet();
      case 'vase':
        return this.createVase(1);
      case 'shard':
        return this.createVase(0.42);
      case 'fuel':
        return this.createFuelGob();
      case 'grenade':
      case undefined:
        return this.createGrenade(this.materials.bomb);
    }
  }

  /** A gob of lit petroleum: a small glowing blob with a hotter core, bright enough to trail. */
  private createFuelGob(): ProjectileView {
    const node = new TransformNode('fuelGob', this.scene);
    const outer = MeshBuilder.CreateSphere('fuelOuter', { diameter: 0.34, segments: 8 }, this.scene);
    outer.material = this.materials.flameOuter;
    outer.parent = node;
    outer.isPickable = false;
    this.glow(outer);
    const core = MeshBuilder.CreateSphere('fuelCore', { diameter: 0.18, segments: 8 }, this.scene);
    core.material = this.materials.flameInner;
    core.parent = node;
    core.isPickable = false;
    this.glow(core);
    return { node, trail: null };
  }

  /**
   * Blue-and-white porcelain: a swelling body on a foot, a narrow neck and a flared lip, with a
   * painted band around the belly. A shard is the same vase at less than half the size, which
   * reads as a broken-off piece of it rather than as a different object.
   */
  private createVase(scale: number): ProjectileView {
    const node = new TransformNode('vase', this.scene);
    const part = (mesh: Mesh, material: StandardMaterial, y: number) => {
      mesh.material = material;
      mesh.position.y = y * scale;
      mesh.scaling.setAll(scale);
      mesh.parent = node;
      mesh.isPickable = false;
      return mesh;
    };
    part(MeshBuilder.CreateSphere('vaseBody', { diameterX: 0.44, diameterY: 0.5, diameterZ: 0.44, segments: 14 }, this.scene), this.materials.porcelain, 0);
    part(
      MeshBuilder.CreateCylinder('vaseFoot', { height: 0.1, diameterTop: 0.2, diameterBottom: 0.26, tessellation: 14 }, this.scene),
      this.materials.porcelain,
      -0.26,
    );
    part(
      MeshBuilder.CreateCylinder('vaseNeck', { height: 0.2, diameterTop: 0.2, diameterBottom: 0.14, tessellation: 14 }, this.scene),
      this.materials.porcelain,
      0.32,
    );
    part(MeshBuilder.CreateTorus('vaseLip', { diameter: 0.22, thickness: 0.05, tessellation: 14 }, this.scene), this.materials.porcelain, 0.42);
    // The cobalt band, the thing that makes it a Ming vase and not a pot.
    part(MeshBuilder.CreateTorus('vaseBand', { diameter: 0.45, thickness: 0.07, tessellation: 16 }, this.scene), this.materials.cobalt, 0.02);
    part(MeshBuilder.CreateTorus('vaseBandLow', { diameter: 0.36, thickness: 0.04, tessellation: 16 }, this.scene), this.materials.cobalt, -0.16);
    return { node, trail: null };
  }

  /** Cartoon tombstone: rounded slab with "R.I.P." and the name, a team-coloured ribbon and a sprout. */
  private createGrave(name: string, team: Color3): GraveView {
    const node = new TransformNode('grave', this.scene);
    const part = (mesh: Mesh, material: StandardMaterial, x = 0, y = 0, z = 0) => {
      mesh.material = material;
      mesh.position.set(x, y, z);
      mesh.parent = node;
      mesh.isPickable = false;
      return mesh;
    };
    part(MeshBuilder.CreateBox('graveSlab', { width: 0.9, height: 0.8, depth: 0.28 }, this.scene), this.materials.stone, 0, 0.4);
    const top = part(MeshBuilder.CreateCylinder('graveTop', { height: 0.28, diameter: 0.9, tessellation: 24 }, this.scene), this.materials.stone, 0, 0.8);
    top.rotation.x = Math.PI / 2;
    part(MeshBuilder.CreateBox('graveBase', { width: 1.1, height: 0.14, depth: 0.42 }, this.scene), this.materials.stone, 0, 0.07);

    const texture = new DynamicTexture('graveText', { width: 256, height: 256 }, this.scene, true);
    const ctx = texture.getContext() as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 256, 256);
    ctx.fillStyle = '#4a4e55';
    ctx.textAlign = 'center';
    ctx.font = 'bold 76px sans-serif';
    ctx.fillText('R.I.P.', 128, 118);
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(name.length > 10 ? `${name.slice(0, 9)}…` : name, 128, 190);
    texture.hasAlpha = true;
    texture.update();
    const textMat = new StandardMaterial('graveTextMat', this.scene);
    textMat.diffuseTexture = texture;
    textMat.useAlphaFromDiffuseTexture = true;
    textMat.specularColor = Color3.Black();
    part(MeshBuilder.CreatePlane('graveFace', { width: 0.82, height: 0.82 }, this.scene), textMat, 0, 0.55, -0.15);

    const ribbonMat = new StandardMaterial('graveRibbon', this.scene);
    ribbonMat.diffuseColor = team;
    ribbonMat.emissiveColor = team.scale(0.25);
    part(MeshBuilder.CreateBox('graveRibbon', { width: 0.92, height: 0.1, depth: 0.3 }, this.scene), ribbonMat, 0, 0.18);
    const sprout = part(
      MeshBuilder.CreateCylinder('graveSprout', { height: 0.3, diameterTop: 0, diameterBottom: 0.08, tessellation: 6 }, this.scene),
      this.materials.olive,
      0.25,
      1.05,
    );
    sprout.rotation.z = -0.4;
    node.scaling.setAll(0.01);
    return {
      node,
      age: 0,
      dispose: () => {
        node.dispose(false, true);
        texture.dispose();
      },
    };
  }

  private createCrate(kind: CrateKind): TransformNode {
    const node = new TransformNode('crate', this.scene);
    const part = (mesh: Mesh, material: StandardMaterial, x = 0, y = 0, z = 0) => {
      mesh.material = material;
      mesh.position.set(x, y, z);
      mesh.parent = node;
      mesh.isPickable = false;
      return mesh;
    };
    const size = 0.82;
    if (kind === 'health') {
      part(MeshBuilder.CreateBox('crateBox', { size }, this.scene), this.materials.medWhite);
      // Red cross on the front face, towards the camera.
      part(MeshBuilder.CreateBox('crossH', { width: 0.56, height: 0.16, depth: 0.02 }, this.scene), this.materials.medRed, 0, 0, -size / 2 - 0.01);
      part(MeshBuilder.CreateBox('crossV', { width: 0.16, height: 0.56, depth: 0.02 }, this.scene), this.materials.medRed, 0, 0, -size / 2 - 0.01);
    } else if (kind === 'mystery') {
      // A clown box: bright stripes, a question mark on the front and a knobbed lid, so it reads
      // as a box that might be fun and might not.
      part(MeshBuilder.CreateBox('crateBox', { size }, this.scene), this.materials.clownBox);
      for (const x of [-0.24, 0.24]) {
        part(MeshBuilder.CreateBox('stripe', { width: 0.16, height: size + 0.02, depth: size + 0.02 }, this.scene), this.materials.clownStripe, x);
      }
      part(MeshBuilder.CreateBox('lid', { width: size + 0.06, height: 0.12, depth: size + 0.06 }, this.scene), this.materials.clownStripe, 0, size / 2);
      const knob = part(MeshBuilder.CreateSphere('knob', { diameter: 0.18, segments: 10 }, this.scene), this.materials.medWhite, 0, size / 2 + 0.12);
      this.glow(knob);
      // The question mark: a hook of three boxes and a dot, on the face towards the camera.
      const front = -size / 2 - 0.02;
      const curve = part(MeshBuilder.CreateBox('markTop', { width: 0.3, height: 0.1, depth: 0.02 }, this.scene), this.materials.medWhite, 0.02, 0.2, front);
      curve.rotation.z = 0.1;
      part(MeshBuilder.CreateBox('markSide', { width: 0.1, height: 0.2, depth: 0.02 }, this.scene), this.materials.medWhite, 0.14, 0.08, front);
      part(MeshBuilder.CreateBox('markStem', { width: 0.1, height: 0.18, depth: 0.02 }, this.scene), this.materials.medWhite, 0.02, -0.04, front);
      part(MeshBuilder.CreateBox('markDot', { width: 0.1, height: 0.1, depth: 0.02 }, this.scene), this.materials.medWhite, 0.02, -0.22, front);
    } else {
      part(MeshBuilder.CreateBox('crateBox', { size }, this.scene), this.materials.crateWood);
      for (const y of [-0.28, 0.28]) {
        part(MeshBuilder.CreateBox('band', { width: size + 0.03, height: 0.1, depth: size + 0.03 }, this.scene), this.materials.crateBand, 0, y);
      }
      const mark = part(MeshBuilder.CreateBox('mark', { width: 0.1, height: 0.46, depth: 0.02 }, this.scene), this.materials.crateBand, 0, 0, -size / 2 - 0.02);
      mark.rotation.z = Math.PI / 4;
    }
    return node;
  }

  private createSheep(id: number): SheepView {
    const node = new TransformNode('sheep', this.scene);
    const body = new TransformNode('sheepBody', this.scene);
    body.parent = node;
    const part = (mesh: Mesh, material: StandardMaterial, x: number, y: number, z = 0) => {
      mesh.material = material;
      mesh.position.set(x, y, z);
      mesh.parent = body;
      mesh.isPickable = false;
      return mesh;
    };
    // Wool: a cluster of puffs around an oval core.
    part(MeshBuilder.CreateSphere('wool', { diameterX: 0.72, diameterY: 0.5, diameterZ: 0.5, segments: 10 }, this.scene), this.materials.wool, 0, 0.05);
    for (const [x, y, z] of [
      [-0.25, 0.2, 0],
      [0, 0.26, -0.1],
      [0.22, 0.2, 0.05],
      [-0.1, 0.12, -0.22],
      [0.12, 0.08, 0.22],
      [-0.32, 0.02, 0.1],
    ]) {
      part(MeshBuilder.CreateSphere('puff', { diameter: 0.26, segments: 8 }, this.scene), this.materials.wool, x, y, z);
    }
    part(
      MeshBuilder.CreateSphere('head', { diameterX: 0.26, diameterY: 0.24, diameterZ: 0.22, segments: 10 }, this.scene),
      this.materials.sheepFace,
      0.4,
      0.14,
    );
    for (const z of [-0.09, 0.09]) {
      const ear = part(
        MeshBuilder.CreateSphere('ear', { diameterX: 0.14, diameterY: 0.05, diameterZ: 0.08, segments: 6 }, this.scene),
        this.materials.sheepFace,
        0.36,
        0.22,
        z,
      );
      ear.rotation.x = z * 4;
      part(MeshBuilder.CreateSphere('sheepEye', { diameter: 0.05, segments: 6 }, this.scene), this.materials.wool, 0.5, 0.18, z * 0.6 - 0.05);
    }
    const legs = [-0.18, 0.18].flatMap((x) =>
      [-0.12, 0.12].map((z) => {
        const leg = part(
          MeshBuilder.CreateCylinder('leg', { height: 0.22, diameter: 0.06, tessellation: 6 }, this.scene),
          this.materials.sheepFace,
          x,
          -0.24,
          z,
        );
        leg.setPivotPoint(new Vector3(0, 0.11, 0));
        return leg;
      }),
    );
    return { id, node, body, legs };
  }

  /** Curved, tapering banana with dark tips. */
  private createBanana(size: number): ProjectileView {
    const node = new TransformNode('banana', this.scene);
    const path: Vector3[] = [];
    for (let k = 0; k <= 12; k++) {
      const a = -0.9 + (k / 12) * 1.8;
      path.push(new Vector3(Math.sin(a) * 0.32, -Math.cos(a) * 0.32 + 0.22, 0));
    }
    const body = MeshBuilder.CreateTube(
      'bananaBody',
      { path, radiusFunction: (i) => 0.035 + Math.sin((i / 12) * Math.PI) * 0.07, tessellation: 10, cap: Mesh.CAP_ALL },
      this.scene,
    );
    body.material = this.materials.banana;
    body.parent = node;
    for (const end of [path[0], path[12]]) {
      const tip = MeshBuilder.CreateSphere('bananaTip', { diameter: 0.07, segments: 6 }, this.scene);
      tip.material = this.materials.bananaTip;
      tip.position.copyFrom(end);
      tip.parent = node;
    }
    node.scaling.setAll(size);
    return { node, trail: null };
  }

  private createHolyGrenade(): ProjectileView {
    const view = this.createGrenade(this.materials.gold);
    view.node.scaling.setAll(1.35);
    const bar = (w: number, h: number, y: number) => {
      const m = MeshBuilder.CreateBox('holyCross', { width: w, height: h, depth: 0.05 }, this.scene);
      m.material = this.materials.gold;
      m.position.y = y;
      m.parent = view.node;
      this.glow(m);
    };
    bar(0.05, 0.26, 0.38);
    bar(0.16, 0.05, 0.42);
    return view;
  }

  /** Giant grey concrete mule, a few units tall, built from blocks. */
  private createMule(): ProjectileView {
    const node = new TransformNode('mule', this.scene);
    const block = (w: number, h: number, d: number, x: number, y: number, z = 0, rz = 0) => {
      const m = MeshBuilder.CreateBox('muleBlock', { width: w, height: h, depth: d }, this.scene);
      m.material = this.materials.concrete;
      m.position.set(x, y, z);
      m.rotation.z = rz;
      m.parent = node;
      m.isPickable = false;
    };
    block(2.4, 1.1, 1.0, 0, 0.4);
    block(0.55, 1.1, 0.6, 1.25, 1.15, 0, -0.5);
    block(0.9, 0.55, 0.55, 1.65, 1.65);
    block(0.14, 0.5, 0.12, 1.45, 2.15, -0.14);
    block(0.14, 0.5, 0.12, 1.45, 2.15, 0.14);
    for (const x of [-0.85, 0.85]) for (const z of [-0.3, 0.3]) block(0.28, 1.0, 0.28, x, -0.55, z);
    block(0.14, 0.7, 0.14, -1.3, 0.4, 0, 0.6);
    node.scaling.setAll(1.2);
    return { node, trail: null };
  }

  private createBomblet(): ProjectileView {
    const node = new TransformNode('bomblet', this.scene);
    const ball = MeshBuilder.CreateSphere('bombletBall', { diameter: 0.2, segments: 8 }, this.scene);
    ball.material = this.materials.cluster;
    ball.parent = node;
    this.glow(ball);
    return { node, trail: null };
  }

  private createGrenade(material: StandardMaterial): ProjectileView {
    const node = new TransformNode('grenade', this.scene);
    const ball = MeshBuilder.CreateSphere('grenadeBall', { diameter: 0.36, segments: 12 }, this.scene);
    ball.material = material;
    ball.parent = node;
    const cap = MeshBuilder.CreateCylinder('grenadeCap', { height: 0.12, diameter: 0.12, tessellation: 8 }, this.scene);
    cap.position.y = 0.2;
    cap.material = this.materials.metal;
    cap.parent = node;
    return { node, trail: null };
  }

  /**
   * Lumps of earth thrown out of a crater: small tumbling boxes in the scenery's own dirt colour,
   * ballistic and short-lived. They are meshes rather than particles because a handful of solid,
   * spinning pieces reads as "the ground just came apart" in a way a sprite cloud never does.
   */
  private earthChunks(x: number, y: number, radius: number, dirt: Color3, solid: number): void {
    const material = (this.earthMaterial ??= this.dirtMaterial());
    material.diffuseColor = dirt;
    const count = Math.min(16, Math.round((3 + radius * 2.2) * solid));
    for (let k = 0; k < count; k++) {
      const size = 0.16 + Math.random() * 0.24 * Math.min(2, radius / 2.5);
      const chunk = MeshBuilder.CreateBox(`chunk-${k}`, { width: size, height: size * (0.6 + Math.random() * 0.6), depth: size }, this.scene);
      chunk.material = material;
      chunk.isPickable = false;
      chunk.position.set(x + (Math.random() - 0.5) * radius * 0.6, y + (Math.random() - 0.5) * radius * 0.4, (Math.random() - 0.5) * 0.9);
      const angle = Math.PI * (0.15 + Math.random() * 0.7);
      const speed = 5 + Math.random() * (5 + radius * 2.2);
      const velocity = new Vector3(Math.cos(angle) * speed * (Math.random() < 0.5 ? -1 : 1), Math.sin(angle) * speed, 0);
      const spin = new Vector3(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4);
      const life = 1.1 + Math.random() * 0.8;
      let age = 0;
      this.transients.push({
        update: (dt) => {
          age += dt;
          velocity.y -= 25 * dt;
          chunk.position.addInPlace(velocity.scale(dt));
          chunk.rotation.addInPlace(spin.scale(dt));
          // Shrink away at the end instead of blinking out.
          const left = 1 - age / life;
          if (left < 0.3) chunk.scaling.setAll(Math.max(0.01, left / 0.3));
          return age < life;
        },
        dispose: () => {
          chunk.dispose();
        },
      });
    }
  }

  private dirtMaterial(): StandardMaterial {
    const material = new StandardMaterial('earthChunk', this.scene);
    material.specularColor = new Color3(0.08, 0.08, 0.08);
    return material;
  }

  private fireball(x: number, y: number, radius: number): void {
    const outer = MeshBuilder.CreateSphere('blastOuter', { diameter: 1, segments: 12 }, this.scene);
    const inner = MeshBuilder.CreateSphere('blastCore', { diameter: 1, segments: 12 }, this.scene);
    const outerMat = this.materials.flameOuter.clone('blastOuterMat');
    const innerMat = this.materials.flameInner.clone('blastCoreMat');
    outer.material = outerMat;
    inner.material = innerMat;
    outer.position.set(x, y, -0.85);
    inner.position.set(x, y, -1.1);
    outer.isPickable = inner.isPickable = false;
    this.glow(outer);
    this.glow(inner);
    let age = 0;
    this.transients.push({
      update: (dt) => {
        age += dt;
        const t = Math.min(age / 0.48, 1);
        const size = Math.max(radius, 0.8) * (0.32 + t * 0.85);
        outer.scaling.setAll(size);
        inner.scaling.setAll(size * (0.55 + t * 0.08));
        outerMat.alpha = 0.5 * (1 - t);
        innerMat.alpha = 0.7 * (1 - t * t);
        return t < 1;
      },
      dispose: () => {
        outer.dispose();
        inner.dispose();
        outerMat.dispose();
        innerMat.dispose();
      },
    });
  }

  private flameCone(name: string, material: StandardMaterial): Mesh {
    const cone = new Mesh(name, this.scene);
    const rings = [
      [-0.5, 0.34, 0],
      [-0.28, 0.5, 0],
      [-0.06, 0.4, 0.04],
      [0.2, 0.25, 0.1],
      [0.4, 0.1, 0.16],
      [0.5, 0.01, 0.19],
    ];
    const sides = 10;
    const positions: number[] = [];
    const indices: number[] = [];
    for (const [height, width, bend] of rings) {
      for (let side = 0; side < sides; side++) {
        const angle = (side * Math.PI * 2) / sides;
        positions.push(Math.cos(angle) * width + bend, height, Math.sin(angle) * width);
      }
    }
    for (let ring = 0; ring < rings.length - 1; ring++) {
      for (let side = 0; side < sides; side++) {
        const next = (side + 1) % sides;
        const a = ring * sides + side;
        const b = ring * sides + next;
        indices.push(a, b, a + sides, b, b + sides, a + sides);
      }
    }
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.normals = normals;
    data.applyToMesh(cone);
    cone.material = material;
    cone.isPickable = false;
    this.glow(cone);
    return cone;
  }

  /** Retire a one-shot system by hand if Babylon has not disposed of it in time. */
  private retire(ps: ParticleSystem, longestLife: number): void {
    this.expiring.push({ ps, at: this.clock + longestLife + BURST_GRACE });
  }

  private sweepBursts(): void {
    for (let k = this.expiring.length - 1; k >= 0; k--) {
      const { ps, at } = this.expiring[k];
      const gone = !this.scene.particleSystems.includes(ps);
      if (!gone && this.clock < at) continue;
      if (!gone) ps.dispose();
      this.expiring.splice(k, 1);
    }
  }

  private burst(at: Vector3, o: BurstOptions): void {
    const ps = new ParticleSystem('burst', o.count, this.scene);
    ps.particleTexture = this.dot;
    ps.emitter = at.clone();
    if (o.cone) ps.createConeEmitter(o.radius, 0.45);
    else ps.createSphereEmitter(o.radius, 1);
    [ps.color1, ps.color2, ps.colorDead] = o.colors;
    [ps.minSize, ps.maxSize] = o.size;
    [ps.minLifeTime, ps.maxLifeTime] = o.life;
    [ps.minEmitPower, ps.maxEmitPower] = o.power;
    ps.gravity = new Vector3(0, o.gravity, 0);
    ps.manualEmitCount = o.count;
    ps.minAngularSpeed = -2;
    ps.maxAngularSpeed = 2;
    if (o.grow) {
      ps.addSizeGradient(0, 1);
      ps.addSizeGradient(1, o.grow);
    }
    ps.blendMode = o.additive ? ParticleSystem.BLENDMODE_ADD : ParticleSystem.BLENDMODE_STANDARD;
    ps.targetStopDuration = 0.1;
    ps.disposeOnStop = true;
    ps.start();
    this.retire(ps, o.life[1]);
  }

  private ring(x: number, y: number, radius: number): void {
    const ring = MeshBuilder.CreateTorus('shockwave', { diameter: 1, thickness: 0.06, tessellation: 40 }, this.scene);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, y, -1);
    const m = new StandardMaterial('shockMat', this.scene);
    m.emissiveColor = new Color3(1, 0.85, 0.6);
    m.disableLighting = true;
    ring.material = m;
    let t = 0;
    this.transients.push({
      update: (dt) => {
        t += dt / 0.35;
        ring.scaling.setAll(0.5 + t * radius * 2.4);
        m.alpha = Math.max(0, 1 - t);
        return t < 1;
      },
      dispose: () => {
        ring.dispose();
        m.dispose();
      },
    });
  }
}
