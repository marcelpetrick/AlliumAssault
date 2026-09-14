import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4 } from '@babylonjs/core/Maths/math.color';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const engine = new Engine(canvas, true);
const scene = new Scene(engine);
scene.clearColor = new Color4(0.45, 0.7, 0.95, 1);
new ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 2.5, 6, Vector3.Zero(), scene);
new HemisphericLight('light', new Vector3(0, 1, 0), scene);
MeshBuilder.CreateSphere('garlic', { diameter: 2 }, scene);

engine.runRenderLoop(() => scene.render());
window.addEventListener('resize', () => engine.resize());
(window as unknown as { __allium: object }).__allium = { ready: true };
