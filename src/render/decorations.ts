import { Color3, Matrix, Mesh, MeshBuilder, Quaternion, StandardMaterial, Vector3, VertexBuffer, type Scene } from '@babylonjs/core';
import { mulberry32 } from '../core/rng';
import type { Terrain } from '../core/terrain';
import type { Theme } from './themes';

interface Placement {
  kind: number;
  index: number;
  x: number;
  y: number;
  matrix: Matrix;
}

/**
 * Non-colliding props on top surfaces: grass tufts, flowers, pebbles, mushrooms and
 * little garlic sprouts. Props caught in an explosion are removed.
 */
export class Decorations {
  private readonly templates: Mesh[] = [];
  private readonly placements: Placement[] = [];
  private readonly material: StandardMaterial;

  constructor(
    scene: Scene,
    private readonly terrain: Terrain,
    theme: Theme,
    seed: number,
  ) {
    this.material = new StandardMaterial('decoMat', scene);
    this.material.specularColor = new Color3(0.05, 0.05, 0.05);
    this.material.backFaceCulling = false;

    this.templates = [
      this.grass(scene, theme),
      this.flower(scene, new Color3(1, 0.85, 0.3)),
      this.flower(scene, new Color3(0.95, 0.45, 0.7)),
      this.pebble(scene, theme),
      this.mushroom(scene),
      this.sprout(scene, theme),
    ];
    const weights = [0.5, 0.1, 0.1, 0.12, 0.08, 0.1];

    const rng = mulberry32(seed);
    const buckets: Matrix[][] = this.templates.map(() => []);
    for (let x = 2; x < terrain.width - 2; x += 0.55 + rng() * 0.7) {
      for (let y = terrain.height - 2; y > terrain.waterLevel + 0.6; y -= 0.25) {
        if (terrain.sample(x, y) > 0 || terrain.sample(x, y - 0.25) <= 0) continue;
        if (terrain.normal(x, y - 0.1).y < 0.7) continue;
        let pick = rng();
        let kind = 0;
        while (kind < weights.length - 1 && pick > weights[kind]) pick -= weights[kind++];
        const front = kind === 0 && rng() < 0.35;
        const z = front ? -2.9 + rng() * 1.2 : 0.9 + rng() * 2.1;
        const s = 0.7 + rng() * 0.6;
        const matrix = Matrix.Compose(new Vector3(s, s, s), Quaternion.RotationAxis(Vector3.Up(), rng() * 6.28), new Vector3(x, y - 0.12, z));
        this.placements.push({ kind, index: buckets[kind].length, x, y, matrix });
        buckets[kind].push(matrix);
        break;
      }
    }
    this.templates.forEach((mesh, kind) => {
      const matrices = new Float32Array(Math.max(buckets[kind].length, 1) * 16);
      buckets[kind].forEach((m, n) => m.copyToArray(matrices, n * 16));
      mesh.thinInstanceSetBuffer('matrix', matrices, 16, false);
    });
  }

  /** Hide props within `radius` of an explosion or floating after terrain loss. */
  clearAround(x: number, y: number, radius: number): void {
    const hidden = Matrix.Scaling(0, 0, 0);
    for (const p of this.placements) {
      if (Math.hypot(p.x - x, p.y - y) < radius + 0.6 || this.terrain.sample(p.x, p.y - 0.3) <= 0) {
        this.templates[p.kind].thinInstanceSetMatrixAt(p.index, hidden, true);
      }
    }
  }

  dispose(): void {
    for (const t of this.templates) t.dispose();
    this.material.dispose();
  }

  private finish(parts: Mesh[], name: string, colors: Color3[]): Mesh {
    parts.forEach((m, k) => {
      const c = colors[k];
      const n = m.getTotalVertices();
      const data = new Float32Array(n * 4);
      for (let v = 0; v < n; v++) data.set([c.r, c.g, c.b, 1], v * 4);
      m.setVerticesData(VertexBuffer.ColorKind, data);
    });
    const mesh = Mesh.MergeMeshes(parts, true)!;
    mesh.name = name;
    mesh.material = this.material;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    return mesh;
  }

