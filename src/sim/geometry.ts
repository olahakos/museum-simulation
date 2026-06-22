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

// mulberry32: tiny seeded PRNG. Deterministic, no Math.random.
function makePrng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DWELL_MARGIN = 0.15; // keep dots off the walls

export function dwellSpot(room: Room, seed: string): Point {
  const h = hashSeed(seed);
  const rx = (h & 0xffff) / 0xffff;
  const ry = ((h >>> 16) & 0xffff) / 0xffff;
  return {
    x: room.rect.x + room.rect.w * (DWELL_MARGIN + rx * (1 - 2 * DWELL_MARGIN)),
    y: room.rect.y + room.rect.h * (DWELL_MARGIN + ry * (1 - 2 * DWELL_MARGIN)),
  };
}

// Pick a point inside `room` that is at least `minGap` from every point in
// `occupied`. Uses a seeded PRNG so the result is deterministic given the
// same (room, seed, occupied, minGap). After `maxAttempts` rejections, falls
// back to the candidate that maximises its distance to the nearest neighbour
// (best-effort crowding tolerance). Caller is responsible for keeping the
// `occupied` list sorted-insertable — no internal mutation.
export function spreadSpot(
  room: Room,
  seed: string,
  occupied: Point[],
  minGap: number,
): Point {
  const minX = room.rect.x + room.rect.w * DWELL_MARGIN;
  const maxX = room.rect.x + room.rect.w * (1 - DWELL_MARGIN);
  const minY = room.rect.y + room.rect.h * DWELL_MARGIN;
  const maxY = room.rect.y + room.rect.h * (1 - DWELL_MARGIN);
  const rangeX = maxX - minX;
  const rangeY = maxY - minY;
  const prng = makePrng(hashSeed(seed));
  const gap2 = minGap * minGap;

  const fits = (x: number, y: number): boolean => {
    for (const p of occupied) {
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy < gap2) return false;
    }
    return true;
  };

  const maxAttempts = 64;
  let best: Point = { x: minX, y: minY };
  let bestMinDist2 = -Infinity;
  for (let i = 0; i < maxAttempts; i++) {
    const x = minX + prng() * rangeX;
    const y = minY + prng() * rangeY;
    if (fits(x, y)) return { x, y };
    // Track the least-bad candidate as a fallback in case no fit is found.
    let nearest2 = Infinity;
    for (const p of occupied) {
      const dx = p.x - x;
      const dy = p.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < nearest2) nearest2 = d2;
    }
    if (nearest2 > bestMinDist2) {
      bestMinDist2 = nearest2;
      best = { x, y };
    }
  }
  return best;
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
