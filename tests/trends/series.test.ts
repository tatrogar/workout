import { describe, expect, it } from "vitest";
import { exerciseNames, exerciseSeries, normalizeName, weeklySeries } from "../../src/trends/series";
import { parsePlan } from "../../src/plan/parse";
import { createWorkout, finish, setCardio, toggleSet } from "../../src/workout/session";
import type { Workout } from "../../src/workout/types";
import { legDay } from "../fixtures/workouts";

function lift(id: string, day: string, text: string, units: "lb" | "kg" = "lb"): Workout {
  const r = parsePlan(text, units);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  const t = new Date(`${day}T12:00:00`);
  let w = createWorkout(r.plan, text, t, id);
  w.exercises[0].sets?.forEach((_, i) => { w = toggleSet(w, 0, i, t); });
  return finish(w, new Date(`${day}T12:40:00`));
}

describe("normalizeName", () => {
  it("lowercases, trims, collapses, follows aliases", () => {
    expect(normalizeName(" Back  Squat ", { "back squat": "squat" })).toBe("squat");
  });
  it("survives alias cycles", () => {
    expect(["a", "b"]).toContain(normalizeName("a", { a: "b", b: "a" }));
  });
});

describe("exerciseNames", () => {
  it("joins names differing by case and spaces", () => {
    const ws = [lift("2", "2026-11-05", "## Squat\nstrength: 3x5 @ 185"), lift("1", "2026-11-01", "##  squat \nstrength: 3x5 @ 175")];
    const names = exerciseNames(ws, {});
    expect(names).toEqual([{ key: "squat", display: "Squat", kind: "strength", sessions: 2 }]);
  });
  it("applies merges", () => {
    const ws = [lift("2", "2026-11-05", "## Back squat\nstrength: 3x5 @ 185"), lift("1", "2026-11-01", "## Squat\nstrength: 3x5 @ 175")];
    expect(exerciseNames(ws, { "back squat": "squat" })).toHaveLength(1);
  });
});

describe("exerciseSeries", () => {
  it("strength top weight and volume", () => {
    const s = exerciseSeries([legDay()], "squat", {}, "lb");
    expect(s.kind).toBe("strength");
    expect(s.points).toEqual([{ date: "2026-11-07", workoutId: "leg-1107", values: { topWeight: 185, volume: 2590 } }]);
  });
  it("converts kg history to lb", () => {
    const s = exerciseSeries([lift("k", "2026-11-02", "## Squat\nstrength: 1x5 @ 100 kg")], "squat", {}, "lb");
    expect(s.points[0].values.topWeight).toBe(220.5);
  });
  it("cardio pace", () => {
    const s = exerciseSeries([legDay()], "easy run", {}, "lb");
    expect(s.points[0].values.minutes).toBe(22);
    expect(s.points[0].values.distance).toBe(2.1);
    expect(s.points[0].values.paceMinPer).toBeCloseTo(10.476, 2);
  });
  it("rounds done vs planned", () => {
    const s = exerciseSeries([legDay()], "tabata", {}, "lb");
    expect(s.points[0].values).toEqual({ done: 8, planned: 8 });
  });
  it("leaves out skipped sessions", () => {
    expect(exerciseSeries([legDay()], "hip mobility", {}, "lb").points).toEqual([]);
  });
  it("oldest first", () => {
    const ws = [lift("2", "2026-11-05", "## Squat\nstrength: 3x5 @ 185"), lift("1", "2026-11-01", "## Squat\nstrength: 3x5 @ 175")];
    expect(exerciseSeries(ws, "squat", {}, "lb").points.map((p) => p.date)).toEqual(["2026-11-01", "2026-11-05"]);
  });
  it("no pace without distance", () => {
    const r = parsePlan("## Bike\ncardio: 30 min", "lb");
    if (!r.ok) throw new Error();
    let w = createWorkout(r.plan, "", new Date("2026-11-04T12:00:00"), "b");
    w = finish(setCardio(w, 0, { durationSec: 1800 }), new Date("2026-11-04T12:30:00"));
    expect(exerciseSeries([w], "bike", {}, "lb").points[0].values).toEqual({ minutes: 30 });
  });
});

describe("weeklySeries", () => {
  it("buckets by Monday weeks with empty weeks as zero", () => {
    const ws = [lift("a", "2026-11-08", "## Squat\nstrength: 1x5"), lift("b", "2026-11-09", "## Squat\nstrength: 1x5")];
    const s = weeklySeries(ws, new Date("2026-11-09T18:00:00"));
    expect(s).toHaveLength(12);
    expect(s[11]).toEqual({ weekStart: "2026-11-09", workouts: 1, minutes: 40 });
    expect(s[10]).toEqual({ weekStart: "2026-11-02", workouts: 1, minutes: 40 });
    expect(s[0]).toEqual({ weekStart: "2026-08-24", workouts: 0, minutes: 0 });
  });
});

import { primaryValue } from "../../src/trends/series";
describe("primaryValue", () => {
  it("picks the headline number per kind", () => {
    expect(primaryValue({ topWeight: 185, volume: 2590 })).toBe(185);
    expect(primaryValue({ reps: 24 })).toBe(24);
    expect(primaryValue({ done: 6, planned: 8 })).toBe(6);
    expect(primaryValue({ minutes: 22, distance: 2.1, paceMinPer: 10.5 })).toBe(2.1);
    expect(primaryValue({ minutes: 30 })).toBe(30);
  });
});
