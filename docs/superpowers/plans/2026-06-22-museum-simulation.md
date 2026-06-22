# Museum Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a client-side browser app that animates museum visitor group dynamics — one dot per visitor flowing between rooms, queuing at doorways, and dispersing as fixed routes finish.

**Architecture:** A static Vite site in vanilla TypeScript. A pure, deterministic, DOM-free simulation engine (`sim/`) driven by a JSON scenario (`model/`) is rendered to an HTML5 Canvas (`render/`) and driven by a `requestAnimationFrame` loop with Play/Pause/Reset controls (`app/`). The engine is a fixed-timestep agent state machine; the renderer only draws what the engine computed.

**Tech Stack:** TypeScript (strict), Vite, Canvas 2D, Vitest. No UI framework.

## Global Constraints

- Language: **TypeScript with `strict: true`**. No `any` in committed code.
- **No UI framework** — vanilla TS + DOM only.
- **No backend** — static site; everything runs client-side.
- The **`sim/` and `model/` modules must not import any DOM/canvas APIs** — they must run headless under Vitest/Node.
- The simulation must be **deterministic**: same scenario → identical agent positions/states after the same number of ticks. No `Math.random()` in `sim/`.
- Coordinates are abstract **layout units**; the renderer scales to fit the canvas.
- Spec refinement: the spec's `groups[].entryDoorway` field is dropped. Groups **spawn at `route[0]`** (placed at a deterministic dwell spot) and become `DONE` after dwelling in the final route room.

---

### Task 1: Project scaffold (Vite + TypeScript + Vitest)

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/smoke.test.ts`
- Create/Modify: `.gitignore` (ensure `node_modules`, `dist` ignored)

**Interfaces:**
- Consumes: nothing.
- Produces: a working `npm test` (Vitest) and `npm run dev` (Vite) toolchain for all later tasks.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "museum-simulation",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "types": ["vitest/globals"],
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Museum Simulation</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `src/main.ts` (placeholder)**

```ts
const app = document.getElementById('app');
if (app) app.textContent = 'Museum Simulation — scaffold OK';
```

- [ ] **Step 6: Write the smoke test `src/smoke.test.ts`**

```ts
import { describe, it, expect } from 'vitest';

