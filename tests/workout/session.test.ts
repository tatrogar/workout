import { describe, expect, it } from "vitest";
import { parsePlan } from "../../src/plan/parse";
import {
  addSet, createWorkout, editSet, exerciseStatus, finish, setCardio, setCurrent, setNotes,
  setRoundsDone, skipExercise, toggleHold, toggleSet,
} from "../../src/workout/session";
import type { Workout } from "../../src/workout/types";
import { SPEC_EXAMPLE } from "../plan/example";

const NOW = new Date("2026-11-07T17:00:00");
function make(): Workout {
  const r = parsePlan(SPEC_EXAMPLE, "lb");
  if (!r.ok) throw new Error("bad plan");
  return deepFreeze(createWorkout(r.plan, SPEC_EXAMPLE, NOW, "w1"));
}
function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object") { Object.values(o).forEach(deepFreeze); Object.freeze(o); }
  return o;
}

describe("createWorkout", () => {
  it("prefills from the plan", () => {
    const w = make();
    expect(w).toMatchObject({ id: "w1", title: "Leg day", units: "lb", startedAt: NOW.toISOString(), planText: SPEC_EXAMPLE });
    expect(w.finishedAt).toBeUndefined();
    expect(w.exercises).toHaveLength(8);
    expect(w.exercises[0].sets).toEqual([
      { weight: 185, reps: 5, done: false }, { weight: 185, reps: 5, done: false }, { weight: 185, reps: 5, done: false },
    ]);
    expect(w.exercises[4].holds).toEqual([{ sec: 45, done: false }, { sec: 45, done: false }, { sec: 45, done: false }]);
  });
  it("defaults the title to the date", () => {
    const r = parsePlan("## Squat\nstrength: 3x5", "lb");
    if (!r.ok) throw new Error();
    expect(createWorkout(r.plan, "", NOW).title).toBe("2026-11-07");
  });
});

describe("reducers", () => {
  it("strength status follows checked sets", () => {
    let w = make();
    expect(exerciseStatus(w.exercises[0])).toBe("skipped");
    w = toggleSet(w, 0, 0, NOW);
    w = toggleSet(w, 0, 1, NOW);
    expect(exerciseStatus(w.exercises[0])).toBe("partial");
    w = toggleSet(w, 0, 2, NOW);
    expect(exerciseStatus(w.exercises[0])).toBe("done");
    expect(w.exercises[0].sets![0].at).toBe(NOW.toISOString());
    w = toggleSet(w, 0, 2, NOW);
    expect(w.exercises[0].sets![2].done).toBe(false);
  });
  it("edits keep the plan unchanged", () => {
    let w = make();
    w = editSet(w, 0, 0, { weight: 190 });
    w = toggleSet(w, 0, 0, NOW);
    expect(w.exercises[0].sets![0]).toMatchObject({ weight: 190, reps: 5, done: true });
    expect(w.exercises[0].planned).toMatchObject({ sets: [{ weight: 185 }, { weight: 185 }, { weight: 185 }] });
  });
  it("addSet copies the last set", () => {
    const w = addSet(make(), 1, );
    expect(w.exercises[1].sets!.at(-1)).toEqual({ weight: 175, reps: 4, done: false });
  });
  it("rounds and holds", () => {
    let w = setRoundsDone(make(), 3, 6);
    expect(exerciseStatus(w.exercises[3])).toBe("partial");
    w = setRoundsDone(w, 3, 8);
    expect(exerciseStatus(w.exercises[3])).toBe("done");
    w = toggleHold(w, 4, 0);
    expect(exerciseStatus(w.exercises[4])).toBe("partial");
  });
  it("cardio and other", () => {
    let w = setCardio(make(), 6, { durationSec: 1320, distance: 2.1 });
    expect(w.exercises[6]).toMatchObject({ durationSec: 1320, distance: 2.1 });
    expect(exerciseStatus(w.exercises[6])).toBe("done");
    w = setCardio(w, 7, { durationSec: 300 });
    expect(exerciseStatus(w.exercises[7])).toBe("partial");
  });
  it("skip, notes, current", () => {
    let w = toggleSet(make(), 0, 0, NOW);
    w = skipExercise(w, 0);
    expect(exerciseStatus(w.exercises[0])).toBe("skipped");
    w = setNotes(w, 1, "felt good");
    expect(w.exercises[1].notes).toBe("felt good");
    expect(setCurrent(w, 3).currentIndex).toBe(3);
  });
  it("finish stamps time, notes and status", () => {
    let w = toggleSet(make(), 0, 0, NOW);
    w = finish(w, new Date("2026-11-07T17:52:00"), "Slept badly.");
    expect(w.finishedAt).toBe(new Date("2026-11-07T17:52:00").toISOString());
    expect(w.notes).toBe("Slept badly.");
    expect(w.timer).toBeUndefined();
    expect(w.exercises.map((e) => e.status)).toEqual([
      "partial", "skipped", "skipped", "skipped", "skipped", "skipped", "skipped", "skipped",
    ]);
  });
});

import { setHoldsDone } from "../../src/workout/session";
describe("setHoldsDone", () => {
  it("marks the first n holds done", () => {
    const w = setHoldsDone(make(), 4, 2);
    expect(w.exercises[4].holds!.map((h) => h.done)).toEqual([true, true, false]);
    expect(exerciseStatus(w.exercises[4])).toBe("partial");
  });
});
