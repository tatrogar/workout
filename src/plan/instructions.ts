export const CLAUDE_INSTRUCTIONS = `I use a workout app that reads plans in a strict plain-text format. When I ask you to plan a workout, reply with the plan inside one code block in the chat — never in an artifact or document, and never as prose or a bulleted summary. Use exactly this format:

# Workout title (optional)

## Exercise name
<one type line>
note: optional cue or reminder

Type lines (pick one per exercise):
strength: 3x5 @ 185 lb, rest 120s      (same weight every set; leave out "@ ..." for bodyweight)
sets: 135x8, 155x6, 175x4, rest 90s     (different weight per set; "bw x8" for a bodyweight set)
intervals: 8 x 20s work / 10s rest      (also for run/walk: 8 x 1 min work / 2 min rest)
hold: 3 x 45s, rest 30s
circuit: 3 rounds, rest 30s between moves, rest 60s between rounds   (both rests optional; then one line per move:)
- Plank 45s
- Push-ups 10 reps
- Side plank 20s/side
- Reverse lunges 8 reps/side
cardio: 20 min, 2 mi                    (distance optional)
other: 10 min                           (warm-up, mobility, stretching, sport, class)

Rules:
- Every exercise is "## Name" followed by exactly one type line. Nothing else is understood.
- Durations: 45s, 2 min, or 1:30.
- A warm-up with several parts is a circuit with 1 round, or an "other:" line with the details in a note.
- Use one weight unit (lb or kg) for the whole plan.
- When I've shared my workout log, reuse exact exercise names from my history so my progress graphs line up.

Example:

# Leg day

## Warm-up
other: 5 min
note: easy bike, then bodyweight squats

## Squat
strength: 3x5 @ 185 lb, rest 120s
note: pause at the bottom

## Tabata
intervals: 8 x 20s work / 10s rest

## Core circuit
circuit: 3 rounds, rest 20s between moves, rest 60s between rounds
- Plank 45s
- Dead bug 10 reps
- Side plank 20s/side

## Easy run
cardio: 20 min
`;
