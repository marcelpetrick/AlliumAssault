import { Color3, Mesh, MeshBuilder, StandardMaterial, TransformNode, Vector3, VertexBuffer, VertexData, type Scene } from '@babylonjs/core';
import type { Buddy, Game } from '../core/game';
import { clamp } from '../core/math';
import type { WeaponId } from '../core/weapons';

/** Materials shared by every garlic buddy in a scene. */
export class BuddyKit {
  readonly skin: StandardMaterial;
  readonly eyeWhite: StandardMaterial;
  readonly pupil: StandardMaterial;
  readonly sprout: StandardMaterial;
  readonly cheek: StandardMaterial;
  readonly metal: StandardMaterial;
  readonly olive: StandardMaterial;
  readonly wood: StandardMaterial;
  readonly glove: StandardMaterial;
  readonly bomb: StandardMaterial;

  constructor(readonly scene: Scene) {
    const mat = (name: string, color: string, spec = 0.2, emissive = 0) => {
      const m = new StandardMaterial(name, scene);
      m.diffuseColor = Color3.FromHexString(color);
      m.specularColor = new Color3(spec, spec, spec);
      m.emissiveColor = m.diffuseColor.scale(emissive);
      return m;
    };
    this.skin = mat('skin', '#ffffff', 0.35, 0.08);
    this.skin.specularPower = 40;
    this.eyeWhite = mat('eyeWhite', '#ffffff', 0.6, 0.35);
    this.pupil = mat('pupil', '#1a1420', 0.9);
    this.sprout = mat('sprout', '#5dbb46', 0.15, 0.1);
    this.cheek = mat('cheek', '#ff8fa3', 0.1, 0.25);
    this.metal = mat('metal', '#5b6470', 0.8);
    this.olive = mat('olive', '#58703a', 0.3);
    this.wood = mat('wood', '#7a4e2c', 0.1);
    this.glove = mat('glove', '#e0322f', 0.5, 0.1);
    this.bomb = mat('bomb', '#2f4a2a', 0.6);
  }

  teamMaterial(color: Color3): StandardMaterial {
    const m = new StandardMaterial('bandana', this.scene);
    m.diffuseColor = color;
    m.specularColor = new Color3(0.25, 0.25, 0.25);
    m.emissiveColor = color.scale(0.15);
    return m;
  }
}

/** Lathe-modelled garlic bulb with clove ridges and a lavender blush. */
function createBulb(scene: Scene, material: StandardMaterial): Mesh {
  const profile = [
    [0, -0.6],
    [0.3, -0.58],
    [0.55, -0.45],
    [0.66, -0.2],
    [0.65, 0.08],
    [0.55, 0.38],
    [0.38, 0.66],
    [0.2, 0.88],
    [0.08, 1.02],
    [0.035, 1.12],
  ].map(([r, y]) => new Vector3(r, y, 0));
  const mesh = MeshBuilder.CreateLathe('bulb', { shape: profile, tessellation: 36, closed: true }, scene);
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
  const colors = new Float32Array((positions.length / 3) * 4);
  const ivory = new Color3(0.98, 0.95, 0.88);
  const lavender = new Color3(0.82, 0.68, 0.9);
  for (let v = 0; v < positions.length / 3; v++) {
    const x = positions[v * 3];
    const y = positions[v * 3 + 1];
    const z = positions[v * 3 + 2];
    const angle = Math.atan2(z, x);
    const ridge = Math.cos(angle * 6);
    const bump = 1 + 0.055 * ridge;
    positions[v * 3] = x * bump;
    positions[v * 3 + 2] = z * bump;
    const blush = clamp((y - 0.35) / 0.7, 0, 1) * 0.55 + clamp(-ridge - 0.6, 0, 1) * 0.6;
    const c = Color3.Lerp(ivory, lavender, clamp(blush, 0, 0.85));
    colors.set([c.r, c.g, c.b, 1], v * 4);
  }
  const indices = mesh.getIndices()!;
  const normals = new Float32Array(positions.length);
  VertexData.ComputeNormals(positions, indices, normals);
  mesh.updateVerticesData(VertexBuffer.PositionKind, positions);
  mesh.updateVerticesData(VertexBuffer.NormalKind, normals);
  mesh.setVerticesData(VertexBuffer.ColorKind, colors);
  mesh.material = material;
  return mesh;
}

export class BuddyView {
  readonly root: TransformNode;
  private readonly body: TransformNode;
  private readonly weaponPivot: TransformNode;
  private readonly weapons: Partial<Record<WeaponId, TransformNode>>;
  private readonly eyes: Mesh[] = [];
  private readonly pupils: Mesh[] = [];
  private readonly feet: Mesh[] = [];
  private readonly meshes: Mesh[] = [];
  private yaw = 0;
  private squash = 0;
  private walkPhase = 0;
  private blinkIn = 2 + Math.random() * 3;
  private hurtTime = 0;
  private visible = true;

