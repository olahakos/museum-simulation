import type { Room, Doorway, Point } from '../model/types';

export function roomCenter(room: Room): Point {
  return { x: room.rect.x + room.rect.w / 2, y: room.rect.y + room.rect.h / 2 };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function moveToward(from: Point, to: Point, maxDist: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d <= maxDist || d === 0) return { x: to.x, y: to.y };
  return { x: from.x + (dx / d) * maxDist, y: from.y + (dy / d) * maxDist };
}

export function reached(a: Point, b: Point, eps = 0.5): boolean {
  return distance(a, b) <= eps;
}

export function doorwayBetween(doorways: Doorway[], a: string, b: string): Doorway | undefined {
  return doorways.find(
    (d) =>
      (d.between[0] === a && d.between[1] === b) ||
      (d.between[0] === b && d.between[1] === a),
  );
}

// FNV-1a string hash → unsigned 32-bit int. Deterministic, no Math.random.
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function dwellSpot(room: Room, seed: string): Point {
  const h = hashSeed(seed);
  const rx = (h & 0xffff) / 0xffff;
  const ry = ((h >>> 16) & 0xffff) / 0xffff;
  const margin = 0.15; // keep dots off the walls
  return {
    x: room.rect.x + room.rect.w * (margin + rx * (1 - 2 * margin)),
    y: room.rect.y + room.rect.h * (margin + ry * (1 - 2 * margin)),
  };
}

export function queueSlot(doorway: Doorway, fromRoom: Room, index: number): Point {
  const c = roomCenter(fromRoom);
  const dx = c.x - doorway.at.x;
  const dy = c.y - doorway.at.y;
  const len = Math.hypot(dx, dy) || 1;
  const spacing = 8;
  const dist = (index + 1) * spacing;
  return { x: doorway.at.x + (dx / len) * dist, y: doorway.at.y + (dy / len) * dist };
}
