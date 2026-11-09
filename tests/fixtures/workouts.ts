import { parsePlan } from "../../src/plan/parse";
import { createWorkout, editSet, finish, setCardio, setNotes, setRoundsDone, skipExercise, toggleSet } from "../../src/workout/session";
import type { Workout } from "../../src/workout/types";

export const LEG_DAY_PLAN = `# Leg day
## Squat
strength: 3x5 @ 185 lb, rest 120s
## Tabata
intervals: 8 x 20s work / 10s rest
## Core circuit
circuit: 3 rounds, rest 60s
- Plank 45s
- Dead bug 10 reps
## Easy run
cardio: 20 min
## Hip mobility
other: 10 min
`;

function plan(text: string) {
  const r = parsePlan(text, "lb");
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.plan;
}

export function legDay(): Workout {
  const t = new Date("2026-11-07T12:00:00");
  let w = createWorkout(plan(LEG_DAY_PLAN), LEG_DAY_PLAN, t, "leg-1107");
  w = editSet(w, 0, 2, { reps: 4 });
  for (const i of [0, 1, 2]) w = toggleSet(w, 0, i, t);
  w = setNotes(w, 0, "last rep slow");
  w = setRoundsDone(w, 1, 8);
  w = setRoundsDone(w, 2, 3);
  w = setCardio(w, 3, { durationSec: 1320, distance: 2.1 });
  w = skipExercise(w, 4);
  return finish(w, new Date("2026-11-07T12:52:00"), "Slept badly.");
}

export function olderBench(): Workout {
  const text = "# Push\n## Bench press\nsets: 135x8, 155x6, 175x4, rest 90s";
  const t = new Date("2026-11-03T12:00:00");
  let w = createWorkout(plan(text), text, t, "push-1103");
  w = toggleSet(w, 0, 0, t);
  w = toggleSet(w, 0, 1, t);
  return finish(w, new Date("2026-11-03T12:30:00"));
}
