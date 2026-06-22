import type { Scenario, Room } from '../model/types';
import type { Agent } from '../sim/engine';
import { fitView, worldToScreen, type View } from './transform';

const MARGIN = 24;

// Stable colour per group id (golden-angle hue spacing).
function groupColor(groupId: string): string {
  let h = 0;
  for (let i = 0; i < groupId.length; i++) h = (h + groupId.charCodeAt(i) * 137) % 360;
  return `hsl(${h}, 70%, 50%)`;
}

export class Renderer {
  constructor(
    private ctx: CanvasRenderingContext2D,
    private scenario: Scenario,
  ) {}

  draw(agents: Agent[], canvasW: number, canvasH: number): void {
    const ctx = this.ctx;
    const view = fitView(this.scenario.rooms, canvasW, canvasH, MARGIN);
    ctx.clearRect(0, 0, canvasW, canvasH);

    for (const room of this.scenario.rooms) this.drawRoom(room, view);
    this.drawDoorways(view);
    for (const a of agents) {
      if (a.state === 'WAITING' || a.state === 'DONE') continue;
      const p = worldToScreen(a.pos, view);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = groupColor(a.groupId);
      ctx.fill();
    }
  }

  private drawRoom(room: Room, view: View): void {
    const ctx = this.ctx;
    const tl = worldToScreen({ x: room.rect.x, y: room.rect.y }, view);
    const w = room.rect.w * view.scale;
    const h = room.rect.h * view.scale;
    ctx.fillStyle = 'rgba(0,0,0,0.03)';
    ctx.fillRect(tl.x, tl.y, w, h);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.strokeRect(tl.x, tl.y, w, h);
    ctx.fillStyle = '#555';
    ctx.font = '12px sans-serif';
    ctx.fillText(room.id, tl.x + 4, tl.y + 14);
  }

  private drawDoorways(view: View): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#c33';
    for (const d of this.scenario.doorways) {
      const p = worldToScreen(d.at, view);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
