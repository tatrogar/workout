import { describe, expect, it } from "vitest";
import { parsePlan } from "../src/plan/parse";
import { parseExport } from "../src/export/importFile";
import { toMarkdown } from "../src/export/markdown";
import { exerciseSeries } from "../src/trends/series";
import { circuitPhases, intervalPhases, newTimer, restPhases, start, stopwatchPhases } from "../src/timer/engine";
import { createWorkout, finish, runningElsewhere, setRoundsAtLeast, setRoundsDone, setTimer, toggleSet } from "../src/workout/session";
import { SPEC_EXAMPLE } from "./plan/example";
import { legDay } from "./fixtures/workouts";

const T0 = 1_700_000_000_000;
function workout(text = SPEC_EXAMPLE) {
  const r = parsePlan(text, "lb");
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return createWorkout(r.plan, text, new Date(T0), "w");
}

describe("minor: warn before replacing a running timer elsewhere", () => {
  it("names the exercise whose timer is running", () => {
    const w = setTimer(workout(), { exerciseIndex: 3, state: start(newTimer(intervalPhases(8, 20, 10)), T0) });
    expect(runningElsewhere(w, 5, T0 + 5000)).toBe("Tabata");
    expect(runningElsewhere(w, 3, T0 + 5000)).toBeNull();
  });
  it("ignores rest timers, stopwatches, finished and unstarted timers", () => {
    const at = (state: ReturnType<typeof newTimer>) => setTimer(workout(), { exerciseIndex: 3, state });
    expect(runningElsewhere(at(start(newTimer(restPhases(60)), T0)), 5, T0)).toBeNull();
    expect(runningElsewhere(at(start(newTimer(stopwatchPhases()), T0)), 5, T0)).toBeNull();
    expect(runningElsewhere(at(start(newTimer(intervalPhases(1, 5, 0)), T0)), 5, T0 + 60_000)).toBeNull();
    expect(runningElsewhere(at(newTimer(circuitPhases(1, [{ name: "a", sec: 5 }]))), 5, T0)).toBeNull();
  });
});

describe("minor: timer never lowers a hand-entered count", () => {
  it("setRoundsAtLeast only raises", () => {
    let w = setRoundsDone(workout(), 5, 3);
    w = setRoundsAtLeast(w, 5, 1);
    expect(w.exercises[5].roundsDone).toBe(3);
    w = setRoundsAtLeast(w, 5, 4);
    expect(w.exercises[5].roundsDone).toBe(4);
  });
});

describe("minor: parser accepts what Claude actually sends", () => {
  it("ignores chat text around a fenced plan", () => {
    const r = parsePlan("Here's your plan:\n\n```\n## Squat\nstrength: 3x5 @ 185 lb\n```\n\nHave fun!", "lb");
    expect(r.ok).toBe(true);
  });
  it("accepts ~~~ fences", () => {
    expect(parsePlan("~~~\n## Squat\nstrength: 3x5\n~~~", "lb").ok).toBe(true);
  });
  it("accepts miles and kilometers spelled out", () => {
    const r = parsePlan("## Run\ncardio: 20 min, 2 miles\n## Row\ncardio: 10 min, 2.5 kilometers", "lb");
    expect(r.ok && r.plan.exercises.map((e) => e.kind === "cardio" && [e.distance, e.distanceUnit])).toEqual([[2, "mi"], [2.5, "km"]]);
  });
  it("still reports errors with original line numbers inside a fence", () => {
    const r = parsePlan("Plan:\n```\n## Squat\nstrength: 3 by 5\n```", "lb");
    expect(!r.ok && r.errors[0].line).toBe(4);
  });
});

describe("minor: import drops malformed workouts", () => {
  it("keeps good workouts and drops broken ones", () => {
    const good = legDay();
    const md = toMarkdown([good], {}, "lb", new Date());
    const data = JSON.parse(md.match(/```json\n([\s\S]*?)\n```/)![1]);
    data.workouts.push({ id: "bad1", startedAt: "2026-11-01T00:00:00Z", exercises: [{ status: "done" }] });
    data.workouts.push({ id: "bad2", startedAt: "2026-11-01T00:00:00Z", exercises: [{ planned: { kind: "dance", name: "x" }, status: "done" }] });
    data.workouts.push({ id: "bad3", startedAt: "2026-11-01T00:00:00Z", units: "lb", exercises: [{ planned: { kind: "strength", name: "Squat" }, status: "done" }] });
    const r = parseExport("```json\n" + JSON.stringify(data) + "\n```");
    expect(r.ok && r.workouts.map((w) => w.id)).toEqual([good.id]);
    expect(r.ok && r.skipped).toBe(3);
  });
});

describe("minor: an exercise listed twice in a workout counts both", () => {
  it("combines strength sets from both entries", () => {
    const text = "## Squat\nstrength: 2x5 @ 185\n## Lunge\nother: 5 min\n## Squat\nstrength: 1x3 @ 205";
    let w = workout(text);
    w = toggleSet(toggleSet(toggleSet(w, 0, 0, new Date(T0)), 0, 1, new Date(T0)), 2, 0, new Date(T0));
    w = finish(w, new Date(T0 + 3_600_000));
    const s = exerciseSeries([w], "squat", {}, "lb");
    expect(s.points).toHaveLength(1);
    expect(s.points[0].values).toEqual({ topWeight: 205, volume: 185 * 10 + 205 * 3 });
  });
});
