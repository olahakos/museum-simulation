import type { Scenario, Room, Point } from '../model/types';
import { moveToward, reached, doorwayBetween, dwellSpot } from './geometry';

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

  constructor(protected scenario: Scenario) {
    for (const r of scenario.rooms) this.rooms.set(r.id, r);
  }

  reset(): void {
    this.agents.length = 0;
    this.time = 0;
    this.spawned.clear();
  }

  step(dt: number): void {
    this.time += dt;
    this.spawnGroups();
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
          a.state = 'QUEUING'; // waiting at the doorway to be admitted
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

  // Task 4: no congestion — any QUEUING agent crosses immediately.
  // Task 5 overrides this with capacity + throughput gating.
  protected resolveDoorways(): void {
    for (const a of this.agents) {
      if (a.state === 'QUEUING') this.admit(a);
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
