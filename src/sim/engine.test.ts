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
    params: { walkSpeed: 50, tickRate: 30, timeScale: 1, spotGap: 10 },
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
      params: { walkSpeed: 50, tickRate: 30, timeScale: 1, spotGap: 10 },
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
      params: { walkSpeed: 1000, tickRate: 30, timeScale: 1, spotGap: 10 },
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

describe('Simulation spot spreading', () => {
  const dt = 1 / 30;

  // Two overlapping groups spawn into the same first room. Spot spread must
  // keep every agent in the room at least `spotGap` apart, no matter which
  // group they belong to.
  function overlapping(): Scenario {
    return {
      name: 'Spread',
      rooms: [
        { id: 'a', rect: { x: 0, y: 0, w: 100, h: 100 }, capacity: 100, dwell: 0 },
        { id: 'b', rect: { x: 100, y: 0, w: 100, h: 100 }, capacity: 100, dwell: 100 },
      ],
      doorways: [{ id: 'a_b', between: ['a', 'b'], at: { x: 100, y: 50 }, throughput: 1000 }],
      groups: [
        { id: 'g1', size: 5, startAt: 0, route: ['a', 'b'] },
        { id: 'g2', size: 5, startAt: 0, route: ['a', 'b'] },
      ],
      params: { walkSpeed: 1000, tickRate: 30, timeScale: 1, spotGap: 20 },
    };
  }

  it('keeps spawned agents at least spotGap apart within a room', () => {
    const sim = new Simulation(overlapping());
    // Step a tick so both groups spawn simultaneously, then sample positions.
    sim.step(dt);
    const inA = sim.agents.filter((a) => a.currentRoom === 'a' && a.state !== 'QUEUING');
    expect(inA.length).toBe(10);
    for (let i = 0; i < inA.length; i++) {
      for (let j = i + 1; j < inA.length; j++) {
        const d = Math.hypot(inA[i].pos.x - inA[j].pos.x, inA[i].pos.y - inA[j].pos.y);
        expect(d).toBeGreaterThanOrEqual(20);
      }
    }
  });

  it('spots admitted into the destination room stay clear of current occupants', () => {
    // Tight capacity (2) so the second visitor must wait at the doorway and
    // be admitted later. When admitted, their dwell spot must still respect
    // spotGap from anyone already in the room.
    const s: Scenario = {
      name: 'TightAdmit',
      rooms: [
        { id: 'a', rect: { x: 0, y: 0, w: 200, h: 200 }, capacity: 100, dwell: 0 },
        { id: 'b', rect: { x: 200, y: 0, w: 200, h: 200 }, capacity: 2, dwell: 100 },
      ],
      doorways: [{ id: 'a_b', between: ['a', 'b'], at: { x: 200, y: 100 }, throughput: 1000 }],
      groups: [{ id: 'g', size: 4, startAt: 0, route: ['a', 'b'] }],
      params: { walkSpeed: 1000, tickRate: 30, timeScale: 1, spotGap: 25 },
    };
    const sim = new Simulation(s);
    // Run long enough that all 4 have been admitted (they will; b holds 2 at a
    // time but dwell is 100s so they cycle, but we only care about positions
    // inside b while it's populated).
    for (let i = 0; i < Math.round(5 / dt); i++) sim.step(dt);
    // Snapshot every frame and verify no two simultaneous in-room dots overlap.
    // We re-run a fresh sim to capture a single frame mid-occupation.
    const sim2 = new Simulation(s);
    for (let i = 0; i < Math.round(2 / dt); i++) sim2.step(dt);
    const inB = sim2.agents.filter((a) => a.currentRoom === 'b' && a.state === 'DWELLING');
    expect(inB.length).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < inB.length; i++) {
      for (let j = i + 1; j < inB.length; j++) {
        const d = Math.hypot(inB[i].pos.x - inB[j].pos.x, inB[i].pos.y - inB[j].pos.y);
        expect(d).toBeGreaterThanOrEqual(25);
      }
    }
  });
});
