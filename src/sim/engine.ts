import type { Scenario, Room, Point } from '../model/types';
import { moveToward, reached, doorwayBetween, dwellSpot, queueSlot } from './geometry';

export type AgentState = 'WAITING' | 'WALKING' | 'QUEUING' | 'DWELLING' | 'DONE';

export interface Agent {
  id: string;
  groupId: string;
  pos: Point;
  state: AgentState;
  routeIndex: number;
  currentRoom: string;
  target: Point;
  headingTo: 'dwell' | 'doorway';
  pendingDoorway: string | null;
  dwellRemaining: number;
  route: string[];
}

export class Simulation {
  readonly agents: Agent[] = [];
  time = 0;

  protected rooms = new Map<string, Room>();
  protected spawned = new Set<string>();
  protected budget = new Map<string, number>();   // doorway id -> accumulated throughput credit
  protected queues = new Map<string, Agent[]>();   // doorway id -> FIFO of waiting agents

  constructor(protected scenario: Scenario) {
    for (const r of scenario.rooms) this.rooms.set(r.id, r);
    for (const d of scenario.doorways) {
      this.budget.set(d.id, 0);
      this.queues.set(d.id, []);
    }
  }

  reset(): void {
    this.agents.length = 0;
    this.time = 0;
    this.spawned.clear();
    for (const d of this.scenario.doorways) {
      this.budget.set(d.id, 0);
      this.queues.set(d.id, []);
    }
  }

  step(dt: number): void {
    this.time += dt;
    this.spawnGroups();
    for (const d of this.scenario.doorways) {
      this.budget.set(d.id, this.budget.get(d.id)! + d.throughput * dt);
    }
    for (const a of this.agents) this.advance(a, dt);
    this.resolveDoorways();
  }

  protected spawnGroups(): void {
    for (const g of this.scenario.groups) {
      if (this.spawned.has(g.id) || this.time < g.startAt) continue;
      this.spawned.add(g.id);
      const room0 = this.rooms.get(g.route[0])!;
      for (let k = 0; k < g.size; k++) {
        const id = `${g.id}-${k}`;
        const spot = dwellSpot(room0, id);
        this.agents.push({
          id,
          groupId: g.id,
          pos: spot,
          state: 'DWELLING',
          routeIndex: 0,
          currentRoom: g.route[0],
          target: spot,
          headingTo: 'dwell',
          pendingDoorway: null,
          dwellRemaining: room0.dwell,
          route: g.route,
        });
      }
    }
  }

  protected advance(a: Agent, dt: number): void {
    const speed = this.scenario.params.walkSpeed;
    if (a.state === 'WALKING') {
      a.pos = moveToward(a.pos, a.target, speed * dt);
      if (reached(a.pos, a.target)) {
        if (a.headingTo === 'dwell') {
          a.state = 'DWELLING';
          a.dwellRemaining = this.rooms.get(a.currentRoom)!.dwell;
        } else {
          this.enqueue(a);
        }
      }
    } else if (a.state === 'DWELLING') {
      a.dwellRemaining -= dt;
      if (a.dwellRemaining <= 0) {
        if (a.routeIndex >= a.route.length - 1) {
          a.state = 'DONE';
        } else {
          const d = doorwayBetween(
            this.scenario.doorways,
            a.route[a.routeIndex],
            a.route[a.routeIndex + 1],
          )!;
          a.pendingDoorway = d.id;
          a.target = d.at;
          a.headingTo = 'doorway';
          a.state = 'WALKING';
        }
      }
    }
  }

  protected enqueue(a: Agent): void {
    a.state = 'QUEUING';
    const q = this.queues.get(a.pendingDoorway!)!;
    if (!q.includes(a)) q.push(a);
  }

  protected countInRoom(roomId: string): number {
    let n = 0;
    for (const a of this.agents) {
      if (a.state !== 'DONE' && a.currentRoom === roomId) n++;
    }
    return n;
  }

  protected resolveDoorways(): void {
    // Deterministic doorway order.
    const doorways = [...this.scenario.doorways].sort((x, y) => (x.id < y.id ? -1 : 1));
    for (const d of doorways) {
      const q = this.queues.get(d.id)!;
      // Position waiting agents in their slots (on the side of their current room).
      for (let i = 0; i < q.length; i++) {
        const fromRoom = this.rooms.get(q[i].currentRoom)!;
        q[i].pos = queueSlot(d, fromRoom, i);
      }
      // FIFO admission: only the front agent may cross; if it's blocked, all wait.
      while (q.length > 0) {
        const a = q[0];
        const destId = a.route[a.routeIndex + 1];
        const dest = this.rooms.get(destId)!;
        const hasSpace = this.countInRoom(destId) < dest.capacity;
        const hasCredit = this.budget.get(d.id)! >= 1;
        if (hasSpace && hasCredit) {
          this.budget.set(d.id, this.budget.get(d.id)! - 1);
          q.shift();
          this.admit(a);
        } else {
          break;
        }
      }
    }
  }

  protected admit(a: Agent): void {
    const destId = a.route[a.routeIndex + 1];
    const dest = this.rooms.get(destId)!;
    a.routeIndex++;
    a.currentRoom = destId;
    a.target = dwellSpot(dest, a.id);
    a.headingTo = 'dwell';
    a.pendingDoorway = null;
    a.state = 'WALKING';
  }
}
