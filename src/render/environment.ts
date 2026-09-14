import { Color3, Matrix, Mesh, MeshBuilder, Quaternion, ShaderMaterial, StandardMaterial, Vector3, VertexBuffer, VertexData, type Scene } from '@babylonjs/core';
import { createNoise2D } from 'simplex-noise';
import { mulberry32 } from '../core/rng';
import type { Theme } from './themes';

const SKY_VERTEX = `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}`;

const SKY_FRAGMENT = `
precision highp float;
varying vec3 vDir;
uniform vec3 top;
uniform vec3 horizon;
uniform vec3 sunDir;
uniform vec3 sunColor;
uniform float stars;
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
void main() {
  vec3 d = normalize(vDir);
  float t = clamp(d.y * 1.5 + 0.08, 0.0, 1.0);
  vec3 col = mix(horizon, top, pow(t, 0.65));
  float s = max(dot(d, -sunDir), 0.0);
  col += sunColor * (pow(s, 900.0) * 4.0 + pow(s, 60.0) * 0.35 + pow(s, 6.0) * 0.18);
  if (stars > 0.5) {
    float h = hash(floor(d * 260.0));
    col += vec3(step(0.9965, h)) * smoothstep(0.02, 0.35, d.y) * (0.6 + 0.4 * hash(floor(d * 97.0)));
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const WATER_VERTEX = `
precision highp float;
attribute vec3 position;
uniform mat4 world;
uniform mat4 viewProjection;
uniform float time;
varying vec3 vPos;
varying vec3 vNormal;
void main() {
  vec4 wp = world * vec4(position, 1.0);
  float a = wp.x * 0.33 + time * 1.1;
  float b = wp.z * 0.45 + wp.x * 0.12 + time * 1.6;
  wp.y += sin(a) * 0.13 + sin(b) * 0.09;
  float dx = cos(a) * 0.13 * 0.33 + cos(b) * 0.09 * 0.12;
  float dz = cos(b) * 0.09 * 0.45;
  vNormal = normalize(vec3(-dx, 1.0, -dz));
  vPos = wp.xyz;
  gl_Position = viewProjection * wp;
}`;

const WATER_FRAGMENT = `
precision highp float;
varying vec3 vPos;
varying vec3 vNormal;
uniform vec3 eye;
uniform vec3 shallow;
uniform vec3 deep;
uniform vec3 sunDir;
uniform vec3 sunColor;
uniform vec3 fogColor;
uniform float fogDensity;
uniform float time;
void main() {
  vec3 v = normalize(eye - vPos);
  vec3 n = normalize(vNormal + vec3(sin(vPos.x * 1.9 + time * 2.1) * 0.05, 0.0, cos(vPos.z * 1.6 - time * 1.7) * 0.05));
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 col = mix(shallow, deep, clamp(0.3 + fres * 0.9, 0.0, 1.0));
  vec3 h = normalize(v - sunDir);
  col += sunColor * pow(max(dot(n, h), 0.0), 140.0) * 1.6;
  float sparkle = step(0.985, fract(sin(dot(floor(vPos.xz * 3.0), vec2(12.9898, 78.233))) * 43758.5453 + time * 0.3));
  col += sunColor * sparkle * 0.25 * fres;
  float dist = length(eye - vPos);
  float fog = 1.0 - exp(-pow(fogDensity * dist, 2.0));
  col = mix(col, fogColor, clamp(fog, 0.0, 1.0));
  gl_FragColor = vec4(col, 0.8 + fres * 0.18);
}`;

/** Sky dome, animated water, rolling background hills with trees, and drifting clouds. */
export class Environment {
  private readonly water: ShaderMaterial;
  private readonly clouds: Mesh[] = [];
  private readonly meshes: Mesh[] = [];

  constructor(
    private readonly scene: Scene,
    private readonly theme: Theme,
    worldWidth: number,
    waterLevel: number,
  ) {
    const sunDir = new Vector3(...theme.sunDirection).normalize();

    const sky = MeshBuilder.CreateSphere('sky', { diameter: 1600, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
    const skyMat = new ShaderMaterial('skyMat', scene, { vertexSource: SKY_VERTEX, fragmentSource: SKY_FRAGMENT }, {
      attributes: ['position'],
      uniforms: ['worldViewProjection', 'top', 'horizon', 'sunDir', 'sunColor', 'stars'],
    });
    skyMat.setColor3('top', theme.skyTop);
    skyMat.setColor3('horizon', theme.skyHorizon);
    skyMat.setVector3('sunDir', sunDir);
    skyMat.setColor3('sunColor', theme.sunColor);
    skyMat.setFloat('stars', theme.stars ? 1 : 0);
    skyMat.backFaceCulling = false;
    skyMat.disableDepthWrite = true;
    sky.material = skyMat;
    sky.infiniteDistance = true;
    sky.isPickable = false;
    this.meshes.push(sky);

    const water = MeshBuilder.CreateGround('water', { width: 900, height: 420, subdivisions: 160 }, scene);
    water.position.set(worldWidth / 2, waterLevel, 170);
    this.water = new ShaderMaterial('waterMat', scene, { vertexSource: WATER_VERTEX, fragmentSource: WATER_FRAGMENT }, {
      attributes: ['position'],
      uniforms: ['world', 'viewProjection', 'time', 'eye', 'shallow', 'deep', 'sunDir', 'sunColor', 'fogColor', 'fogDensity'],
      needAlphaBlending: true,
    });
    this.water.setColor3('shallow', theme.waterShallow);
    this.water.setColor3('deep', theme.waterDeep);
    this.water.setVector3('sunDir', sunDir);
    this.water.setColor3('sunColor', theme.sunColor);
    this.water.setColor3('fogColor', theme.fog);
    this.water.setFloat('fogDensity', theme.fogDensity);
    this.water.backFaceCulling = false;
    water.material = this.water;
    water.isPickable = false;
    water.alphaIndex = 10;
    this.meshes.push(water);

    this.buildHills(worldWidth, waterLevel);
    this.buildClouds(worldWidth);
  }

  update(time: number, eye: Vector3, dt: number): void {
    this.water.setFloat('time', time);
    this.water.setVector3('eye', eye);
    for (const cloud of this.clouds) {
      cloud.position.x += dt * (0.6 + (cloud.position.z - 150) * 0.004);
      if (cloud.position.x > 420) cloud.position.x = -300;
    }
  }

  dispose(): void {
    for (const m of [...this.meshes, ...this.clouds]) m.dispose(false, true);
  }

  private buildHills(worldWidth: number, waterLevel: number): void {
    const rng = mulberry32(99);
    const noise = createNoise2D(rng);
    const layers = [
      { z: 48, depth: 34, height: 11, step: 2.5 },
      { z: 100, depth: 60, height: 22, step: 4 },
      { z: 190, depth: 90, height: 40, step: 6 },
    ];
    const tree = this.createTreeTemplate();
    layers.forEach((layer, index) => {
      const xs: number[] = [];
      for (let x = worldWidth / 2 - 420; x <= worldWidth / 2 + 420; x += layer.step) xs.push(x);
      const zs = [0, 0.15, 0.35, 0.5, 0.65, 0.85, 1];
      const height = (x: number, t: number) => {
        const ridge = Math.sin(t * Math.PI) ** 0.8;
        const h = (noise(x * 0.012 / (index + 1), index * 10) * 0.5 + 0.5) * layer.height + noise(x * 0.05, index * 20 + t) * layer.height * 0.12;
        return waterLevel - 2 + ridge * (h + layer.height * 0.25);
      };
      const positions: number[] = [];
      const indices: number[] = [];
      for (const t of zs) for (const x of xs) positions.push(x, height(x, t), layer.z + t * layer.depth);
      const w = xs.length;
      for (let r = 0; r < zs.length - 1; r++) {
        for (let c = 0; c < w - 1; c++) {
          const a = r * w + c;
          indices.push(a, a + w, a + 1, a + 1, a + w, a + w + 1);
        }
      }
      const normals: number[] = [];
      VertexData.ComputeNormals(positions, indices, normals);
      const data = new VertexData();
      Object.assign(data, { positions, indices, normals });
      const mesh = new Mesh(`hills-${index}`, this.scene);
      data.applyToMesh(mesh);
      const mat = new StandardMaterial(`hillsMat-${index}`, this.scene);
      mat.diffuseColor = this.theme.hills[index];
      mat.emissiveColor = this.theme.hills[index].scale(0.18);
      mat.specularColor = Color3.Black();
      mat.backFaceCulling = false;
      mesh.material = mat;
      mesh.isPickable = false;
      this.meshes.push(mesh);

      // Scatter trees along the ridge of the two nearer layers.
      if (index < 2) {
        const count = index === 0 ? 170 : 220;
        const inst = tree.clone(`trees-${index}`);
        inst.isVisible = true;
        const matrices = new Float32Array(count * 16);
        for (let n = 0; n < count; n++) {
          const x = xs[0] + rng() * (xs[w - 1] - xs[0]);
          const t = 0.2 + rng() * 0.45;
          const s = (0.8 + rng() * 1.1) * (index === 0 ? 1.1 : 1.9);
          Matrix.Compose(new Vector3(s, s * (0.8 + rng() * 0.5), s), Quaternion.RotationAxis(Vector3.Up(), rng() * 6.28), new Vector3(x, height(x, t) - 0.3, layer.z + t * layer.depth)).copyToArray(matrices, n * 16);
        }
        inst.thinInstanceSetBuffer('matrix', matrices, 16, true);
        this.meshes.push(inst);
      }
    });
    tree.dispose();
  }

  private createTreeTemplate(): Mesh {
    const parts: Mesh[] = [];
    const paint = (m: Mesh, c: Color3) => {
      const count = m.getTotalVertices();
      const colors = new Float32Array(count * 4);
      for (let k = 0; k < count; k++) colors.set([c.r, c.g, c.b, 1], k * 4);
      m.setVerticesData(VertexBuffer.ColorKind, colors);
      parts.push(m);
    };
    const trunk = MeshBuilder.CreateCylinder('trunk', { height: 1.2, diameter: 0.35, tessellation: 6 }, this.scene);
    trunk.position.y = 0.6;
    paint(trunk, this.theme.trunk);
    [0, 1, 2].forEach((k) => {
      const cone = MeshBuilder.CreateCylinder('cone', { height: 1.9 - k * 0.35, diameterTop: 0, diameterBottom: 2.2 - k * 0.55, tessellation: 7 }, this.scene);
      cone.position.y = 1.5 + k * 0.85;
      paint(cone, this.theme.foliage.scale(1 + k * 0.12));
    });
    const merged = Mesh.MergeMeshes(parts, true)!;
    const mat = new StandardMaterial('treeMat', this.scene);
    mat.specularColor = Color3.Black();
    mat.emissiveColor = this.theme.foliage.scale(0.08);
    merged.material = mat;
    merged.isVisible = false;
    merged.isPickable = false;
    return merged;
  }

  private buildClouds(worldWidth: number): void {
    const rng = mulberry32(5);
    const mat = new StandardMaterial('cloudMat', this.scene);
    mat.diffuseColor = this.theme.clouds;
    mat.emissiveColor = this.theme.clouds.scale(0.55);
    mat.specularColor = Color3.Black();
    mat.alpha = 0.92;
    for (let c = 0; c < 14; c++) {
      const puffs: Mesh[] = [];
      const count = 4 + Math.floor(rng() * 4);
      for (let p = 0; p < count; p++) {
        const puff = MeshBuilder.CreateIcoSphere('puff', { radius: 3 + rng() * 3, subdivisions: 2 }, this.scene);
        puff.position.set((p - count / 2) * 3.4 + rng() * 2, rng() * 2, rng() * 3);
        puff.scaling.y = 0.65;
        puffs.push(puff);
      }
      const cloud = Mesh.MergeMeshes(puffs, true)!;
      cloud.material = mat;
      cloud.position.set(worldWidth / 2 - 300 + rng() * 700, 42 + rng() * 38, 130 + rng() * 140);
      cloud.isPickable = false;
      this.clouds.push(cloud);
    }
  }
}
