import { describe, expect, it } from "vitest";
import { parsePlan, splitPlans } from "../src/plan/parse";
import { intervalPhases, newTimer, restPhases, start } from "../src/timer/engine";
import { cuePhrase } from "../src/timer/phrases";
import { fireCue, type CueDeps } from "../src/timer/cues";
import {
  createWorkout, effectiveRest, finish, insertExercises, moveExercise, removeExercise, reopen, replaceExercise,
  setCurrent, setTimer, startSession, toggleSet,
} from "../src/workout/session";
import { copyForClaude } from "../src/export/markdown";
import { createDataStore, type KV } from "../src/store/data";
import { DEFAULT_SETTINGS } from "../src/store/settings";
import { parseHash } from "../src/router";
import { legDay } from "./fixtures/workouts";

const S = 1000;
const T0 = new Date("2026-11-12T12:00:00").getTime();
const PLAN = "# Day\n## Squat\nstrength: 3x5 @ 185 lb\n## Tabata\nintervals: 8 x 20s work / 10s rest\n## Run\ncardio: 20 min";
function plan(text: string) {
  const r = parsePlan(text, "lb");
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.plan;
}
const started = () => startSession(createWorkout(plan(PLAN), PLAN, new Date(T0), "w"), new Date(T0));
const names = (w: { exercises: { planned: { name: string } }[] }) => w.exercises.map((e) => e.planned.name);
function memory(): KV {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

describe("1. changing the plan mid-workout", () => {
  const extra = plan("## Leg press\nstrength: 3x10 @ 200 lb\n## Plank\nhold: 2 x 30s").exercises;
  it("inserts new exercises with fresh logs", () => {
    const w = insertExercises(started(), 1, extra, T0);
    expect(names(w)).toEqual(["Squat", "Leg press", "Plank", "Tabata", "Run"]);
    expect(w.exercises[1].sets).toHaveLength(3);
    expect(w.exercises[2].holds).toHaveLength(2);
  });
  it("removes an exercise but never the last one", () => {
    const w = removeExercise(started(), 1, T0);
    expect(names(w)).toEqual(["Squat", "Run"]);
    const one = removeExercise(removeExercise(w, 0, T0), 0, T0);
    expect(names(one)).toEqual(["Run"]);
  });
  it("moves an exercise and keeps you on the one you were viewing", () => {
    const w = moveExercise(setCurrent(started(), 2), 2, -1, T0);
    expect(names(w)).toEqual(["Squat", "Run", "Tabata"]);
    expect(w.currentIndex).toBe(1);
    expect(names(moveExercise(started(), 0, -1, T0))).toEqual(["Squat", "Tabata", "Run"]);
  });
  it("replaces an exercise", () => {
    const w = replaceExercise(started(), 0, extra[0], T0);
    expect(names(w)).toEqual(["Leg press", "Tabata", "Run"]);
  });
  it("keeps logged work on the other exercises", () => {
    const w = removeExercise(toggleSet(started(), 0, 0, new Date(T0)), 1, T0);
    expect(w.exercises[0].sets![0].done).toBe(true);
  });
  it("saves a running cardio timer and drops any timer, since indexes shift", () => {
    const w = setTimer(started(), { exerciseIndex: 2, state: start(newTimer(intervalPhases(1, 1200, 0)), T0) });
    const after = moveExercise(w, 2, -1, T0 + 300 * S);
    expect(after.timer).toBeUndefined();
    expect(after.exercises[1].durationSec).toBe(300);
    const rest = setTimer(started(), { exerciseIndex: 0, state: start(newTimer(restPhases(90)), T0) });
    expect(removeExercise(rest, 1, T0).timer).toBeUndefined();
  });
  it("current index stays in range after removing the last one", () => {
    expect(removeExercise(setCurrent(started(), 2), 2, T0).currentIndex).toBe(1);
  });
});

describe("3. reopening a finished workout", () => {
  it("puts it back in progress with the clock where it stopped", () => {
    const done = finish(started(), new Date(T0 + 40 * 60 * S));
    const now = T0 + 3 * 3600 * S;
    const w = reopen(done, new Date(now));
    expect(w.finishedAt).toBeUndefined();
    expect(now - Date.parse(w.startedAt)).toBe(40 * 60 * S);
    expect(w.currentIndex).toBe(0);
  });
  it("the store moves it from history to active, unless something is already active", () => {
    const s = createDataStore(memory());
    s.getState().upsertWorkout(finish(started(), new Date(T0 + 600 * S)));
    expect(s.getState().reopenWorkout("w", new Date(T0 + 900 * S))).toBe(true);
    expect(s.getState().active?.id).toBe("w");
    expect(s.getState().workouts).toHaveLength(0);
    s.getState().upsertWorkout({ ...legDay() });
    expect(s.getState().reopenWorkout("leg-1107", new Date())).toBe(false);
  });
});

describe("4. default rest", () => {
  const strength = plan("## A\nstrength: 3x5\n## B\nstrength: 3x5, rest 120s").exercises;
  it("fills in when the plan has no rest", () => {
    expect(effectiveRest(strength[0], { defaultRestOn: true, defaultRestSec: 90 })).toBe(90);
    expect(effectiveRest(strength[1], { defaultRestOn: true, defaultRestSec: 90 })).toBe(120);
    expect(effectiveRest(strength[0], { defaultRestOn: false, defaultRestSec: 90 })).toBeUndefined();
  });
});

describe("5. copy one workout for Claude", () => {
  it("is just that workout, readable, with no JSON", () => {
    const t = copyForClaude(legDay());
    expect(t).toContain("## 2026-11-07 · Leg day · 52 min");
    expect(t).toContain("- Squat — planned 3x5 @ 185, rest 120s");
    expect(t).toContain("Notes: Slept badly.");
    expect(t).toContain("units: lb");
    expect(t).not.toContain("```json");
  });
});

describe("6. pasting a whole week", () => {
  const week = "Here's your week:\n\nMonday\n```\n# Mon\n## Squat\nstrength: 3x5\n```\n\nWednesday\n```text\n# Wed\n## Run\ncardio: 20 min\n```\n";
  it("splits fenced blocks into separate plans", () => {
    const parts = splitPlans(week);
    expect(parts).toHaveLength(2);
    expect(plan(parts[0]).title).toBe("Mon");
    expect(plan(parts[1]).title).toBe("Wed");
  });
  it("one block or no fence is one plan", () => {
    expect(splitPlans("## Squat\nstrength: 3x5")).toEqual(["## Squat\nstrength: 3x5"]);
    expect(splitPlans("```\n## Squat\nstrength: 3x5\n```")).toHaveLength(1);
  });
  it("the store keeps an Up next queue in order", () => {
    const s = createDataStore(memory());
    s.getState().addUpNext([{ id: "a", title: "Mon", planText: "x" }, { id: "b", title: "Wed", planText: "y" }]);
    s.getState().addUpNext([{ id: "c", title: "Fri", planText: "z" }]);
    expect(s.getState().upNext.map((u) => u.title)).toEqual(["Mon", "Wed", "Fri"]);
    s.getState().removeUpNext("a");
    expect(s.getState().upNext.map((u) => u.id)).toEqual(["b", "c"]);
  });
});

describe("8. spoken cues", () => {
  const circuit = plan("## Core\ncircuit: 2 rounds\n- Plank 45s\n- Lunges 8 reps/side").exercises[0];
  const tabata = plan(PLAN).exercises[1];
  it("says the phase", () => {
    expect(cuePhrase("REST", { label: "REST", sec: 10, round: 1 }, tabata, false)).toBe("Rest");
    expect(cuePhrase("WORK", { label: "WORK", sec: 20, round: 3 }, tabata, false)).toBe("Go");
    expect(cuePhrase("END", null, tabata, false)).toBe("Done");
    expect(cuePhrase("WARN", { label: "WORK", sec: 20, round: 3 }, tabata, true)).toBeNull();
  });
  it("with detail on, says rounds and move names", () => {
    expect(cuePhrase("WORK", { label: "WORK", sec: 20, round: 3 }, tabata, true)).toBe("Round 3");
    expect(cuePhrase("WORK", { label: "MOVE", sec: 45, round: 1, moveIndex: 0 }, circuit, true)).toBe("Plank, 45 seconds");
    expect(cuePhrase("WORK", { label: "MOVE", sec: 0, round: 1, moveIndex: 1 }, circuit, true)).toBe("Lunges, 8 reps each side");
    expect(cuePhrase("WORK", { label: "HOLD", sec: 45, round: 2 }, undefined, true)).toBe("Hold, set 2");
  });
  it("a rest timer ending says so", () => {
    expect(cuePhrase("END", null, plan(PLAN).exercises[0], false, true)).toBe("Rest over");
  });
  it("fireCue speaks only when voice is on", () => {
    const said: string[] = [];
    const deps: CueDeps = { beep() {}, vibrate() {}, flash() {}, speak: (t) => said.push(t) };
    fireCue("REST", { sound: false, vibration: false, flash: false, voice: true }, deps, "Rest");
    fireCue("REST", { sound: false, vibration: false, flash: false, voice: false }, deps, "Rest");
    fireCue("WARN", { sound: false, vibration: false, flash: false, voice: true }, deps, null);
    expect(said).toEqual(["Rest"]);
  });
});

describe("9. quick timer route", () => {
  it("exists", () => expect(parseHash("#/timer").path).toBe("/timer"));
});

describe("settings defaults", () => {
  it("has every switch and time", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      defaultRestOn: true, defaultRestSec: 90, readyOn: true, readySec: 5, voice: true, voiceDetail: true,
      showEffort: true, showLastTime: true, showPlates: true, showBests: true,
    });
  });
});