  constructor(
    scene: Scene,
    readonly buddy: Buddy,
    kit: BuddyKit,
    teamColor: Color3,
    addCaster: (mesh: Mesh) => void,
  ) {
    this.root = new TransformNode(`buddy-${buddy.id}`, scene);
    this.body = new TransformNode('body', scene);
    this.body.parent = this.root;
    this.body.position.y = -0.6;
    const attach = (m: Mesh, parent: TransformNode = this.body) => {
      m.parent = parent;
      m.isPickable = false;
      m.receiveShadows = true;
      addCaster(m);
      this.meshes.push(m);
      return m;
    };
    const place = (m: Mesh, x: number, y: number, z: number) => {
      m.position.set(x, y + 0.6, z);
      return m;
    };

    attach(place(createBulb(scene, kit.skin), 0, 0, 0));

    const sprout = attach(place(MeshBuilder.CreateCylinder('sprout', { height: 0.55, diameterTop: 0.02, diameterBottom: 0.1, tessellation: 8 }, scene), 0.04, 1.35, 0));
    sprout.rotation.z = -0.3;
    sprout.material = kit.sprout;
    const leaf = attach(place(MeshBuilder.CreateSphere('leaf', { diameter: 1, segments: 8 }, scene), -0.12, 1.3, 0));
    leaf.scaling.set(0.1, 0.34, 0.05);
    leaf.rotation.z = 0.7;
    leaf.material = kit.sprout;

    const bandana = attach(place(MeshBuilder.CreateTorus('bandana', { diameter: 1.02, thickness: 0.13, tessellation: 36 }, scene), 0, 0.48, 0));
    bandana.rotation.x = 0.1;
    bandana.scaling.y = 1.3;
    const teamMat = kit.teamMaterial(teamColor);
    bandana.material = teamMat;
    [0.18, -0.12].forEach((tilt, k) => {
      const tail = attach(place(MeshBuilder.CreateSphere('tail', { diameter: 1, segments: 8 }, scene), 0.5 + k * 0.1, 0.42 - k * 0.14, 0.2));
      tail.scaling.set(0.14, 0.3, 0.07);
      tail.rotation.z = -1 + tilt;
      tail.material = teamMat;
    });

    [-1, 1].forEach((side) => {
      const eye = attach(place(MeshBuilder.CreateSphere('eye', { diameter: 0.3, segments: 12 }, scene), side * 0.19, 0.2, -0.5));
      eye.scaling.set(0.9, 1.15, 0.8);
      eye.material = kit.eyeWhite;
      this.eyes.push(eye);
      const pupil = attach(MeshBuilder.CreateSphere('pupil', { diameter: 0.14, segments: 10 }, scene), eye);
      pupil.position.set(0, 0.01, -0.12);
      pupil.material = kit.pupil;
      this.pupils.push(pupil);
      const cheek = attach(place(MeshBuilder.CreateSphere('cheek', { diameter: 0.17, segments: 8 }, scene), side * 0.36, -0.02, -0.52));
      cheek.scaling.set(1, 0.6, 0.4);
      cheek.material = kit.cheek;
      const foot = attach(place(MeshBuilder.CreateSphere('foot', { diameter: 0.3, segments: 10 }, scene), side * 0.26, -0.56, -0.05));
      foot.scaling.set(1, 0.5, 1.35);
      foot.material = kit.skin;
      this.feet.push(foot);
    });

    const smile: Vector3[] = [];
    for (let a = -1; a <= 1.001; a += 0.2) smile.push(new Vector3(Math.sin(a) * 0.13, -0.04 - Math.cos(a) * 0.05 + 0.6, -0.625));
    const mouth = attach(MeshBuilder.CreateTube('mouth', { path: smile, radius: 0.022, tessellation: 6 }, scene));
    mouth.material = kit.pupil;

    this.weaponPivot = new TransformNode('weaponPivot', scene);
    this.weaponPivot.parent = this.root;
    this.weaponPivot.position.y = 0.05;
    this.weapons = {
      bazooka: this.buildWeapon(scene, attach, [
        [MeshBuilder.CreateCylinder('tube', { height: 1.4, diameter: 0.24, tessellation: 14 }, scene), kit.olive, [0.35, 0, 0], true],
        [MeshBuilder.CreateTorus('rim', { diameter: 0.28, thickness: 0.06, tessellation: 14 }, scene), kit.glove, [1.02, 0, 0], true],
        [MeshBuilder.CreateBox('grip', { width: 0.1, height: 0.25, depth: 0.1 }, scene), kit.wood, [0.2, -0.18, 0], false],
      ]),
      grenade: this.buildWeapon(scene, attach, [
        [MeshBuilder.CreateSphere('grenade', { diameter: 0.34, segments: 12 }, scene), kit.bomb, [0.6, 0, 0], false],
        [MeshBuilder.CreateTorus('pin', { diameter: 0.12, thickness: 0.025, tessellation: 10 }, scene), kit.metal, [0.6, 0.2, 0], false],
      ]),
      cluster: this.buildWeapon(scene, attach, [
        [MeshBuilder.CreateSphere('cluster', { diameter: 0.36, segments: 12 }, scene), kit.glove, [0.6, 0, 0], false],
        [MeshBuilder.CreateTorus('pin', { diameter: 0.12, thickness: 0.025, tessellation: 10 }, scene), kit.metal, [0.6, 0.21, 0], false],
      ]),
      shotgun: this.buildWeapon(scene, attach, [
        [MeshBuilder.CreateCylinder('barrel', { height: 1.1, diameter: 0.1, tessellation: 10 }, scene), kit.metal, [0.5, 0.03, 0], true],
        [MeshBuilder.CreateBox('stock', { width: 0.45, height: 0.18, depth: 0.12 }, scene), kit.wood, [0.02, -0.03, 0], false],
      ]),
      punch: this.buildWeapon(scene, attach, [
        [MeshBuilder.CreateSphere('glove', { diameter: 0.42, segments: 12 }, scene), kit.glove, [0.62, 0, 0], false],
        [MeshBuilder.CreateCylinder('cuff', { height: 0.16, diameter: 0.28, tessellation: 12 }, scene), kit.eyeWhite, [0.38, 0, 0], true],
      ]),
    };
    this.update(null, 0, 0);
  }

