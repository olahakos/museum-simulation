import type { Room, Point } from '../model/types';

export interface View { scale: number; offsetX: number; offsetY: number; }

export function layoutBounds(rooms: Room[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rooms) {
    minX = Math.min(minX, r.rect.x);
    minY = Math.min(minY, r.rect.y);
    maxX = Math.max(maxX, r.rect.x + r.rect.w);
    maxY = Math.max(maxY, r.rect.y + r.rect.h);
  }
  return { minX, minY, maxX, maxY };
}

export function fitView(rooms: Room[], canvasW: number, canvasH: number, margin: number): View {
  const b = layoutBounds(rooms);
  const worldW = b.maxX - b.minX || 1;
  const worldH = b.maxY - b.minY || 1;
  const availW = canvasW - 2 * margin;
  const availH = canvasH - 2 * margin;
  const scale = Math.min(availW / worldW, availH / worldH);
  // Centre the layout within the canvas.
  const offsetX = margin + (availW - worldW * scale) / 2 - b.minX * scale;
  const offsetY = margin + (availH - worldH * scale) / 2 - b.minY * scale;
  return { scale, offsetX, offsetY };
}

export function worldToScreen(p: Point, view: View): Point {
  return { x: p.x * view.scale + view.offsetX, y: p.y * view.scale + view.offsetY };
}
