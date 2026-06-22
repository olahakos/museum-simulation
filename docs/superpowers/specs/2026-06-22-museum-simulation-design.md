# Museum Simulation — Design

**Date:** 2026-06-22
**Status:** Approved (brainstorming complete; implementation plan to follow)

## Goal

A browser-based, client-side simulation that animates visitor group dynamics
through a museum. Given a museum layout (rooms + connecting doorways) and
visitor parameters (group size, start delay, per-room dwell), it shows one dot
per simulated visitor flowing between rooms, queuing at doorways, and dispersing
as their planned routes finish.

## Settled decisions

| Decision | Choice |
|----------|--------|
| Platform | Browser web app |
| Compute location | Client-side only (no backend; static site) |
| Layout input | JSON scenario file (hand-digitized from floor-plan images, assisted) |
| Visitor behavior | Fixed route per group (ordered room list) |
| Congestion model | Room capacity **and** doorway throughput |
| Movement model | Continuous positions, fixed-timestep agent tick |
| Path geometry | Paths are edges; doorways are points on shared room boundaries |
| Interaction | Minimal — load, Play/Pause, Reset, sim-clock readout |
| Stack | Vanilla TypeScript (strict) + Canvas 2D + Vite; Vitest for tests |

A `timeScale` config multiplier speeds up wall-clock playback so minute-scale
dwell times are watchable. It is a config value, not a UI control (honoring the
"minimal" interaction choice).

## Architecture & module boundaries

Static site, no backend. Plain TypeScript modules bundled by Vite. Hard
separation between **simulation** (pure, deterministic, no DOM) and
**presentation** (canvas + buttons). The renderer only draws what the sim
produced.

```
src/
  model/        scenario types + JSON loader/validator   (no DOM)
  sim/          the deterministic engine                  (no DOM)
    engine.ts     tick loop, agent state machine
    geometry.ts   points, distances, doorway waypoints
  render/        canvas drawing of layout + dots          (DOM/canvas only)
  app/           wiring: load scenario, Play/Reset, rAF loop
  main.ts       entry point
scenarios/      example JSON layouts (committed)
```

Key boundary: `sim/` exports a `Simulation` that can be stepped in a headless
Node/Vitest test with no browser. `engine.step(dt)` advances agent state;
`render/` reads `engine.agents` and draws. Because the sim is deterministic
(fixed routes, fixed params, fixed tick), the same scenario always produces the
same frames — testable, and a foundation for a future record/scrub feature.

## Data model (JSON scenario schema)

The scenario file is the single source of truth: hand-digitized from a
floor-plan image, consumed directly by the sim. Coordinates are abstract layout
units; the renderer scales to fit the canvas.

```jsonc
{
  "name": "Example Museum",
  "rooms": [
    {
      "id": "lobby",
      "rect": { "x": 0, "y": 0, "w": 200, "h": 150 },
      "capacity": 30,        // max visitors inside (room-capacity constraint)
      "dwell": 0             // desired seconds visitors linger (entrance = 0)
    },
    { "id": "hall_a", "rect": { "x": 200, "y": 0, "w": 180, "h": 150 }, "capacity": 12, "dwell": 120 }
  ],
  "doorways": [
    {
      "id": "lobby_hallA",
      "between": ["lobby", "hall_a"],
      "at": { "x": 200, "y": 75 },   // point on the shared boundary
      "throughput": 1.5              // max visitors/second passing through
    }
  ],
  "groups": [
    {
      "id": "g1",
      "size": 5,
      "startAt": 0,                  // seconds after sim start
      "route": ["lobby", "hall_a", "lobby"],  // ordered room ids; ends at exit
      "entryDoorway": "lobby"        // where they appear / leave
    }
  ],
  "params": {
    "walkSpeed": 40,        // layout units/second
    "tickRate": 30,         // sim steps/second (fixed timestep)
    "timeScale": 8          // wall-clock speedup for watchability (config, not UI)
  }
}
```

Deliberate choices:
- **Doorways are points on a shared boundary**, referenced by the two rooms they
  join (paths-as-edges). Movement = walk toward next doorway, pass through,
  repeat.
- **`capacity` per room + `throughput` per doorway** are the two congestion
  knobs.
- **`dwell` is per-room** (the desired dwell). A group's actual time in a room
  may exceed it when blocked by queuing.
- **`route` is an explicit ordered room list** per group; `startAt` is the start
  delay; `size` the group size; `entryDoorway` where the group appears and
  exits.
