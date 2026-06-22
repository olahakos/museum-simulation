import { describe, it, expect } from 'vitest';
import { validateScenario, loadScenario } from './loader';
import type { Scenario } from './types';

function valid(): Scenario {
  return {
    name: 'T',
    rooms: [
      { id: 'a', rect: { x: 0, y: 0, w: 100, h: 100 }, capacity: 10, dwell: 0 },
      { id: 'b', rect: { x: 100, y: 0, w: 100, h: 100 }, capacity: 10, dwell: 60 },
    ],
    doorways: [
      { id: 'a_b', between: ['a', 'b'], at: { x: 100, y: 50 }, throughput: 1 },
    ],
    groups: [{ id: 'g1', size: 2, startAt: 0, route: ['a', 'b'] }],
    params: { walkSpeed: 40, tickRate: 30, timeScale: 8, spotGap: 10 },
  };
}

describe('validateScenario', () => {
  it('accepts a valid scenario', () => {
    expect(validateScenario(valid())).toEqual([]);
  });

  it('rejects a route referencing an unknown room', () => {
    const s = valid();
    s.groups[0].route = ['a', 'nope'];
    expect(validateScenario(s).join()).toContain('nope');
  });

  it('rejects a doorway referencing an unknown room', () => {
    const s = valid();
    s.doorways[0].between = ['a', 'ghost'];
    expect(validateScenario(s).join()).toContain('ghost');
  });

  it('rejects a route step between unconnected rooms', () => {
    const s = valid();
    s.doorways = []; // a and b are no longer connected
    expect(validateScenario(s).join().toLowerCase()).toContain('connect');
  });

  it('loadScenario throws on invalid input', () => {
    const s = valid();
    s.groups[0].route = ['a', 'nope'];
    expect(() => loadScenario(s)).toThrow();
  });

  it('loadScenario returns the scenario when valid', () => {
    expect(loadScenario(valid()).name).toBe('T');
  });
});