  private buildWeapon(
    scene: Scene,
    attach: (m: Mesh, parent?: TransformNode) => Mesh,
    parts: [Mesh, StandardMaterial, [number, number, number], boolean][],
  ): TransformNode {
    const node = new TransformNode('weapon', scene);
    node.parent = this.weaponPivot;
    for (const [mesh, material, [x, y, z], alongX] of parts) {
      attach(mesh, node);
      mesh.material = material;
      mesh.position.set(x, y, z - 0.35);
      if (alongX) mesh.rotation.z = Math.PI / 2;
    }
    node.setEnabled(false);
    return node;
  }

  onLand(speed: number): void {
    this.squash = Math.min(0.35, speed * 0.025);
  }

  onHurt(): void {
    this.hurtTime = 0.45;
  }

  hide(): void {
    this.visible = false;
    this.root.setEnabled(false);
  }

  update(game: Game | null, dt: number, time: number): void {
    const b = this.buddy;
    if (!b.alive && this.visible) this.hide();
    if (!this.visible) return;
    this.root.position.set(b.body.x, b.body.y, 0);

    const isActive = game?.activeBuddy === b;
    const targetYaw = isActive || b.walking ? -b.facing * 0.75 : -b.facing * 0.35;
    this.yaw += (targetYaw - this.yaw) * (1 - Math.exp(-dt * 10));
    this.body.rotation.y = this.yaw;

    // Squash & stretch, walking bob, idle breathing.
    this.squash *= Math.exp(-dt * 9);
    let sx = 1 + this.squash;
    let sy = 1 - this.squash;
    if (!b.body.grounded) {
      const stretch = clamp(Math.abs(b.body.vy) * 0.012, 0, 0.14);
      sx -= stretch * 0.6;
      sy += stretch;
    }
    if (b.walking) this.walkPhase += dt * 13;
    const breathe = Math.sin(time * 2.4 + b.id) * 0.025;
    this.body.scaling.set(sx - breathe * 0.5, sy + breathe, sx - breathe * 0.5);
    this.body.position.y = -0.6 + (b.walking ? Math.abs(Math.sin(this.walkPhase)) * 0.09 : 0);
    this.body.rotation.z = b.walking ? Math.sin(this.walkPhase) * 0.07 : 0;
    this.feet.forEach((foot, k) => {
      foot.position.z = -0.05 + (b.walking ? Math.sin(this.walkPhase + k * Math.PI) * 0.16 : 0);
    });

    // Blinking and hurt wince.
    this.blinkIn -= dt;
    const blinking = this.blinkIn < 0.12 || this.hurtTime > 0;
    if (this.blinkIn < 0) this.blinkIn = 2 + Math.random() * 3.5;
    this.hurtTime = Math.max(0, this.hurtTime - dt);
    for (const eye of this.eyes) eye.scaling.y = blinking ? 0.15 : 1.15;
    for (const pupil of this.pupils) pupil.position.x = b.facing * 0.03;
    this.root.rotation.z = this.hurtTime > 0 ? Math.sin(time * 60) * 0.12 : 0;

    const showWeapon = !!game && isActive && (game.phase === 'aiming' || game.phase === 'turnStart');
    for (const [id, node] of Object.entries(this.weapons)) node.setEnabled(showWeapon && game?.weapon === id);
    this.weaponPivot.rotation.z = b.facing > 0 ? b.aim : Math.PI - b.aim;
    this.weaponPivot.rotation.x = b.facing > 0 ? 0 : Math.PI;
  }

  dispose(): void {
    this.root.dispose(false, false);
  }
}
