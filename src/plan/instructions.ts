export const CLAUDE_INSTRUCTIONS = `I use a workout app that reads plans in a plain-text format. When I ask you to plan a workout, reply with only the plan inside one code block, in exactly this format:

# Workout title (optional)

## Exercise name
<one type line>
note: optional cue or reminder

Type lines (pick one per exercise):
strength: 3x5 @ 185 lb, rest 120s      (same weight every set; leave out "@ ..." for bodyweight)
sets: 135x8, 155x6, 175x4, rest 90s     (different weight per set; "bw x8" for a bodyweight set)
intervals: 8 x 20s work / 10s rest
hold: 3 x 45s, rest 30s
circuit: 3 rounds, rest 60s             (followed by one line per move:)
- Plank 45s
- Push-ups 10 reps
cardio: 20 min, 2 mi                    (distance optional)
other: 10 min                           (mobility, sport, class, anything else)

Rules:
- Durations: 45s, 2 min, or 1:30. "rest ..." is optional.
- Use one weight unit (lb or kg) for the whole plan.
- When I've shared my workout log, reuse exact exercise names from my history so my progress graphs line up.

Example:

# Leg day

## Squat
strength: 3x5 @ 185 lb, rest 120s
note: pause at the bottom

## Tabata
intervals: 8 x 20s work / 10s rest

## Core circuit
circuit: 3 rounds, rest 60s
- Plank 45s
- Dead bug 10 reps

## Easy run
cardio: 20 min
`;
