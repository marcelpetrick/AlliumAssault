import './ui/styles.css';
import { App } from './app';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const app = new App(canvas, document.getElementById('ui')!);

const hook = {
  ready: false,
  app,
  state: () => app.state(),
  startMatch: (config: Parameters<App['startMatch']>[0]) => app.startMatch(config),
  fastForward: (seconds: number) => app.fastForward(seconds),
  stepFrames: (count: number, dt?: number) => app.stepFrames(count, dt),
  setManual: (manual: boolean) => (app.manual = manual),
  /** World position → CSS pixels relative to the canvas, for real mouse clicks in tests. */
  project: (x: number, y: number) => app.world?.project(x, y) ?? null,
};
export type AlliumHook = typeof hook;
(window as unknown as { __allium: typeof hook }).__allium = hook;
app.engine.onEndFrameObservable.addOnce(() => (hook.ready = true));
