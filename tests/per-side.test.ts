import { describe, expect, it } from "vitest";
import { parsePlan, planToText } from "../src/plan/parse";
import { circuitPhases, holdPhases, newTimer, skip, sideResults, start, view, crossedCues, completedPhases } from "../src/timer/engine";
import { cuePhrase } from "../src/timer/phrases";
import {
  createWorkout, editSide, exerciseStatus, finish, recordSides, startSession, toggleSide,
} from "../src/workout/session";
import { describeLog } from "../src/export/describe";
import { exerciseSeries } from "../src/trends/series";
import { DEFAULT_SETTINGS } from "../src/store/settings";
import { SPEC_EXAMPLE } from "./plan/example";

const S = 1000;
const T0 = new Date("2026-11-13T12:00:00").getTime();
const SIDES = { first: "L" as const, switchSec: 5 };
function plan(text: string) {
  const r = parsePlan(text, "lb");
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.plan;
}
const workout = (text: string) => startSession(createWorkout(plan(text), text, new Date(T0), "w"), new Date(T0));

describe("parsing /side", () => {
  it("strength, sets and hold lines", () => {
    expect(plan("## Lunge\nstrength: 3x10/side @ 25 lb").exercises[0]).toMatchObject({ kind: "strength", perSide: true, sets: [{ weight: 25, reps: 10 }, { weight: 25, reps: 10 }, { weight: 25, reps: 10 }] });
    expect(plan("## Lunge\nsets: 25x10/side, 30x8/side").exercises[0]).toMatchObject({ perSide: true, sets: [{ weight: 25, reps: 10 }, { weight: 30, reps: 8 }] });
    expect(plan("## Side plank\nhold: 3 x 20s/side, rest 30s").exercises[0]).toMatchObject({ kind: "hold", perSide: true, sets: 3, holdSec: 20, restSec: 30 });
    expect(plan("## Lunge\nstrength: 3x10 each side").exercises[0]).toMatchObject({ perSide: true, sets: [{ reps: 10 }, { reps: 10 }, { reps: 10 }] });
  });
  it("/side is not part of the name", () => {
    expect(plan("## Core\ncircuit: 1 round\n- Side plank 20s/side").exercises[0]).toMatchObject({ moves: [{ name: "Side plank", sec: 20, perSide: true }] });
  });
  it("mixing per-side and normal sets is an error", () => {
    expect(parsePlan("## Lunge\nsets: 25x10/side, 30x8", "lb").ok).toBe(false);
  });
  it("plans without /side parse exactly as before", () => {
    const p = plan(SPEC_EXAMPLE);
    expect(JSON.stringify(p)).not.toContain("perSide");
  });
  it("round-trips", () => {
    const t = "## Lunge\nstrength: 3x10/side @ 25 lb\n## Step-up\nsets: 25x10/side, 30x8/side\n## Side plank\nhold: 3 x 20s/side, rest 30s\n## Core\ncircuit: 2 rounds\n- Side plank 20s/side\n- Lunges 6 reps/side";
    expect(plan(planToText(plan(t)))).toEqual(plan(t));
  });
});

