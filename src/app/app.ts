import { loadScenario } from '../model/loader';
import { Simulation } from '../sim/engine';
import { Renderer } from '../render/renderer';
import exampleJson from '../../scenarios/example.json';

export function startApp(root: HTMLElement): void {
  const scenario = loadScenario(exampleJson);

  // --- DOM chrome ---
  root.innerHTML = '';
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:8px;align-items:center;padding:8px;font:14px sans-serif;';
  const playBtn = document.createElement('button');
  playBtn.textContent = 'Play';
  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'Reset';
  const title = document.createElement('span');
  title.textContent = scenario.name;
  const clock = document.createElement('span');
  clock.style.marginLeft = 'auto';
  bar.append(playBtn, resetBtn, title, clock);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  root.append(bar, canvas);

  function sizeCanvas(): void {
    canvas.width = root.clientWidth;
    canvas.height = Math.max(300, window.innerHeight - bar.offsetHeight - 16);
  }
  sizeCanvas();
  window.addEventListener('resize', sizeCanvas);

  // --- sim + render loop ---
  const sim = new Simulation(scenario);
  const renderer = new Renderer(ctx, scenario);
  const dt = 1 / scenario.params.tickRate;
  const timeScale = scenario.params.timeScale;

  let playing = false;
  let last = 0;
  let acc = 0;

  function frame(now: number): void {
    if (last === 0) last = now;
    const realElapsed = (now - last) / 1000;
    last = now;

    if (playing) {
      acc += realElapsed * timeScale;
      // Step in fixed increments; cap to avoid spiral-of-death after a stall.
      let steps = 0;
      while (acc >= dt && steps < 1000) {
        sim.step(dt);
        acc -= dt;
        steps++;
      }
    }

    renderer.draw(sim.agents, canvas.width, canvas.height);
    clock.textContent = `t = ${sim.time.toFixed(1)}s`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // --- controls ---
  playBtn.addEventListener('click', () => {
    playing = !playing;
    playBtn.textContent = playing ? 'Pause' : 'Play';
  });
  resetBtn.addEventListener('click', () => {
    sim.reset();
    acc = 0;
    playing = false;
    playBtn.textContent = 'Play';
  });
}
