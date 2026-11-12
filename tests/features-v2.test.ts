import { describe, expect, it } from "vitest";
import { looksLikePlan, parsePlan, planToText } from "../src/plan/parse";
import { CLAUDE_INSTRUCTIONS } from "../src/plan/instructions";
import { circuitPhases, countdownPhases, crossedCues, intervalPhases, newTimer, start, view, withReady } from "../src/timer/engine";
import {
  createWorkout, exerciseStatus, finish, runningElsewhere, setCardio, setEffort, setTimer, settleTimer, startSession, tickCountdown, toggleSet,
} from "../src/workout/session";
import { describeLog } from "../src/export/describe";
import { recentWorkouts, toMarkdown } from "../src/export/markdown";
import { lastTime, personalBests } from "../src/trends/history";
import { plates } from "../src/workout/plates";
import type { Workout } from "../src/workout/types";
import { legDay, olderBench } from "./fixtures/workouts";

const S = 1000;
const T0 = new Date("2026-11-10T12:00:00").getTime();
function plan(text: string) {
  const r = parsePlan(text, "lb");
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.plan;
}
function workout(text: string, id = "w", at = T0): Workout {
  return createWorkout(plan(text), text, new Date(at), id);
}
const WARM = "## Warm-up\nother: 5 min\n## Easy run\ncardio: 20 min\n## Tabata\nintervals: 8 x 20s work / 10s rest";

describe("1. session start gate", () => {
  it("a new workout waits for Start session", () => {
    expect(workout(WARM).pending).toBe(true);
  });
  it("startSession stamps the start time and unlocks", () => {
    const w = startSession(workout(WARM), new Date(T0 + 90 * S));
    expect(w.pending).toBeUndefined();
    expect(w.startedAt).toBe(new Date(T0 + 90 * S).toISOString());
  });
  it("finish never leaves a workout pending", () => {
    expect(finish(workout(WARM), new Date(T0 + 60 * S)).pending).toBeUndefined();
  });
});

describe("2. countdowns for other and cardio", () => {
  const begin = (idx: number, sec: number) => setTimer(startSession(workout(WARM), new Date(T0)), { exerciseIndex: idx, state: start(newTimer(countdownPhases(sec)), T0) });
  it("counts down and cues END at zero", () => {
    const t = start(newTimer(countdownPhases(300)), T0);
    expect(view(t, T0 + 100 * S)).toMatchObject({ remainingSec: 200, done: false });
    expect(crossedCues(t, T0 + 299.9 * S, T0 + 300.1 * S)).toEqual(["END"]);
  });
  it("'other' at zero is marked done with its planned time and the timer clears", () => {
    const w = tickCountdown(begin(0, 300), T0 + 301 * S);
    expect(w.exercises[0].durationSec).toBe(300);
    expect(exerciseStatus(w.exercises[0])).toBe("done");
    expect(w.timer).toBeUndefined();
  });
  it("before zero nothing changes (same object)", () => {
    const w = begin(0, 300);
    expect(tickCountdown(w, T0 + 100 * S)).toBe(w);
  });
  it("cardio at zero is marked done but keeps counting", () => {
    const w = tickCountdown(begin(1, 1200), T0 + 1201 * S);
    expect(w.exercises[1].durationSec).toBe(1200);
    expect(w.timer).toBeDefined();
    expect(tickCountdown(w, T0 + 1300 * S)).toBe(w);
  });
  it("leaving or finishing past zero logs the real time", () => {
    const w = tickCountdown(begin(1, 1200), T0 + 1201 * S);
    expect(settleTimer(w, T0 + 1500 * S).exercises[1].durationSec).toBe(1500);
    expect(finish(w, new Date(T0 + 1500 * S)).exercises[1].durationSec).toBe(1500);
  });
  it("leaving mid-countdown saves the time spent", () => {
    const s = settleTimer(begin(0, 300), T0 + 120 * S);
    expect(s.exercises[0].durationSec).toBe(120);
    expect(s.timer).toBeUndefined();
  });
  it("a running countdown never blocks another timer", () => {
    expect(runningElsewhere(begin(1, 1200), 2, T0 + 5 * S)).toBeNull();
  });
});

