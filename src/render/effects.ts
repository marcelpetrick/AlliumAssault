import { Color3, Color4, Mesh, MeshBuilder, ParticleSystem, PointLight, StandardMaterial, TransformNode, Vector3, type Scene, type Texture } from '@babylonjs/core';
import { MUZZLE_OFFSET } from '../core/constants';
import type { Game } from '../core/game';
import type { WeaponId } from '../core/weapons';
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

const CHARGE_DOTS = 14;

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

interface CrateView {
  node: TransformNode;
  age: number;
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
  private readonly strikeCursor: Mesh;
  private flame: ParticleSystem | null = null;
  private readonly reticle: Mesh;
  private readonly chargeDots: Mesh[] = [];
  private readonly materials: Record<string, StandardMaterial>;

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
      banana: mat('fxBanana', '#ffd83a', 0.25),
      bananaTip: mat('fxBananaTip', '#5a4020'),
      metal: mat('fxMetal', '#9aa3ad'),
      wool: mat('fxWool', '#f4f1ea', 0.25),
      crateWood: mat('fxCrateWood', '#b07a45', 0.08),
      crateBand: mat('fxCrateBand', '#5a3b22'),
      medWhite: mat('fxMedWhite', '#f5f5f2', 0.2),
      medRed: mat('fxMedRed', '#e12b2b', 0.4),
      sheepFace: mat('fxSheepFace', '#2b2522'),
      reticle: mat('fxReticle', '#ff3b3b', 1),
      tracer: mat('fxTracer', '#ffe27a', 1),
    };

    this.strikeCursor = MeshBuilder.CreateTorus('strikeCursor', { diameter: 1.2, thickness: 0.09, tessellation: 32 }, scene);
    this.strikeCursor.rotation.x = Math.PI / 2;
    this.strikeCursor.isPickable = false;
    const beam = MeshBuilder.CreateCylinder('strikeBeam', { height: 30, diameter: 0.05, tessellation: 6 }, scene);
    beam.parent = this.strikeCursor;
    beam.rotation.x = -Math.PI / 2;
    beam.position.z = -15;
    beam.isPickable = false;
    this.strikeCursor.setEnabled(false);

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

  explosion(x: number, y: number, radius: number, debris: Color3): void {
    const r = radius / 2.8;
    const at = new Vector3(x, y, -0.6);
    this.burst(at, {
      count: Math.round(80 * r) + 10,
      colors: [new Color4(1, 0.9, 0.45, 1), new Color4(1, 0.45, 0.08, 1), new Color4(0.35, 0.05, 0, 0)],
      size: [0.7 * r + 0.3, 1.9 * r + 0.4],
      life: [0.22, 0.5],
      power: [2.5 * r, 9 * r],
      radius: 0.4 * r,
      gravity: 3,
      additive: true,
      grow: 1.6,
    });
    this.burst(at, {
      count: Math.round(40 * r) + 6,
      colors: [new Color4(0.42, 0.4, 0.38, 0.75), new Color4(0.25, 0.24, 0.24, 0.6), new Color4(0.15, 0.15, 0.15, 0)],
      size: [1.2 * r + 0.3, 2.8 * r + 0.4],
      life: [0.9, 1.9],
      power: [0.8, 3 * r],
      radius: 0.8 * r,
      gravity: 2.5,
      additive: false,
      grow: 2,
    });
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
        view = this.createProjectile(p.weapon);
        this.projectiles.set(p.id, view);
      }
      view.node.position.set(p.x, p.y, 0);
      if (p.weapon !== 'bazooka' && p.weapon !== 'airbomb') view.node.rotation.z -= p.vx * dt * 2;
      else view.node.rotation.z = Math.atan2(p.vy, p.vx);
    }
    for (const [id, view] of this.projectiles) {
      if (live.has(id)) continue;
      if (view.trail) {
        view.trail.emitter = view.node.position.clone();
        view.trail.stop();
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

  /** Blowtorch flame at the nozzle while the torch burns. */
  updateTorch(game: Game): void {
    const b = game.activeBuddy;
    if (!game.torch || !b) {
      this.flame?.stop();
      return;
    }
    if (!this.flame) {
      const ps = new ParticleSystem('torchFlame', 400, this.scene);
      ps.particleTexture = this.dot;
      ps.emitter = new Vector3();
      ps.createPointEmitter(new Vector3(0.8, -0.3, -0.3), new Vector3(1.6, 0.3, 0.3));
      ps.emitRate = 160;
      ps.minLifeTime = 0.08;
      ps.maxLifeTime = 0.22;
      ps.minSize = 0.2;
      ps.maxSize = 0.55;
      ps.minEmitPower = 2;
      ps.maxEmitPower = 4;
      ps.addColorGradient(0, new Color4(0.7, 0.85, 1, 1));
      ps.addColorGradient(0.3, new Color4(1, 0.75, 0.25, 1));
      ps.addColorGradient(1, new Color4(1, 0.25, 0.05, 0));
      ps.blendMode = ParticleSystem.BLENDMODE_ADD;
      this.flame = ps;
    }
    const ps = this.flame;
    const nozzle = ps.emitter as Vector3;
    nozzle.set(b.body.x + b.facing * 0.75, b.body.y + 0.05, -0.5);
    ps.direction1.set(b.facing * 0.8, -0.3, -0.3);
    ps.direction2.set(b.facing * 1.6, 0.3, 0.3);
    if (!ps.isStarted()) ps.start();
    this.flashLevel = Math.max(this.flashLevel, 1.2);
    this.flash.position.set(nozzle.x, nozzle.y, -1.5);
    this.flash.range = 6;
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
    const fuselage = part(MeshBuilder.CreateCylinder('fuselage', { height: 3.2, diameterTop: 0.35, diameterBottom: 0.6, tessellation: 14 }, this.scene), this.materials.olive, 0, 0);
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
    view.node.scaling.x = s.facing;
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
    view.node.scaling.set(left ? -1.4 : 1.4, 1.4, 1.4);
    view.body.rotation.z = left ? Math.PI - f.angle : f.angle;
    view.body.rotation.x = Math.sin(time * 18) * 0.08;
  }

  updateAim(game: Game, time: number): void {
    const b = game.activeBuddy;
    const show = !!b && b.alive && game.phase === 'aiming';
    this.reticle.setEnabled(show);
    if (!show || !b) {
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

  private createProjectile(weapon: WeaponId): ProjectileView {
    switch (weapon) {
      case 'bazooka':
        return this.createMissile(true);
      case 'airbomb':
        return this.createMissile(false);
      case 'cluster':
        return this.createGrenade(this.materials.cluster);
      case 'holy':
        return this.createHolyGrenade();
      case 'banana':
        return this.createBanana(1.4);
      case 'bananalet':
        return this.createBanana(0.9);
      case 'bomblet':
        return this.createBomblet();
      default:
        return this.createGrenade(this.materials.bomb);
    }
  }

  private createCrate(kind: 'health' | 'weapon'): TransformNode {
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
    for (const [x, y, z] of [[-0.25, 0.2, 0], [0, 0.26, -0.1], [0.22, 0.2, 0.05], [-0.1, 0.12, -0.22], [0.12, 0.08, 0.22], [-0.32, 0.02, 0.1]]) {
      part(MeshBuilder.CreateSphere('puff', { diameter: 0.26, segments: 8 }, this.scene), this.materials.wool, x, y, z);
    }
    part(MeshBuilder.CreateSphere('head', { diameterX: 0.26, diameterY: 0.24, diameterZ: 0.22, segments: 10 }, this.scene), this.materials.sheepFace, 0.4, 0.14);
    for (const z of [-0.09, 0.09]) {
      const ear = part(MeshBuilder.CreateSphere('ear', { diameterX: 0.14, diameterY: 0.05, diameterZ: 0.08, segments: 6 }, this.scene), this.materials.sheepFace, 0.36, 0.22, z);
      ear.rotation.x = z * 4;
      part(MeshBuilder.CreateSphere('sheepEye', { diameter: 0.05, segments: 6 }, this.scene), this.materials.wool, 0.5, 0.18, z * 0.6 - 0.05);
    }
    const legs = [-0.18, 0.18].flatMap((x) =>
      [-0.12, 0.12].map((z) => {
        const leg = part(MeshBuilder.CreateCylinder('leg', { height: 0.22, diameter: 0.06, tessellation: 6 }, this.scene), this.materials.sheepFace, x, -0.24, z);
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
    const body = MeshBuilder.CreateTube('bananaBody', { path, radiusFunction: (i) => 0.035 + Math.sin((i / 12) * Math.PI) * 0.07, tessellation: 10, cap: Mesh.CAP_ALL }, this.scene);
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
