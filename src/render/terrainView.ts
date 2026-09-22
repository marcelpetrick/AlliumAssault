// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

import type { Scene } from '@babylonjs/core/scene';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { createNoise2D } from 'simplex-noise';
import { contourRegion } from '../core/contour';
import { clamp, smoothstep } from '../core/math';
import { mulberry32 } from '../core/rng';
import { CHUNK_CELLS, type Terrain } from '../core/terrain';
import { createGrainTexture, createRockNormalTexture } from './textures';
import type { Theme } from './themes';

/** Half thickness of the terrain slab along z. */
export const TERRAIN_DEPTH = 3.2;
const BULGE = 0.9;
const BULGE_K = 1.4;
const WALL_RINGS = [-TERRAIN_DEPTH, -TERRAIN_DEPTH + 0.5, TERRAIN_DEPTH - 0.5, TERRAIN_DEPTH];
/** The walled arena's barriers: how thick they stand and how far above the map they reach. */
const BARRIER_THICKNESS = 1.6;
const BARRIER_HEADROOM = 26;

/**
 * Renders the density field as chunked 3D slabs: a pillowy front face from the
 * marching-squares triangles and rounded walls extruded from the contour edges.
 * Only chunks marked dirty by the simulation are rebuilt.
 */
export class TerrainView {
  private readonly chunks = new Map<number, Mesh>();
  private readonly barriers: Mesh[] = [];
  private readonly material: StandardMaterial;
  private readonly strata = createNoise2D(mulberry32(7));
  private readonly speck = createNoise2D(mulberry32(8));

  constructor(
    private readonly scene: Scene,
    private readonly terrain: Terrain,
    private readonly theme: Theme,
    private readonly onChunk: (mesh: Mesh) => void,
  ) {
    const mat = new StandardMaterial('terrain', scene);
    mat.diffuseTexture = createGrainTexture(scene);
    mat.bumpTexture = createRockNormalTexture(scene);
    mat.bumpTexture.level = 0.55;
    mat.specularColor = new Color3(0.07, 0.07, 0.06);
    mat.specularPower = 24;
    mat.backFaceCulling = false;
    this.material = mat;
    if (terrain.walled) this.buildBarriers();
    this.update();
  }

  /**
   * The two slabs that make a walled arena look walled. They are decoration: the wall that stops
   * things is in `Terrain.sample()`, which every collision goes through, so the mesh only has to
   * stand where that wall already is.
   */
  private buildBarriers(): void {
    const t = this.terrain;
    const height = t.height - t.waterLevel + BARRIER_HEADROOM;
    const barrier = new StandardMaterial('barrier', this.scene);
    barrier.diffuseColor = this.theme.dirt.scale(0.55);
    barrier.emissiveColor = this.theme.dirt.scale(0.12);
    barrier.specularColor = new Color3(0.1, 0.1, 0.12);
    for (const side of [-1, 1]) {
      const wall = MeshBuilder.CreateBox('barrier', { width: BARRIER_THICKNESS, height, depth: TERRAIN_DEPTH * 2 }, this.scene);
      wall.position.set(side < 0 ? -BARRIER_THICKNESS / 2 : t.width + BARRIER_THICKNESS / 2, t.waterLevel + height / 2, 0);
      wall.material = barrier;
      wall.isPickable = false;
      this.onChunk(wall);
      this.barriers.push(wall);
    }
  }

  update(): void {
    if (!this.terrain.dirty.size) return;
    for (const id of this.terrain.dirty) this.rebuild(id);
    this.terrain.dirty.clear();
  }

  dispose(): void {
    for (const mesh of this.chunks.values()) mesh.dispose();
    for (const wall of this.barriers) wall.dispose();
    this.material.dispose(true, true);
  }