describe("3. rest between circuit moves", () => {
  const text = "## Core\ncircuit: 3 rounds, rest 30s between moves, rest 60s between rounds\n- Plank 45s\n- Dead bug 10 reps";
  it("parses both rests", () => {
    expect(plan(text).exercises[0]).toMatchObject({ kind: "circuit", rounds: 3, restSec: 60, moveRestSec: 30 });
  });
  it("plain 'rest 60s' still means between rounds", () => {
    const ex = plan("## Core\ncircuit: 2 rounds, rest 60s\n- Plank 45s").exercises[0];
    expect(ex).toMatchObject({ restSec: 60 });
    expect("moveRestSec" in ex).toBe(false);
  });
  it("order of the two rests doesn't matter", () => {
    expect(plan("## Core\ncircuit: 2 rounds, rest 60s between rounds, rest 20s between moves\n- A 10s\n- B 10s").exercises[0]).toMatchObject({ restSec: 60, moveRestSec: 20 });
  });
  it("rest between moves is rejected outside circuits", () => {
    expect(parsePlan("## Squat\nstrength: 3x5, rest 30s between moves", "lb").ok).toBe(false);
  });
  it("phases rest between moves but not after the last one in a round", () => {
    const p = circuitPhases(2, [{ name: "a", sec: 10 }, { name: "b", sec: 10 }], 60, 30);
    expect(p.map((x) => `${x.label}${x.sec}`)).toEqual(["MOVE10", "REST30", "MOVE10", "REST60", "MOVE10", "REST30", "MOVE10"]);
  });
  it("round-trips", () => {
    expect(plan(planToText(plan(text)))).toEqual(plan(text));
  });
});

describe("4. each side", () => {
  const text = "## Core\ncircuit: 1 round\n- Side plank 20s/side\n- Reverse lunges 8 reps/side\n- Leg swings 10 reps each side\n- Plank 30s";
  it("parses /side and 'each side'", () => {
    expect(plan(text).exercises[0]).toMatchObject({ moves: [
      { name: "Side plank", sec: 20, perSide: true }, { name: "Reverse lunges", reps: 8, perSide: true },
      { name: "Leg swings", reps: 10, perSide: true }, { name: "Plank", sec: 30 },
    ] });
  });
  it("a timed per-side move runs both sides (replaced 'wait for Done' at the owner's request)", () => {
    const p = circuitPhases(1, [{ name: "Side plank", sec: 20, perSide: true }, { name: "Plank", sec: 30 }]);
    expect(p.map((x) => `${x.label}${x.sec}`)).toEqual(["MOVE20", "SWITCH5", "MOVE20", "MOVE30"]);
  });
  it("round-trips and shows in the export", () => {
    expect(plan(planToText(plan(text)))).toEqual(plan(text));
    const w = finish({ ...workout(text), exercises: workout(text).exercises.map((e) => ({ ...e, roundsDone: 1 })) }, new Date(T0 + S));
    expect(describeLog(w.exercises[0]).join("\n")).toContain("Side plank 20s/side, Reverse lunges 8 reps/side");
  });
});

describe("5. spotting text that isn't a plan", () => {
  it("prose is not a plan", () => {
    expect(looksLikePlan("Week 1 · Run + Bodyweight B\n\nWarm-up: bike 3 min, squats x10\nJog 1 min / walk 2 min x8")).toBe(false);
  });
  it("a plan with a typo still looks like a plan", () => {
    expect(looksLikePlan("## Squat\nstrength: 3 by 5")).toBe(true);
    expect(looksLikePlan("```\n## Run\ncardio: 20 min\n```")).toBe(true);
  });
});

describe("6. instructions", () => {
  it("cover code blocks, artifacts and the new syntax", () => {
    expect(CLAUDE_INSTRUCTIONS).toContain("never in an artifact");
    expect(CLAUDE_INSTRUCTIONS).toContain("between moves");
    expect(CLAUDE_INSTRUCTIONS).toContain("/side");
  });
});

