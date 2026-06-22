import { describe, it, expect } from 'vitest';
import { Simulation } from './engine';
import type { Scenario } from '../model/types';

// Two rooms side by side, one doorway, one group of 1 that visits a -> b.
function scenario(): Scenario {
  return {
    name: 'T',
    rooms: [
      { id: 'a', rect: { x: 0, y: 0, w: 100, h: 100 }, capacity: 100, dwell: 0 },
      { id: 'b', rect: { x: 100, y: 0, w: 100, h: 100 }, capacity: 100, dwell: 2 },
    ],
    doorways: [{ id: 'a_b', between: ['a', 'b'], at: { x: 100, y: 50 }, throughput: 1000 }],
    groups: [{ id: 'g', size: 1, startAt: 1, route: ['a', 'b'] }],
    params: { walkSpeed: 50, tickRate: 30, timeScale: 1 },
  };
}

function run(sim: Simulation, seconds: number, dt: number) {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) sim.step(dt);
}

describe('Simulation', () => {
  const dt = 1 / 30;

  it('does not spawn before startAt', () => {
    const sim = new Simulation(scenario());
    run(sim, 0.5, dt);
    expect(sim.agents.length).toBe(0);
  });

  it('spawns the group after startAt, dwelling in the first room', () => {
    const sim = new Simulation(scenario());
    run(sim, 1.1, dt);
    expect(sim.agents.length).toBe(1);
    expect(sim.agents[0].currentRoom).toBe('a');
  });

  it('walks the agent into the second room and dwells there', () => {
    const sim = new Simulation(scenario());
    // dwell in a is 0, so it heads to the doorway, crosses, walks into b.
    run(sim, 5, dt);
    const a = sim.agents[0];
    expect(a.currentRoom).toBe('b');
    expect(['WALKING', 'DWELLING']).toContain(a.state);
  });

  it('marks the agent DONE after the final room dwell', () => {
    const sim = new Simulation(scenario());
    run(sim, 12, dt);
    expect(sim.agents[0].state).toBe('DONE');
  });

  it('reset clears agents and time', () => {
    const sim = new Simulation(scenario());
    run(sim, 5, dt);
    sim.reset();
    expect(sim.agents.length).toBe(0);
    expect(sim.time).toBe(0);
  });
});

import { roomCenter } from './geometry';

describe('Simulation congestion', () => {
  const dt = 1 / 30;

  // Room b holds only 1; a group of 3 must queue to enter.
  function tight(): Scenario {
    return {
      name: 'T',
      rooms: [
        { id: 'a', rect: { x: 0, y: 0, w: 100, h: 100 }, capacity: 100, dwell: 0 },
        { id: 'b', rect: { x: 100, y: 0, w: 100, h: 100 }, capacity: 1, dwell: 5 },
      ],
      doorways: [{ id: 'a_b', between: ['a', 'b'], at: { x: 100, y: 50 }, throughput: 1000 }],
      groups: [{ id: 'g', size: 3, startAt: 0, route: ['a', 'b'] }],
      params: { walkSpeed: 50, tickRate: 30, timeScale: 1 },
    };
  }

  it('keeps a full destination room at capacity, queuing the rest', () => {
    const sim = new Simulation(tight());
    for (let i = 0; i < Math.round(4 / dt); i++) sim.step(dt);
    const inB = sim.agents.filter((a) => a.currentRoom === 'b' && a.state !== 'DONE');
    const queued = sim.agents.filter((a) => a.state === 'QUEUING');
    expect(inB.length).toBe(1);
    expect(queued.length).toBe(2);
  });

  // Throughput-limited: 4 visitors, door passes 1/sec, room is roomy.
  function slowDoor(): Scenario {
    return {
      name: 'T',
      rooms: [
        { id: 'a', rect: { x: 0, y: 0, w: 100, h: 100 }, capacity: 100, dwell: 0 },
        { id: 'b', rect: { x: 100, y: 0, w: 100, h: 100 }, capacity: 100, dwell: 100 },
      ],
      doorways: [{ id: 'a_b', between: ['a', 'b'], at: { x: 100, y: 50 }, throughput: 1 }],
      groups: [{ id: 'g', size: 4, startAt: 0, route: ['a', 'b'] }],
      params: { walkSpeed: 1000, tickRate: 30, timeScale: 1 },
    };
  }

  it('admits at most ~throughput visitors per second through a doorway', () => {
    const sim = new Simulation(slowDoor());
    // After ~2.5s, with walkSpeed huge so travel is instant, ~2-3 should be in b.
    for (let i = 0; i < Math.round(2.5 / dt); i++) sim.step(dt);
    const inB = sim.agents.filter((a) => a.currentRoom === 'b').length;
    expect(inB).toBeGreaterThanOrEqual(2);
    expect(inB).toBeLessThanOrEqual(3);
  });

  it('positions queued agents in distinct slots behind the doorway', () => {
    const sim = new Simulation(tight());
    for (let i = 0; i < Math.round(2 / dt); i++) sim.step(dt);
    const queued = sim.agents.filter((a) => a.state === 'QUEUING');
    expect(queued.length).toBe(2);
    // The two queued agents occupy different positions.
    expect(queued[0].pos).not.toEqual(queued[1].pos);
    // And they stand on the 'a' side (x < doorway x = 100).
    for (const q of queued) expect(q.pos.x).toBeLessThan(100);
    expect(roomCenter(sim['rooms'].get('a')!).x).toBe(50);
  });
});