  private grass(scene: Scene, theme: Theme): Mesh {
    const blades = [-0.12, 0, 0.12].map((dx, k) => {
      const b = MeshBuilder.CreateCylinder('blade', { height: 0.45 + k * 0.08, diameterTop: 0, diameterBottom: 0.09, tessellation: 3 }, scene);
      b.position.set(dx, 0.22, (k - 1) * 0.05);
      b.rotation.z = -dx * 2.2;
      return b;
    });
    return this.finish(blades, 'grass', [theme.grass, theme.grassDark, theme.grass.scale(1.1)]);
  }

  private flower(scene: Scene, petal: Color3): Mesh {
    const stem = MeshBuilder.CreateCylinder('stem', { height: 0.45, diameter: 0.035, tessellation: 4 }, scene);
    stem.position.y = 0.22;
    const head = MeshBuilder.CreateIcoSphere('petals', { radius: 0.12, subdivisions: 1 }, scene);
    head.position.y = 0.47;
    head.scaling.z = 0.4;
    const centre = MeshBuilder.CreateIcoSphere('centre', { radius: 0.05, subdivisions: 1 }, scene);
    centre.position.set(0, 0.47, -0.05);
    return this.finish([stem, head, centre], 'flower', [new Color3(0.3, 0.6, 0.25), petal, new Color3(1, 0.95, 0.6)]);
  }

  private pebble(scene: Scene, theme: Theme): Mesh {
    const rock = MeshBuilder.CreateIcoSphere('pebble', { radius: 0.22, subdivisions: 1 }, scene);
    rock.scaling.set(1.3, 0.6, 1);
    rock.position.y = 0.06;
    const small = MeshBuilder.CreateIcoSphere('pebble2', { radius: 0.12, subdivisions: 1 }, scene);
    small.position.set(0.3, 0.03, 0.1);
    return this.finish([rock, small], 'pebble', [Color3.Lerp(theme.rock, new Color3(0.6, 0.6, 0.6), 0.5), theme.rockDark]);
  }

  private mushroom(scene: Scene): Mesh {
    const stem = MeshBuilder.CreateCylinder('mstem', { height: 0.28, diameterTop: 0.08, diameterBottom: 0.12, tessellation: 6 }, scene);
    stem.position.y = 0.14;
    const cap = MeshBuilder.CreateSphere('cap', { diameter: 0.34, segments: 6, slice: 0.5 }, scene);
    cap.position.y = 0.26;
    const spot = MeshBuilder.CreateIcoSphere('spot', { radius: 0.045, subdivisions: 1 }, scene);
    spot.position.set(0.05, 0.38, -0.1);
    return this.finish([stem, cap, spot], 'mushroom', [new Color3(0.95, 0.9, 0.8), new Color3(0.85, 0.2, 0.18), Color3.White()]);
  }

  private sprout(scene: Scene, theme: Theme): Mesh {
    const bulb = MeshBuilder.CreateSphere('bulb', { diameter: 0.28, segments: 8 }, scene);
    bulb.position.y = 0.1;
    bulb.scaling.y = 0.8;
    const leafA = MeshBuilder.CreateCylinder('leafA', { height: 0.6, diameterTop: 0, diameterBottom: 0.06, tessellation: 4 }, scene);
    leafA.position.set(-0.05, 0.45, 0);
    leafA.rotation.z = 0.25;
    const leafB = leafA.clone('leafB');
    leafB.position.x = 0.05;
    leafB.rotation.z = -0.3;
    return this.finish([bulb, leafA, leafB], 'sprout', [new Color3(0.97, 0.94, 0.88), theme.grassDark, theme.grass]);
  }
}