describe('toolchain', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 7: Install and run the test**

Run: `npm install && npm test`
Expected: Vitest runs, 1 passing test.

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json vite.config.ts index.html src/main.ts src/smoke.test.ts .gitignore
git commit -m "Scaffold Vite + TypeScript + Vitest project (#<issue>)"
```

---

### Task 2: Scenario types and validator

**Files:**
- Create: `src/model/types.ts`
- Create: `src/model/loader.ts`
- Create: `src/model/loader.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - Types: `Point`, `Rect`, `Room`, `Doorway`, `Group`, `Params`, `Scenario`.
  - `validateScenario(s: Scenario): string[]` — returns a list of human-readable error strings; empty array means valid.
  - `loadScenario(data: unknown): Scenario` — casts to `Scenario`, runs `validateScenario`, throws `Error` (joined messages) if invalid, else returns it.

- [ ] **Step 1: Create `src/model/types.ts`**

```ts
export interface Point { x: number; y: number; }
export interface Rect { x: number; y: number; w: number; h: number; }

export interface Room {
  id: string;
  rect: Rect;
  capacity: number;   // max visitors inside at once
  dwell: number;      // desired seconds visitors linger
}

export interface Doorway {
  id: string;
  between: [string, string];  // the two room ids this doorway joins
  at: Point;                  // point on the shared boundary
  throughput: number;         // max visitors/second passing through
}

export interface Group {
  id: string;
  size: number;        // visitors in the group
  startAt: number;     // seconds after sim start when they appear
  route: string[];     // ordered room ids to visit; spawns at route[0]
}

export interface Params {
  walkSpeed: number;   // layout units/second
  tickRate: number;    // sim steps/second (fixed timestep)
  timeScale: number;   // wall-clock speedup for watchability
}

export interface Scenario {
  name: string;
  rooms: Room[];
  doorways: Doorway[];
  groups: Group[];
  params: Params;
}
```

- [ ] **Step 2: Write the failing test `src/model/loader.test.ts`**

```ts
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
    params: { walkSpeed: 40, tickRate: 30, timeScale: 8 },
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- loader`
Expected: FAIL — `loader.ts` does not exist / exports undefined.

- [ ] **Step 4: Implement `src/model/loader.ts`**

```ts
import type { Scenario } from './types';

export function validateScenario(s: Scenario): string[] {
  const errors: string[] = [];
  const roomIds = new Set(s.rooms.map((r) => r.id));

  // Doorways must reference real rooms.
  for (const d of s.doorways) {
    for (const rid of d.between) {
      if (!roomIds.has(rid)) {
        errors.push(`Doorway "${d.id}" references unknown room "${rid}".`);
      }
    }
  }

  // Build an adjacency set of connected room pairs.
  const connected = new Set<string>();
  const key = (x: string, y: string) => [x, y].sort().join('::');
  for (const d of s.doorways) connected.add(key(d.between[0], d.between[1]));

  // Routes must reference real rooms and only step between connected rooms.
  for (const g of s.groups) {
    if (g.route.length === 0) {
      errors.push(`Group "${g.id}" has an empty route.`);
    }
    for (const rid of g.route) {
      if (!roomIds.has(rid)) {
        errors.push(`Group "${g.id}" route references unknown room "${rid}".`);
      }
    }
    for (let i = 0; i < g.route.length - 1; i++) {
      const from = g.route[i];
      const to = g.route[i + 1];
      if (roomIds.has(from) && roomIds.has(to) && !connected.has(key(from, to))) {
        errors.push(
          `Group "${g.id}" route steps from "${from}" to "${to}" but no doorway connects them.`,
        );
      }
    }
  }

  return errors;
}

export function loadScenario(data: unknown): Scenario {
  const scenario = data as Scenario;
  const errors = validateScenario(scenario);
  if (errors.length > 0) {
    throw new Error(`Invalid scenario:\n- ${errors.join('\n- ')}`);
  }
  return scenario;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- loader`
Expected: PASS — all 6 tests green.

- [ ] **Step 6: Commit**

```bash
git add src/model/types.ts src/model/loader.ts src/model/loader.test.ts
git commit -m "Add scenario types and referential-integrity validator (#<issue>)"
```

---

### Task 3: Geometry helpers

**Files:**
- Create: `src/sim/geometry.ts`
- Create: `src/sim/geometry.test.ts`

**Interfaces:**
- Consumes: `Room`, `Doorway`, `Point` from `../model/types`.
- Produces:
  - `roomCenter(room: Room): Point`
  - `distance(a: Point, b: Point): number`
  - `moveToward(from: Point, to: Point, maxDist: number): Point`
  - `reached(a: Point, b: Point, eps?: number): boolean` (default `eps = 0.5`)
  - `doorwayBetween(doorways: Doorway[], a: string, b: string): Doorway | undefined`
  - `dwellSpot(room: Room, seed: string): Point` — deterministic scatter inside the room
  - `queueSlot(doorway: Doorway, fromRoom: Room, index: number): Point`

- [ ] **Step 1: Write the failing test `src/sim/geometry.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  roomCenter, distance, moveToward, reached, doorwayBetween, dwellSpot, queueSlot,
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

  it('queueSlot steps back from the doorway toward the room centre', () => {
    const door: Doorway = { id: 'a_b', between: ['a', 'b'], at: { x: 100, y: 40 }, throughput: 1 };
    const s0 = queueSlot(door, room, 0);
    const s1 = queueSlot(door, room, 1);
    // Both move left of the doorway (toward centre x=50); slot 1 is further.
    expect(s0.x).toBeLessThan(door.at.x);
    expect(s1.x).toBeLessThan(s0.x);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- geometry`
Expected: FAIL — `geometry.ts` does not exist.

- [ ] **Step 3: Implement `src/sim/geometry.ts`**

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- geometry`
Expected: PASS — all geometry tests green.

- [ ] **Step 5: Commit**

```bash
git add src/sim/geometry.ts src/sim/geometry.test.ts
git commit -m "Add deterministic geometry helpers for the sim (#<issue>)"
```

---

### Task 4: Simulation engine — spawn, walk, dwell, route progression

Builds the engine with **no congestion yet**: agents always cross a doorway the moment they reach it. Congestion (capacity + throughput + queuing) is added in Task 5.

**Files:**
- Create: `src/sim/engine.ts`
- Create: `src/sim/engine.test.ts`

**Interfaces:**
- Consumes: `Scenario`, `Room`, `Point` from `../model/types`; all helpers from `./geometry`.
- Produces:
  - `type AgentState = 'WAITING' | 'WALKING' | 'QUEUING' | 'DWELLING' | 'DONE'`
  - `interface Agent { id; groupId; pos: Point; state: AgentState; routeIndex: number; currentRoom: string; target: Point; headingTo: 'dwell' | 'doorway'; pendingDoorway: string | null; dwellRemaining: number; route: string[] }`
  - `class Simulation { constructor(scenario: Scenario); readonly agents: Agent[]; time: number; step(dt: number): void; reset(): void }`

- [ ] **Step 1: Write the failing test `src/sim/engine.test.ts`**

```ts
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
    params: { walkSpeed: 50, tickRate: 30, timeScale: 1 },
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- engine`
Expected: FAIL — `engine.ts` does not exist.

- [ ] **Step 3: Implement `src/sim/engine.ts`**

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- engine`
Expected: PASS — all 5 engine tests green.

- [ ] **Step 5: Commit**

```bash
git add src/sim/engine.ts src/sim/engine.test.ts
git commit -m "Add simulation engine: spawn, walk, dwell, route progression (#<issue>)"
```

---

### Task 5: Congestion — room capacity, doorway throughput, FIFO queuing

Replaces the trivial `resolveDoorways`/`admit` with real gating: a destination room at capacity blocks entry, each doorway admits at most `throughput` visitors/second, and waiting agents are served **FIFO** (deterministic).

**Files:**
- Modify: `src/sim/engine.ts`
- Modify: `src/sim/engine.test.ts` (add congestion tests)

**Interfaces:**
- Consumes: same as Task 4, plus `queueSlot`, `roomCenter` from `./geometry`.
- Produces: same public API (`Simulation`); behavior now respects `room.capacity` and `doorway.throughput`.

- [ ] **Step 1: Add failing congestion tests to `src/sim/engine.test.ts`**

```ts
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
      params: { walkSpeed: 50, tickRate: 30, timeScale: 1 },
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
      params: { walkSpeed: 1000, tickRate: 30, timeScale: 1 },
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
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npm test -- engine`
Expected: FAIL — capacity is ignored, so all 3 enter `b` and nothing queues.

- [ ] **Step 3: Update `src/sim/engine.ts` — add congestion state and gating**

Add imports and per-doorway state. Change the import line and class fields:

```ts
import { moveToward, reached, doorwayBetween, dwellSpot, queueSlot } from './geometry';
```

Add these fields to the class (next to `spawned`):

```ts
  protected budget = new Map<string, number>();   // doorway id -> accumulated throughput credit
  protected queues = new Map<string, Agent[]>();   // doorway id -> FIFO of waiting agents
```

Initialise them in the constructor (after the rooms loop):

```ts
    for (const d of scenario.doorways) {
      this.budget.set(d.id, 0);
      this.queues.set(d.id, []);
    }
```

Extend `reset()` to clear them:

```ts
  reset(): void {
    this.agents.length = 0;
    this.time = 0;
    this.spawned.clear();
    for (const d of this.scenario.doorways) {
      this.budget.set(d.id, 0);
      this.queues.set(d.id, []);
    }
  }
```

Refill budgets each tick — change `step()`:

```ts
  step(dt: number): void {
    this.time += dt;
    this.spawnGroups();
    for (const d of this.scenario.doorways) {
      this.budget.set(d.id, this.budget.get(d.id)! + d.throughput * dt);
    }
    for (const a of this.agents) this.advance(a, dt);
    this.resolveDoorways();
  }
```

In `advance()`, when a WALKING agent reaches a doorway, enqueue it (replace the `else { a.state = 'QUEUING'; }` branch):

```ts
        } else {
          this.enqueue(a);
        }
```

Replace `resolveDoorways()` and `admit()` with the gated, FIFO versions, and add `enqueue()` and `countInRoom()`:

```ts
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
```

Note: `admit()` from Task 4 stays as-is (it advances the route and sets the agent walking into the destination). The Task 4 version that looped over all agents is fully replaced by `resolveDoorways()` above.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- engine`
Expected: PASS — Task 4 tests still green, plus the 3 congestion tests.

- [ ] **Step 5: Commit**

```bash
git add src/sim/engine.ts src/sim/engine.test.ts
git commit -m "Add congestion model: room capacity, doorway throughput, FIFO queuing (#<issue>)"
```

---

### Task 6: Determinism guarantee test

Locks in the project-wide determinism constraint with a dedicated test.

**Files:**
- Create: `src/sim/determinism.test.ts`

**Interfaces:**
- Consumes: `Simulation` from `./engine`.
- Produces: nothing (test only).

- [ ] **Step 1: Write the test `src/sim/determinism.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { Simulation } from './engine';
import type { Scenario } from '../model/types';

function scenario(): Scenario {
  return {
    name: 'D',
    rooms: [
      { id: 'a', rect: { x: 0, y: 0, w: 100, h: 100 }, capacity: 2, dwell: 1 },
      { id: 'b', rect: { x: 100, y: 0, w: 100, h: 100 }, capacity: 2, dwell: 3 },
      { id: 'c', rect: { x: 200, y: 0, w: 100, h: 100 }, capacity: 2, dwell: 2 },
    ],
    doorways: [
      { id: 'a_b', between: ['a', 'b'], at: { x: 100, y: 50 }, throughput: 0.7 },
      { id: 'b_c', between: ['b', 'c'], at: { x: 200, y: 50 }, throughput: 0.7 },
    ],
    groups: [
      { id: 'g1', size: 4, startAt: 0, route: ['a', 'b', 'c'] },
      { id: 'g2', size: 4, startAt: 0.5, route: ['a', 'b', 'c'] },
    ],
    params: { walkSpeed: 40, tickRate: 30, timeScale: 1 },
  };
}

function snapshot(sim: Simulation) {
  return sim.agents
    .map((a) => `${a.id}:${a.state}:${a.pos.x.toFixed(4)}:${a.pos.y.toFixed(4)}`)
    .sort();
}

describe('determinism', () => {
  it('produces identical state after N ticks across two runs', () => {
    const dt = 1 / 30;
    const ticks = 300;
    const s1 = new Simulation(scenario());
    const s2 = new Simulation(scenario());
    for (let i = 0; i < ticks; i++) { s1.step(dt); s2.step(dt); }
    expect(snapshot(s1)).toEqual(snapshot(s2));
  });

  it('reset replays identically', () => {
    const dt = 1 / 30;
    const sim = new Simulation(scenario());
    for (let i = 0; i < 150; i++) sim.step(dt);
    const first = snapshot(sim);
    sim.reset();
    for (let i = 0; i < 150; i++) sim.step(dt);
    expect(snapshot(sim)).toEqual(first);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npm test -- determinism`
Expected: PASS — both runs and the reset replay match exactly.

- [ ] **Step 3: Commit**

```bash
git add src/sim/determinism.test.ts
git commit -m "Add determinism guarantee tests (#<issue>)"
```

---

### Task 7: Example scenario JSON

**Files:**
- Create: `scenarios/example.json`
- Create: `src/model/example.test.ts`

**Interfaces:**
- Consumes: `loadScenario` from `./loader`.
- Produces: `scenarios/example.json` — the default scenario the app loads.

- [ ] **Step 1: Create `scenarios/example.json`**

```json
{
  "name": "Example Museum",
  "rooms": [
    { "id": "lobby",   "rect": { "x": 0,   "y": 100, "w": 180, "h": 160 }, "capacity": 40, "dwell": 0 },
    { "id": "hall_a",  "rect": { "x": 180, "y": 0,   "w": 200, "h": 160 }, "capacity": 12, "dwell": 90 },
    { "id": "hall_b",  "rect": { "x": 180, "y": 200, "w": 200, "h": 160 }, "capacity": 12, "dwell": 120 },
    { "id": "gallery", "rect": { "x": 380, "y": 100, "w": 220, "h": 160 }, "capacity": 8,  "dwell": 150 }
  ],
  "doorways": [
    { "id": "lobby_hallA",  "between": ["lobby", "hall_a"],   "at": { "x": 180, "y": 150 }, "throughput": 1.2 },
    { "id": "lobby_hallB",  "between": ["lobby", "hall_b"],   "at": { "x": 180, "y": 230 }, "throughput": 1.2 },
    { "id": "hallA_gallery","between": ["hall_a", "gallery"], "at": { "x": 380, "y": 150 }, "throughput": 0.8 },
    { "id": "hallB_gallery","between": ["hall_b", "gallery"], "at": { "x": 380, "y": 230 }, "throughput": 0.8 }
  ],
  "groups": [
    { "id": "g1", "size": 6, "startAt": 0,  "route": ["lobby", "hall_a", "gallery", "lobby"] },
    { "id": "g2", "size": 6, "startAt": 20, "route": ["lobby", "hall_b", "gallery", "lobby"] },
    { "id": "g3", "size": 6, "startAt": 40, "route": ["lobby", "hall_a", "gallery", "lobby"] }
  ],
  "params": { "walkSpeed": 40, "tickRate": 30, "timeScale": 8 }
}
```

- [ ] **Step 2: Write the failing test `src/model/example.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { loadScenario } from './loader';
import example from '../../scenarios/example.json';

describe('example scenario', () => {
  it('passes validation', () => {
    expect(() => loadScenario(example)).not.toThrow();
  });

  it('has the expected name', () => {
    expect(loadScenario(example).name).toBe('Example Museum');
  });
});
```

- [ ] **Step 3: Enable JSON imports — confirm `tsconfig.json` has `resolveJsonModule`**

Add `"resolveJsonModule": true` to `compilerOptions` in `tsconfig.json` if not already present.

- [ ] **Step 4: Run the test**

Run: `npm test -- example`
Expected: PASS — the example scenario validates. (If it fails, the error message names the offending room/doorway/route — fix the JSON.)

- [ ] **Step 5: Commit**

```bash
git add scenarios/example.json src/model/example.test.ts tsconfig.json
git commit -m "Add example museum scenario and validation test (#<issue>)"
```

---

### Task 8: Renderer (canvas fit transform + drawing)

**Files:**
- Create: `src/render/transform.ts`
- Create: `src/render/transform.test.ts`
- Create: `src/render/renderer.ts`

**Interfaces:**
- Consumes: `Scenario`, `Room`, `Point` from `../model/types`; `Agent` from `../sim/engine`.
- Produces:
  - `interface View { scale: number; offsetX: number; offsetY: number }`
  - `layoutBounds(rooms: Room[]): { minX; minY; maxX; maxY }`
  - `fitView(rooms: Room[], canvasW: number, canvasH: number, margin: number): View`
  - `worldToScreen(p: Point, view: View): Point`
  - `class Renderer { constructor(ctx: CanvasRenderingContext2D, scenario: Scenario); draw(agents: Agent[], canvasW: number, canvasH: number): void }`

- [ ] **Step 1: Write the failing test `src/render/transform.test.ts`**

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- transform`
Expected: FAIL — `transform.ts` does not exist.

- [ ] **Step 3: Implement `src/render/transform.ts`**

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- transform`
Expected: PASS.

- [ ] **Step 5: Implement `src/render/renderer.ts` (drawing; verified by eye in Task 9)**

```ts
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
```

- [ ] **Step 6: Commit**

```bash
git add src/render/transform.ts src/render/transform.test.ts src/render/renderer.ts
git commit -m "Add canvas renderer and fit-to-view transform (#<issue>)"
```

---

### Task 9: App wiring — rAF loop, controls, entry point

Ties everything together into the running QA app: load the example scenario, draw it, and drive the engine with a fixed-timestep accumulator under Play/Pause/Reset.

**Files:**
- Modify: `src/main.ts`
- Create: `src/app/app.ts`

**Interfaces:**
- Consumes: `loadScenario`, `Simulation`, `Renderer`, example JSON.
- Produces: the running app (manually verified).

- [ ] **Step 1: Implement `src/app/app.ts`**

```ts
import { loadScenario } from '../model/loader';
import { Simulation } from '../sim/engine';
import { Renderer } from '../render/renderer';
import exampleJson from '../../scenarios/example.json';

export function startApp(root: HTMLElement): void {
  const scenario = loadScenario(exampleJson);

  // --- DOM chrome ---
  root.innerHTML = '';
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:8px;align-items:center;padding:8px;font:14px sans-serif;';
  const playBtn = document.createElement('button');
  playBtn.textContent = 'Play';
  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'Reset';
  const title = document.createElement('span');
  title.textContent = scenario.name;
  const clock = document.createElement('span');
  clock.style.marginLeft = 'auto';
  bar.append(playBtn, resetBtn, title, clock);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  root.append(bar, canvas);

  function sizeCanvas(): void {
    canvas.width = root.clientWidth;
    canvas.height = Math.max(300, window.innerHeight - bar.offsetHeight - 16);
  }
  sizeCanvas();
  window.addEventListener('resize', sizeCanvas);

  // --- sim + render loop ---
  const sim = new Simulation(scenario);
  const renderer = new Renderer(ctx, scenario);
  const dt = 1 / scenario.params.tickRate;
  const timeScale = scenario.params.timeScale;

  let playing = false;
  let last = 0;
  let acc = 0;

  function frame(now: number): void {
    if (last === 0) last = now;
    const realElapsed = (now - last) / 1000;
    last = now;

    if (playing) {
      acc += realElapsed * timeScale;
      // Step in fixed increments; cap to avoid spiral-of-death after a stall.
      let steps = 0;
      while (acc >= dt && steps < 1000) {
        sim.step(dt);
        acc -= dt;
        steps++;
      }
    }

    renderer.draw(sim.agents, canvas.width, canvas.height);
    clock.textContent = `t = ${sim.time.toFixed(1)}s`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // --- controls ---
  playBtn.addEventListener('click', () => {
    playing = !playing;
    playBtn.textContent = playing ? 'Pause' : 'Play';
  });
  resetBtn.addEventListener('click', () => {
    sim.reset();
    acc = 0;
    playing = false;
    playBtn.textContent = 'Play';
  });
}
```

- [ ] **Step 2: Replace `src/main.ts`**

```ts
import { startApp } from './app/app';

const root = document.getElementById('app');
if (root) startApp(root);
```

- [ ] **Step 3: Run the app and verify by eye**

Run: `npm run dev`
Open the printed URL (default `http://localhost:5173`). Expected:
- Four rooms drawn with labels; red dots mark doorways.
- Click **Play**: coloured dots appear in the lobby, walk through doorways, cluster/queue at the narrow gallery doorways, dwell, and disappear after returning to the lobby.
- The clock advances; **Pause** freezes; **Reset** clears and returns to t=0.

- [ ] **Step 4: Build to confirm the production bundle compiles**

Run: `npm run build`
Expected: `tsc` passes with no type errors; `vite build` writes `dist/`.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts src/app/app.ts
git commit -m "Wire up app: rAF loop, Play/Pause/Reset, canvas mount (#<issue>)"
```

---

### Task 10: Document the QA restart command and stack in CLAUDE.md

CLAUDE.md asks that the Stack section and QA restart procedure be filled in once the first implementation lands.

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: nothing.
- Produces: documentation only.

- [ ] **Step 1: Replace the `## Stack` section of `CLAUDE.md`**

Replace the existing "TBD" Stack section with:

```markdown
## Stack

- **Language:** TypeScript (strict), no UI framework.
- **Build/dev:** Vite. **Test:** Vitest. **Render:** HTML5 Canvas 2D.
- **Entry point:** `src/main.ts` → `src/app/app.ts`.
- **Install:** `npm install`
- **Test:** `npm test`
- **Build:** `npm run build` (outputs `dist/`)
- **Run (QA app):** `npm run dev` — serves on `http://localhost:5173` by default.
- **QA restart:** stop any running `vite` dev server and run `npm run dev` again.
  For the production-like build: `npm run build && npm run preview`
  (serves `dist/` on `http://localhost:4173`).

The simulation engine (`src/sim/`) and model (`src/model/`) are pure and
DOM-free — run them headless under Vitest. The renderer (`src/render/`) and app
wiring (`src/app/`) own all DOM/canvas access.
```

- [ ] **Step 2: Verify the documented commands work**

Run: `npm install && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "Document stack and QA restart procedure (#<issue>)"
```

---

## Self-Review

**Spec coverage:**
- Browser web app, client-side only, static → Tasks 1, 9 (Vite static site). ✓
- JSON scenario input → Tasks 2, 7. ✓
- Fixed route per group → Task 2 types (`route`), Task 4 progression. ✓
- Room capacity + doorway throughput → Task 5. ✓
- Continuous positions, fixed-timestep tick → Task 4 (`step(dt)`, `moveToward`), Task 9 (accumulator). ✓
- Paths as edges, doorways as boundary points → Task 2 (`Doorway.at`/`between`), Task 3 (`doorwayBetween`). ✓
- Minimal UI (load, Play/Pause, Reset, clock) → Task 9. ✓
- `timeScale` as config not UI → Task 9 reads `params.timeScale`. ✓
- Determinism → Task 6, plus global no-`Math.random` constraint (Task 3 uses FNV hash). ✓
- Module boundaries (pure sim/model vs DOM render/app) → enforced by structure + global constraint; sim/model tests run in Node env. ✓
- Validator with clear errors → Task 2. ✓
- Test strategy (engine, validator, geometry, determinism) → Tasks 2–6, 8. ✓
- QA restart documented in CLAUDE.md → Task 10. ✓

**Spec refinement noted:** `entryDoorway` dropped in favour of spawn-at-`route[0]` / despawn-after-final-room (Global Constraints + Task 4). This is the one intentional deviation from the spec's JSON example.

**Placeholder scan:** No TBD/TODO/"handle edge cases" — every code step contains real code. The only `<issue>` placeholders are in commit messages, to be replaced with the implementation issue number at execution time.

**Type consistency:** `Agent`, `View`, `Simulation`, `Scenario`, and all geometry/transform signatures are defined once and referenced consistently across tasks. `resolveDoorways`/`admit`/`enqueue`/`countInRoom` names match between Tasks 4 and 5.