- A `model/` **validator** checks referential integrity (every route room
  exists; every doorway's rooms exist; routes only step between connected rooms)
  and fails loudly with a clear message — the safety net for hand-digitizing.

## Simulation engine

Fixed-timestep loop. Each agent (one dot = one visitor) is a small state
machine; the engine steps every agent forward by `dt = 1/tickRate` each tick.
Pure, deterministic, no DOM.

**Agent states:**
- `WAITING` — group hasn't started (before `startAt`); not drawn.
- `WALKING` — moving straight toward a target point (next doorway, dwell spot, or
  queue slot) at `walkSpeed`.
- `QUEUING` — arrived at a doorway but blocked; standing in a queue slot near it.
- `DWELLING` — inside a room at a scatter spot, counting down that room's
  `dwell`.
- `DONE` — finished route, walked out the entry doorway; not drawn.

**Per-tick logic:**
1. Activate any groups whose `startAt` has passed → agents spawn at the entry
   doorway in `WALKING`.
2. For each active agent, advance its state:
   - `WALKING` → move toward target; on arrival, transition (dwell spot →
     `DWELLING`; doorway → attempt to cross).
   - `DWELLING` → decrement timer; at zero, target the next doorway on the route
     and go `WALKING` (or `DONE` if the route is finished).
   - Crossing a doorway is gated by **two constraints**: destination room
     `capacity` (space available?) and doorway `throughput` (a per-doorway
     visitors/sec budget refilled each tick). If either blocks, the agent
     `QUEUING`s in the next free slot; otherwise it passes and enters.
3. Drain queues: each doorway, in arrival order (**FIFO** — deterministic),
   admits as many waiting agents as throughput **and** destination capacity allow
   this tick.

**Dwell spots & queue slots** are computed deterministically from room/doorway
geometry: dwell spots are a fixed scatter pattern seeded by agent id (stable,
not random-per-run); queue slots step back from the doorway. Reproducible by
construction.

**Output:** `engine.agents` — each `{ id, groupId, pos:{x,y}, state }`. That is
all the renderer needs.

Determinism rests on FIFO queue ordering and id-seeded (not per-run-random)
scatter: same scenario → identical frames every run.

## Rendering, UI & project setup

**Render loop** (`render/` + `app/`): a `requestAnimationFrame` loop. Each frame,
advance sim time by `realElapsed × timeScale`, step the engine in fixed
`1/tickRate` increments (accumulator pattern, so animation speed is independent
of display refresh rate), then redraw:

- Rooms: stroked rectangles, faint fill, id label. Doorways: a gap/marker on the
  boundary.
- Visitors: filled dots colored by `groupId` (track a group through the museum).
  Optional faint per-room count badge (inside vs capacity).
- Renderer fits the layout bounding box to the canvas with a margin; resizes with
  the window. Reads `engine.agents` and draws — no sim logic inside.

**UI (minimal):** a thin bar with **Play/Pause**, **Reset**, the scenario name,
and an elapsed sim-clock readout. Scenario loads from `scenarios/<default>.json`;
a file picker is a trivial later add. No parameter editing, no scrub.

**Project setup:**
- **Vite + TypeScript (strict)**, vanilla — no framework.
- **Vitest** for unit tests (pure sim tests headless).
- Scripts: `npm run dev` (Vite dev server — the QA app), `npm run build`,
  `npm run preview` (serve built app), `npm test`.
- **QA restart** = `npm run dev` (or `build` + `preview` for the production-like
  app). Exact command + port to be documented in CLAUDE.md's Stack section once
  running, per repo convention.

**Testing strategy:**
- Engine unit tests: agent walks a straight route on schedule; a full room makes
  the next group queue; doorway throughput caps admissions/sec; a group reaches
  `DONE`; determinism (same scenario → identical positions after N ticks).
- Validator tests: bad route / missing room / unconnected step each fail with a
  clear error.
- Geometry tests: distances, doorway waypoints, queue-slot placement.
- Renderer stays thin and is verified by eye in the running app.

## Out of scope (deferred)

- Backend / scenario persistence (client-side only for now).
- In-browser visual layout editor and image-tracing tool (hand-digitize,
  assisted, for now).
- Goal-driven auto-routing / probabilistic wandering (fixed routes for now).
- Playback scrubbing, speed slider, live parameter editing (minimal UI for now).
- Real corridor geometry (paths are edges; model long corridors as skinny rooms
  if needed — no schema change).
