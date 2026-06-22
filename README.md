# Museum Simulation

Discrete-event simulation of visitor group dynamics through a museum.

## Inputs
- Museum layout (floor plan with rooms and connecting paths)
- Visitor group parameters: size per group, time delay between group starts
- Per-room parameters: desired dwell time (how long visitors want to spend in each room)

## Output
Animated visualization of the museum layout with one dot per simulated visitor
overlaid on it. Watch groups flow between rooms, queue at doorways, and disperse
as their planned routes finish.

## Status
Scaffolding. No implementation yet. The first issue tracks the next step.

## Conventions
See CLAUDE.md for the development workflow (issue-first, merge-after-approval,
QA restart on handoff).
