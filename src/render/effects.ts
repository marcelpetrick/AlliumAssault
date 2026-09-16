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

/** Explosions, splashes, tracers, projectile models and the aiming reticle. */
export class Effects {
  private readonly dot: Texture;
  private readonly transients: Transient[] = [];
  private readonly flash: PointLight;
  private flashLevel = 0;
  private readonly projectiles = new Map<number, ProjectileView>();
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
      metal: mat('fxMetal', '#9aa3ad'),
      reticle: mat('fxReticle', '#ff3b3b', 1),
      tracer: mat('fxTracer', '#ffe27a', 1),
    };

    this.reticle = MeshBuilder.CreateTorus('reticle', { diameter: 0.55, thickness: 0.07, tessellation: 24 }, scene);
    this.reticle.rotation.x = Math.PI / 2;
    this.reticle.material = this.materials.reticle;
    this.reticle.isPickable = false;
    glow(this.reticle);
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
      if (p.weapon !== 'bazooka') view.node.rotation.z -= p.vx * dt * 2;
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
    this.flashLevel *= Math.exp(-dt * 9);
    this.flash.intensity = this.flashLevel;
    for (let k = this.transients.length - 1; k >= 0; k--) {
      if (!this.transients[k].update(dt)) {
        this.transients[k].dispose();
        this.transients.splice(k, 1);
      }
    }
  }

  private createMissile(): ProjectileView {
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
        return this.createMissile();
      case 'cluster':
        return this.createGrenade(this.materials.cluster);
      case 'bomblet':
        return this.createBomblet();
      default:
        return this.createGrenade(this.materials.bomb);
    }
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