describe("timed per-side phases", () => {
  it("a per-side circuit move runs Left, Switch, Right, then moves on", () => {
    const p = circuitPhases(1, [{ name: "Side plank", sec: 20, perSide: true }, { name: "Plank", sec: 30 }], undefined, undefined, SIDES);
    expect(p.map((x) => `${x.label}${x.side ?? ""}${x.sec}`)).toEqual(["MOVEL20", "SWITCH5", "MOVER20", "MOVE30"]);
  });
  it("runs hands-free: no taps from Left to Right", () => {
    const t = start(newTimer(circuitPhases(1, [{ name: "Side plank", sec: 20, perSide: true }], undefined, undefined, SIDES)), T0);
    expect(view(t, T0 + 10 * S).phase).toMatchObject({ label: "MOVE", side: "L" });
    expect(view(t, T0 + 22 * S).phase).toMatchObject({ label: "SWITCH" });
    expect(view(t, T0 + 30 * S).phase).toMatchObject({ label: "MOVE", side: "R" });
    expect(view(t, T0 + 46 * S).done).toBe(true);
  });
  it("first side and switch time come from settings; switch 0 means no prep", () => {
    const p = circuitPhases(1, [{ name: "Side plank", sec: 20, perSide: true }], undefined, undefined, { first: "R", switchSec: 0 });
    expect(p.map((x) => `${x.label}${x.side ?? ""}`)).toEqual(["MOVER", "MOVEL"]);
  });
  it("cues: switch at the end of side 1, then the second side is named", () => {
    const t = start(newTimer(circuitPhases(1, [{ name: "Side plank", sec: 20, perSide: true }], undefined, undefined, SIDES)), T0);
    expect(crossedCues(t, T0 + 19.9 * S, T0 + 20.1 * S)).toEqual(["REST"]);
    expect(cuePhrase("REST", view(t, T0 + 20.1 * S).phase, undefined, false)).toBe("Switch sides");
    expect(crossedCues(t, T0 + 24.9 * S, T0 + 25.1 * S)).toEqual(["WORK"]);
    expect(cuePhrase("WORK", view(t, T0 + 25.1 * S).phase, undefined, false)).toBe("Right");
  });
  it("a per-side last move counts a circuit round once", () => {
    const t = start(newTimer(circuitPhases(2, [{ name: "Plank", sec: 10 }, { name: "Side plank", sec: 10, perSide: true }], undefined, undefined, SIDES)), T0);
    // round 1: Plank 10 + Left 10 + Switch 5 + Right 10 = 35s
    expect(completedPhases(t, T0 + 34 * S, "MOVE", (p) => p.moveIndex === 1 && p.part !== 1)).toBe(0);
    expect(completedPhases(t, T0 + 36 * S, "MOVE", (p) => p.moveIndex === 1 && p.part !== 1)).toBe(1);
  });
  it("per-side holds: each set is Left, Switch, Right, then rest", () => {
    const p = holdPhases(2, 20, 30, true, SIDES);
    expect(p.map((x) => `${x.label}${x.side ?? ""}${x.round}`)).toEqual(["HOLDL1", "SWITCH1", "HOLDR1", "REST1", "HOLDL2", "SWITCH2", "HOLDR2"]);
  });
  it("side results record the time actually held, including a side skipped early", () => {
    let t = start(newTimer(holdPhases(1, 20, undefined, true, SIDES)), T0);
    t = skip(t, T0 + 40 * S); // in R after 15s
    expect(sideResults(t, T0 + 40 * S)).toEqual([{ round: 1, side: "L", value: 20 }, { round: 1, side: "R", value: 15 }]);
  });
  it("skipping the switch prep starts side 2 early", () => {
    let t = start(newTimer(holdPhases(1, 20, undefined, true, SIDES)), T0);
    t = skip(t, T0 + 21 * S);
    expect(view(t, T0 + 21 * S).phase).toMatchObject({ label: "HOLD", side: "R" });
    expect(view(t, T0 + 21 * S).remainingSec).toBe(20);
  });
});

