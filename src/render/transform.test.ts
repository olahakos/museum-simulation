import { describe, it, expect } from 'vitest';
import { layoutBounds, fitView, worldToScreen } from './transform';
import type { Room } from '../model/types';

const rooms: Room[] = [
  { id: 'a', rect: { x: 0, y: 0, w: 100, h: 50 }, capacity: 1, dwell: 0 },
  { id: 'b', rect: { x: 100, y: 50, w: 100, h: 50 }, capacity: 1, dwell: 0 },
];

describe('render transform', () => {
  it('computes layout bounds across all rooms', () => {
    expect(layoutBounds(rooms)).toEqual({ minX: 0, minY: 0, maxX: 200, maxY: 100 });
  });

  it('fits the layout into the canvas with margin, preserving aspect (uniform scale)', () => {
    const view = fitView(rooms, 400, 400, 20);
    // World is 200x100; with 20px margin each side, available is 360x360.
    // Limiting axis is width: 360/200 = 1.8.
    expect(view.scale).toBeCloseTo(1.8, 5);
  });

  it('maps a world point to screen coordinates', () => {
    const view = fitView(rooms, 400, 400, 20);
    const p = worldToScreen({ x: 0, y: 0 }, view);
    expect(p.x).toBeCloseTo(view.offsetX, 5);
    expect(p.y).toBeCloseTo(view.offsetY, 5);
  });
});
