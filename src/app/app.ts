import { loadScenario } from '../model/loader';
import type { Scenario } from '../model/types';
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

  const controls = buildControls(scenario);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  root.append(bar, controls, canvas);

  function sizeCanvas(): void {
    canvas.width = root.clientWidth;
    canvas.height = Math.max(
      300,
      window.innerHeight - bar.offsetHeight - controls.offsetHeight - 16,
    );
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

/**
 * Panel of live-editable simulation parameters. Inputs mutate the scenario
 * objects in place; the engine reads these values fresh each step, so edits
 * take effect mid-run without a reset.
 */
function buildControls(scenario: Scenario): HTMLElement {
  const panel = document.createElement('div');
  panel.style.cssText =
    'display:flex;flex-wrap:wrap;gap:16px;align-items:flex-end;' +
    'padding:8px;font:13px sans-serif;border-bottom:1px solid #ddd;';

  // Global walk speed.
  panel.append(
    numberField('Walk speed', scenario.params.walkSpeed, 0, 0.5, (v) => {
      scenario.params.walkSpeed = v;
    }),
  );

  // Per-room dwell + capacity.
  for (const room of scenario.rooms) {
    const group = document.createElement('fieldset');
    group.style.cssText =
      'display:flex;gap:8px;align-items:flex-end;border:1px solid #ddd;' +
      'border-radius:4px;padding:4px 8px;margin:0;';
    const legend = document.createElement('legend');
    legend.textContent = room.id;
    legend.style.cssText = 'padding:0 4px;color:#666;';
    group.append(
      legend,
      numberField('Dwell (s)', room.dwell, 0, 1, (v) => {
        room.dwell = v;
      }),
      numberField('Capacity', room.capacity, 1, 1, (v) => {
        room.capacity = Math.round(v);
      }),
    );
    panel.append(group);
  }

  return panel;
}

/** Labeled number input that calls `onChange` with a clamped value on edit. */
function numberField(
  label: string,
  value: number,
  min: number,
  step: number,
  onChange: (value: number) => void,
): HTMLElement {
  const wrap = document.createElement('label');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
  const text = document.createElement('span');
  text.textContent = label;
  text.style.cssText = 'color:#666;font-size:11px;';
  const input = document.createElement('input');
  input.type = 'number';
  input.min = String(min);
  input.step = String(step);
  input.value = String(value);
  input.style.cssText = 'width:80px;';
  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    if (Number.isFinite(v) && v >= min) onChange(v);
  });
  wrap.append(text, input);
  return wrap;
}