describe("logging each side", () => {
  it("holds store both sides; a set is done when both sides were held", () => {
    let w = workout("## Side plank\nhold: 2 x 20s/side");
    w = recordSides(w, 0, [{ round: 1, side: "L", value: 20 }, { round: 1, side: "R", value: 15 }]);
    expect(w.exercises[0].holds![0]).toMatchObject({ done: true, sides: { left: 20, right: 15 } });
    expect(exerciseStatus(w.exercises[0])).toBe("partial");
  });
  it("circuits log per-side moves per round", () => {
    let w = workout("## Core\ncircuit: 2 rounds\n- Side plank 20s/side\n- Lunges 6 reps/side");
    w = recordSides(w, 0, [{ round: 1, moveIndex: 0, side: "L", value: 20 }, { round: 1, moveIndex: 0, side: "R", value: 15 }]);
    w = recordSides(w, 0, [{ round: 1, moveIndex: 1, side: "L", value: 6 }, { round: 1, moveIndex: 1, side: "R", value: 5 }]);
    expect(w.exercises[0].sideLog).toEqual([
      { round: 1, moveIndex: 0, left: 20, right: 15 },
      { round: 1, moveIndex: 1, left: 6, right: 5 },
    ]);
  });
  it("strength: separate Left/Right checks and reps; the set is done when both sides are", () => {
    let w = workout("## Lunge\nstrength: 2x10/side @ 25 lb");
    expect(w.exercises[0].sets![0].sides).toEqual({ left: { reps: 10, done: false }, right: { reps: 10, done: false } });
    w = toggleSide(w, 0, 0, "left", new Date(T0));
    expect(w.exercises[0].sets![0].done).toBe(false);
    w = editSide(w, 0, 0, "right", 8);
    w = toggleSide(w, 0, 0, "right", new Date(T0));
    expect(w.exercises[0].sets![0]).toMatchObject({ done: true, sides: { left: { reps: 10, done: true }, right: { reps: 8, done: true } } });
    expect(exerciseStatus(w.exercises[0])).toBe("partial");
  });
  it("volume counts both sides", () => {
    let w = workout("## Lunge\nstrength: 1x10/side @ 25 lb");
    w = toggleSide(toggleSide(editSide(w, 0, 0, "right", 8), 0, 0, "left", new Date(T0)), 0, 0, "right", new Date(T0));
    w = finish(w, new Date(T0 + 600 * S));
    expect(exerciseSeries([w], "lunge", {}, "lb").points[0].values).toEqual({ topWeight: 25, volume: 25 * 18 });
  });
});

describe("export", () => {
  it("strength keeps /side and shows both sides", () => {
    let w = workout("## Lunge\nstrength: 2x10/side @ 25 lb");
    w = toggleSide(toggleSide(w, 0, 0, "left", new Date(T0)), 0, 0, "right", new Date(T0));
    w = toggleSide(editSide(w, 0, 1, "right", 8), 0, 1, "left", new Date(T0));
    const lines = describeLog(finish(w, new Date(T0 + S)).exercises[0]);
    expect(lines[0]).toBe("- Lunge — planned 2x10/side @ 25");
    expect(lines[1]).toBe("  - done: 25x L10 R10 ✓, 25x L10 R– ✗");
  });
  it("holds show both sides per set", () => {
    let w = workout("## Side plank\nhold: 2 x 20s/side, rest 30s");
    w = recordSides(w, 0, [{ round: 1, side: "L", value: 20 }, { round: 1, side: "R", value: 20 }, { round: 2, side: "L", value: 20 }, { round: 2, side: "R", value: 15 }]);
    expect(describeLog(finish(w, new Date(T0 + S)).exercises[0])[0]).toBe("- Side plank — planned 2 x 20s/side, rest 30s — done L 20s R 20s, L 20s R 15s");
  });
  it("circuits get a line per round for per-side moves", () => {
    let w = workout("## Core\ncircuit: 1 round\n- Side plank 20s/side\n- Lunges 6 reps/side");
    w = recordSides(w, 0, [
      { round: 1, moveIndex: 0, side: "L", value: 20 }, { round: 1, moveIndex: 0, side: "R", value: 15 },
      { round: 1, moveIndex: 1, side: "L", value: 6 }, { round: 1, moveIndex: 1, side: "R", value: 5 },
    ]);
    w = { ...w, exercises: w.exercises.map((e) => ({ ...e, roundsDone: 1 })) };
    const text = describeLog(finish(w, new Date(T0 + S)).exercises[0]).join("\n");
    expect(text).toContain("  - moves: Side plank 20s/side, Lunges 6 reps/side");
    expect(text).toContain("  - Side plank round 1: L 20s, R 15s");
    expect(text).toContain("  - Lunges round 1: L 6, R 5");
  });
});

describe("settings", () => {
  it("has switch-sides prep and first side", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ switchOn: true, switchSec: 5, firstSide: "L" });
  });
});

import { addSet } from "../src/workout/session";
describe("adding a set to a per-side exercise", () => {
  it("the new set has its own Left and Right", () => {
    const w = addSet(workout("## Lunge\nstrength: 1x10/side @ 25 lb"), 0);
    expect(w.exercises[0].sets![1]).toEqual({ weight: 25, reps: 10, done: false, sides: { left: { reps: 10, done: false }, right: { reps: 10, done: false } } });
  });
});