describe("7. effort", () => {
  it("is stored per exercise, clamped 1–10, and can be cleared", () => {
    let w = setEffort(workout(WARM), 0, 7);
    expect(w.exercises[0].effort).toBe(7);
    expect(setEffort(w, 0, 14).exercises[0].effort).toBe(10);
    w = setEffort(w, 0, undefined);
    expect(w.exercises[0].effort).toBeUndefined();
  });
  it("is written to the export", () => {
    let w = setCardio(startSession(workout(WARM), new Date(T0)), 0, { durationSec: 300 });
    w = finish(setEffort(w, 0, 7), new Date(T0 + 600 * S));
    expect(describeLog(w.exercises[0])).toContain("  - effort: 7/10");
    expect(toMarkdown([w], {}, "lb", new Date(T0 + 700 * S))).toContain('"effort":7');
  });
});

describe("8. last time", () => {
  it("finds the most recent finished, non-skipped session", () => {
    expect(lastTime([legDay(), olderBench()], "Squat", {})).toEqual({ date: "2026-11-07", text: "185x5 ✓, 185x5 ✓, 185x4 ✓" });
    expect(lastTime([legDay()], " squat ", {})?.date).toBe("2026-11-07");
  });
  it("is null for a new or only-skipped exercise", () => {
    expect(lastTime([legDay()], "Deadlift", {})).toBeNull();
    expect(lastTime([legDay()], "Hip mobility", {})).toBeNull();
  });
});

describe("9. export only recent workouts", () => {
  it("keeps workouts from the last N days", () => {
    const now = new Date("2026-12-02T12:00:00");
    expect(recentWorkouts([legDay(), olderBench()], now, 28).map((w) => w.id)).toEqual(["leg-1107"]);
    expect(recentWorkouts([legDay(), olderBench()], now, 60)).toHaveLength(2);
  });
});

describe("10. personal bests", () => {
  const squat = (id: string, day: string, weight: number) => {
    const text = `## Squat\nstrength: 1x5 @ ${weight} lb`;
    const t = new Date(`${day}T12:00:00`);
    return finish(toggleSet(startSession(createWorkout(plan(text), text, t, id), t), 0, 0, t), new Date(t.getTime() + 600 * S));
  };
  it("calls out a heavier set than ever before", () => {
    expect(personalBests([squat("a", "2026-11-01", 185)], squat("b", "2026-11-05", 190), {}, "lb")).toEqual(["Squat: 190 lb, up from 185"]);
  });
  it("says nothing for a first time or a tie", () => {
    expect(personalBests([], squat("b", "2026-11-05", 190), {}, "lb")).toEqual([]);
    expect(personalBests([squat("a", "2026-11-01", 190)], squat("b", "2026-11-05", 190), {}, "lb")).toEqual([]);
  });
  it("covers cardio distance", () => {
    const run = (id: string, day: string, mi: number) => {
      const t = new Date(`${day}T12:00:00`);
      return finish(setCardio(startSession(createWorkout(plan("## Run\ncardio: 20 min"), "", t, id), t), 0, { durationSec: 1200, distance: mi }), new Date(t.getTime() + 1300 * S));
    };
    expect(personalBests([run("a", "2026-11-01", 2)], run("b", "2026-11-05", 2.4), {}, "lb")).toEqual(["Run: 2.4 mi, up from 2"]);
  });
});

describe("11. plate math", () => {
  it("lists plates per side for a 45 lb bar", () => {
    expect(plates(185, "lb")).toEqual([45, 25]);
    expect(plates(45, "lb")).toEqual([]);
    expect(plates(137.5, "lb")).toEqual([45, 1.25]);
  });
  it("kilograms use a 20 kg bar", () => {
    expect(plates(100, "kg")).toEqual([25, 15]);
  });
  it("is null below the bar or when it can't be loaded evenly", () => {
    expect(plates(30, "lb")).toBeNull();
    expect(plates(186, "lb")).toBeNull();
  });
});

describe("12. get-ready countdown", () => {
  it("adds 5 seconds before the first phase and then cues WORK", () => {
    const t = start(newTimer(withReady(intervalPhases(2, 20, 10))), T0);
    expect(view(t, T0 + 2 * S)).toMatchObject({ index: 0, remainingSec: 3 });
    expect(view(t, T0 + 2 * S).phase?.label).toBe("READY");
    expect(crossedCues(t, T0 + 4.9 * S, T0 + 5.1 * S)).toEqual(["WORK"]);
    expect(crossedCues(t, T0 + 2.9 * S, T0 + 3.1 * S)).toEqual(["WARN"]);
  });
});
