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
    panel.append(
      fieldset(room.id, [
        numberField('Dwell (s)', room.dwell, 0, 1, (v) => {
          room.dwell = v;
        }),
        numberField('Capacity', room.capacity, 1, 1, (v) => {
          room.capacity = Math.round(v);
        }),
      ]),
    );
  }

  // Per-group size, start time + route. Edits apply to groups that haven't
  // spawned yet (and to all groups after Reset).
  const roomIds = new Set(scenario.rooms.map((r) => r.id));
  for (const group of scenario.groups) {
    panel.append(
      fieldset(group.id, [
        numberField('Size', group.size, 1, 1, (v) => {
          group.size = Math.round(v);
        }),
        numberField('Start (s)', group.startAt, 0, 1, (v) => {
          group.startAt = v;
        }),
        textField('Route', group.route.join(', '), (raw) => {
          const route = raw
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          // Only accept a non-empty route of known room ids.
          if (route.length === 0 || !route.every((id) => roomIds.has(id))) {
            return false;
          }
          group.route = route;
          return true;
        }),
      ]),
    );
  }

  return panel;
}

/** A bordered, titled group of fields. */
function fieldset(title: string, fields: HTMLElement[]): HTMLElement {
  const set = document.createElement('fieldset');
  set.style.cssText =
    'display:flex;gap:8px;align-items:flex-end;border:1px solid #ddd;' +
    'border-radius:4px;padding:4px 8px;margin:0;';
  const legend = document.createElement('legend');
  legend.textContent = title;
  legend.style.cssText = 'padding:0 4px;color:#666;';
  set.append(legend, ...fields);
  return set;
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

/**
 * Labeled text input. `onChange` returns whether the raw value was accepted;
 * rejected input is flagged red but left for the user to keep editing.
 */
function textField(
  label: string,
  value: string,
  onChange: (raw: string) => boolean,
): HTMLElement {
  const wrap = document.createElement('label');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
  const text = document.createElement('span');
  text.textContent = label;
  text.style.cssText = 'color:#666;font-size:11px;';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  input.style.cssText = 'width:200px;';
  input.addEventListener('input', () => {
    const ok = onChange(input.value);
    input.style.color = ok ? '' : '#c00';
  });
  wrap.append(text, input);
  return wrap;
}
