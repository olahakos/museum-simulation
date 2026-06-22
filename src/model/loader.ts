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
