import { describe, it, expect } from 'vitest';
import { Simulation } from './engine';
import type { Scenario } from '../model/types';

function scenario(): Scenario {
  return {
    name: 'D',
    rooms: [
      { id: 'a', rect: { x: 0, y: 0, w: 100, h: 100 }, capacity: 2, dwell: 1 },
      { id: 'b', rect: { x: 100, y: 0, w: 100, h: 100 }, capacity: 2, dwell: 3 },
      { id: 'c', rect: { x: 200, y: 0, w: 100, h: 100 }, capacity: 2, dwell: 2 },
    ],
    doorways: [
      { id: 'a_b', between: ['a', 'b'], at: { x: 100, y: 50 }, throughput: 0.7 },
      { id: 'b_c', between: ['b', 'c'], at: { x: 200, y: 50 }, throughput: 0.7 },
    ],
    groups: [
      { id: 'g1', size: 4, startAt: 0, route: ['a', 'b', 'c'] },
      { id: 'g2', size: 4, startAt: 0.5, route: ['a', 'b', 'c'] },
    ],
    params: { walkSpeed: 40, tickRate: 30, timeScale: 1, spotGap: 10 },
  };
}

function snapshot(sim: Simulation) {
  return sim.agents
    .map((a) => `${a.id}:${a.state}:${a.pos.x.toFixed(4)}:${a.pos.y.toFixed(4)}`)
    .sort();
}

describe('determinism', () => {
  it('produces identical state after N ticks across two runs', () => {
    const dt = 1 / 30;
    const ticks = 300;
    const s1 = new Simulation(scenario());
    const s2 = new Simulation(scenario());
    for (let i = 0; i < ticks; i++) { s1.step(dt); s2.step(dt); }
    expect(snapshot(s1)).toEqual(snapshot(s2));
  });

  it('reset replays identically', () => {
    const dt = 1 / 30;
    const sim = new Simulation(scenario());
    for (let i = 0; i < 150; i++) sim.step(dt);
    const first = snapshot(sim);
    sim.reset();
    for (let i = 0; i < 150; i++) sim.step(dt);
    expect(snapshot(sim)).toEqual(first);
  });
});