  private rebuild(id: number): void {
    const t = this.terrain;
    const cx = id % t.chunksX;
    const cy = Math.floor(id / t.chunksX);
    const i0 = cx * CHUNK_CELLS;
    const j0 = cy * CHUNK_CELLS;
    const geo = contourRegion(t.field, t.nx, i0, j0, Math.min(i0 + CHUNK_CELLS, t.nx - 1), Math.min(j0 + CHUNK_CELLS, t.ny - 1));
    let mesh = this.chunks.get(id);
    if (!geo.triangles.length) {
      mesh?.dispose();
      this.chunks.delete(id);
      return;
    }

    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const push = (x: number, y: number, z: number, nx: number, ny: number, nz: number, u: number, v: number) => {
      const len = Math.hypot(nx, ny, nz) || 1;
      positions.push(x, y, z);
      normals.push(nx / len, ny / len, nz / len);
      uvs.push(u, v);
      const c = this.colorAt(x, y);
      colors.push(c.r, c.g, c.b, 1);
      return positions.length / 3 - 1;
    };

    // Front face: bulges towards the camera the deeper inside the rock it is.
    const tri = geo.triangles;
    for (let k = 0; k < tri.length; k += 6) {
      const ids: number[] = [];
      for (let v = 0; v < 3; v++) {
        const x = tri[k + v * 2];
        const y = tri[k + v * 2 + 1];
        const f = Math.max(0, t.sample(x, y));
        const e = Math.exp(-f * BULGE_K);
        const slope = BULGE * BULGE_K * e;
        const g = t.gradient(x, y);
        ids.push(push(x, y, -TERRAIN_DEPTH - BULGE * (1 - e), -slope * g.x, -slope * g.y, -1, x * 0.3, y * 0.3));
      }
      indices.push(ids[0], ids[2], ids[1]);
    }

    // Walls: rings along z with normals bending into the front and back faces.
    const edges = geo.edges;
    for (let k = 0; k < edges.length; k += 4) {
      const ends = [
        [edges[k], edges[k + 1]],
        [edges[k + 2], edges[k + 3]],
      ];
      const ringIds: number[][] = [[], []];
      ends.forEach(([x, y], e) => {
        const g = t.gradient(x, y);
        const gl = Math.hypot(g.x, g.y) || 1;
        const ox = -g.x / gl;
        const oy = -g.y / gl;
        const bend = BULGE * BULGE_K;
        const ringNormals = [
          [ox * bend, oy * bend, -1],
          [ox, oy, -0.25],
          [ox, oy, 0.25],
          [ox * bend, oy * bend, 1],
        ];
        WALL_RINGS.forEach((z, r) => {
          const n = ringNormals[r];
          ringIds[e].push(push(x, y, z, n[0], n[1], n[2], (x + y) * 0.3, z * 0.3));
        });
      });
      for (let r = 0; r < WALL_RINGS.length - 1; r++) {
        const a0 = ringIds[0][r];
        const b0 = ringIds[1][r];
        const a1 = ringIds[0][r + 1];
        const b1 = ringIds[1][r + 1];
        indices.push(a0, b0, a1, b0, b1, a1);
      }
    }

    if (!mesh) {
      mesh = new Mesh(`terrain-${id}`, this.scene);
      mesh.material = this.material;
      mesh.receiveShadows = true;
      mesh.isPickable = false;
      this.chunks.set(id, mesh);
      this.onChunk(mesh);
    }
    const data = new VertexData();
    data.positions = positions;
    data.normals = normals;
    data.colors = colors;
    data.uvs = uvs;
    data.indices = indices;
    data.applyToMesh(mesh, true);
  }

  private colorAt(x: number, y: number): Color3 {
    const t = this.terrain;
    const th = this.theme;
    const f = Math.max(0, t.sample(x, y));
    const n = t.normal(x, y);
    const up = smoothstep(0.15, 0.65, n.y);
    const grass = up * (1 - smoothstep(0.18, 0.45, f));
    const dirt = up * (1 - smoothstep(0.7, 1.7, f));
    const band = this.strata(x * 0.04, y * 0.32 + this.strata(x * 0.02, 3.3) * 1.6) * 0.5 + 0.5;
    const grain = 0.9 + this.speck(x * 1.3, y * 1.3) * 0.1;

    const c = Color3.Lerp(th.rockDark, th.rock, band).scale(grain);
    const dirtColor = Color3.Lerp(th.dirt, th.rockDark, 0.2);
    const out = Color3.Lerp(c, dirtColor, dirt);
    const grassColor = Color3.Lerp(th.grassDark, th.grass, this.speck(x * 0.35, y * 0.35) * 0.5 + 0.5);
    const result = Color3.Lerp(out, grassColor, grass);

    const under = smoothstep(-0.2, -0.75, n.y) * (1 - smoothstep(0.6, 2, f));
    const scorch = clamp(t.scorchAt(x, y), 0, 1);
    return Color3.Lerp(result.scale(1 - under * 0.18), new Color3(0.12, 0.1, 0.09), scorch * 0.85);
  }
}
