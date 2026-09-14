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
};
(window as unknown as { __allium: typeof hook }).__allium = hook;
app.engine.onEndFrameObservable.addOnce(() => (hook.ready = true));
