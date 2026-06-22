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
