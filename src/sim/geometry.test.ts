import { describe, it, expect } from 'vitest';
import {
  roomCenter, distance, moveToward, reached, doorwayBetween, dwellSpot, spreadSpot, queueSlot,
} from './geometry';
import type { Room, Doorway } from '../model/types';

const room: Room = { id: 'a', rect: { x: 0, y: 0, w: 100, h: 80 }, capacity: 10, dwell: 0 };

describe('geometry', () => {
  it('roomCenter returns the rect centre', () => {
    expect(roomCenter(room)).toEqual({ x: 50, y: 40 });
  });

  it('distance is euclidean', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('moveToward advances by maxDist when far', () => {
    expect(moveToward({ x: 0, y: 0 }, { x: 10, y: 0 }, 4)).toEqual({ x: 4, y: 0 });
  });

  it('moveToward snaps to target when within maxDist', () => {
    expect(moveToward({ x: 0, y: 0 }, { x: 3, y: 0 }, 10)).toEqual({ x: 3, y: 0 });
  });

  it('reached is true within epsilon', () => {
    expect(reached({ x: 0, y: 0 }, { x: 0.2, y: 0 })).toBe(true);
    expect(reached({ x: 0, y: 0 }, { x: 5, y: 0 })).toBe(false);
  });

  it('doorwayBetween finds a doorway regardless of order', () => {
    const doors: Doorway[] = [
      { id: 'a_b', between: ['a', 'b'], at: { x: 100, y: 40 }, throughput: 1 },
    ];
    expect(doorwayBetween(doors, 'b', 'a')?.id).toBe('a_b');
    expect(doorwayBetween(doors, 'a', 'c')).toBeUndefined();
  });

  it('dwellSpot is deterministic and inside the room', () => {
    const p1 = dwellSpot(room, 'g1-0');
    const p2 = dwellSpot(room, 'g1-0');
    expect(p1).toEqual(p2);
    expect(p1.x).toBeGreaterThanOrEqual(room.rect.x);
    expect(p1.x).toBeLessThanOrEqual(room.rect.x + room.rect.w);
    expect(p1.y).toBeGreaterThanOrEqual(room.rect.y);
    expect(p1.y).toBeLessThanOrEqual(room.rect.y + room.rect.h);
  });

  it('dwellSpot differs for different seeds', () => {
    expect(dwellSpot(room, 'g1-0')).not.toEqual(dwellSpot(room, 'g1-1'));
  });

  it('spreadSpot is deterministic given the same inputs', () => {
    const occupied = [dwellSpot(room, 'a-0'), dwellSpot(room, 'a-1')];
    const p1 = spreadSpot(room, 'a-2', occupied, 12);
    const p2 = spreadSpot(room, 'a-2', occupied, 12);
    expect(p1).toEqual(p2);
  });

  it('spreadSpot returns a point at least minGap from every occupied spot', () => {
    const occupied = [dwellSpot(room, 'a-0'), dwellSpot(room, 'a-1'), dwellSpot(room, 'a-2')];
    const minGap = 14;
    for (let k = 0; k < 6; k++) {
      const p = spreadSpot(room, `b-${k}`, occupied, minGap);
      for (const o of occupied) {
        expect(Math.hypot(p.x - o.x, p.y - o.y)).toBeGreaterThanOrEqual(minGap);
      }
      occupied.push(p);
    }
  });

  it('spreadSpot respects the in-room margin (stays inside the inset rect)', () => {
    const marginX = room.rect.w * 0.15;
    const marginY = room.rect.h * 0.15;
    const p = spreadSpot(room, 'solo', [dwellSpot(room, 'x')], 10);
    expect(p.x).toBeGreaterThanOrEqual(room.rect.x + marginX - 1e-9);
    expect(p.x).toBeLessThanOrEqual(room.rect.x + room.rect.w - marginX + 1e-9);
    expect(p.y).toBeGreaterThanOrEqual(room.rect.y + marginY - 1e-9);
    expect(p.y).toBeLessThanOrEqual(room.rect.y + room.rect.h - marginY + 1e-9);
  });

  it('spreadSpot falls back gracefully when the room is crowded beyond fit', () => {
    // Pack many overlapping spots and ask for one more — must not throw,
    // must return something inside the room inset.
    const occupied = [];
    for (let k = 0; k < 20; k++) {
      occupied.push({ x: room.rect.x + room.rect.w / 2 + k * 0.1, y: room.rect.y + room.rect.h / 2 });
    }
    const p = spreadSpot(room, 'crowded', occupied, 50);
    expect(p.x).toBeGreaterThanOrEqual(room.rect.x);
    expect(p.x).toBeLessThanOrEqual(room.rect.x + room.rect.w);
    expect(p.y).toBeGreaterThanOrEqual(room.rect.y);
    expect(p.y).toBeLessThanOrEqual(room.rect.y + room.rect.h);
  });

  it('spreadSpot with no occupied neighbours still varies by seed', () => {
    const a = spreadSpot(room, 'seed-A', [], 5);
    const b = spreadSpot(room, 'seed-B', [], 5);
    expect(a).not.toEqual(b);
  });

  it('queueSlot steps back from the doorway toward the room centre', () => {
    const door: Doorway = { id: 'a_b', between: ['a', 'b'], at: { x: 100, y: 40 }, throughput: 1 };
    const s0 = queueSlot(door, room, 0);
    const s1 = queueSlot(door, room, 1);
    // Both move left of the doorway (toward centre x=50); slot 1 is further.
    expect(s0.x).toBeLessThan(door.at.x);
    expect(s1.x).toBeLessThan(s0.x);
  });
});
