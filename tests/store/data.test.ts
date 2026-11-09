import { describe, expect, it } from "vitest";
import { createDataStore, exportDue, type KV } from "../../src/store/data";
import { parsePlan } from "../../src/plan/parse";
import { createWorkout, setTimer, toggleSet } from "../../src/workout/session";
import { newTimer, restPhases, start } from "../../src/timer/engine";

function memory(): KV & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}
function workout(id = "w1", at = "2026-11-07T17:00:00Z") {
  const r = parsePlan("## Squat\nstrength: 3x5 @ 185, rest 90s", "lb");
  if (!r.ok) throw new Error();
  return createWorkout(r.plan, "", new Date(at), id);
}

describe("data store", () => {
  it("persists every change to the active workout and rehydrates it", () => {
    const kv = memory();
    const a = createDataStore(kv);
    a.getState().startWorkout(workout());
    a.getState().updateActive((w) => toggleSet(w, 0, 0, new Date("2026-11-07T17:01:00Z")));
    a.getState().updateActive((w) => setTimer(w, { exerciseIndex: 0, state: start(newTimer(restPhases(90)), 123) }));
    expect(kv.data.get("workout.data")).toContain('"done":true');
    const b = createDataStore(kv);
    expect(b.getState().active?.exercises[0].sets?.[0].done).toBe(true);
    expect(b.getState().active?.timer?.state.startedAt).toBe(123);
  });

  it("finishActive moves the workout to the front of history", () => {
    const s = createDataStore(memory());
    s.getState().upsertWorkout({ ...workout("old", "2026-11-01T10:00:00Z"), finishedAt: "2026-11-01T11:00:00Z" });
    s.getState().startWorkout(workout("new"));
    const id = s.getState().finishActive(new Date("2026-11-07T18:00:00Z"), "ok");
    expect(id).toBe("new");
    expect(s.getState().active).toBeNull();
    expect(s.getState().workouts.map((w) => w.id)).toEqual(["new", "old"]);
    expect(s.getState().workouts[0].notes).toBe("ok");
  });

  it("templates, aliases and delete", () => {
    const s = createDataStore(memory());
    s.getState().saveTemplate({ id: "t1", name: "Legs", planText: "x", updatedAt: "" });
    s.getState().saveTemplate({ id: "t1", name: "Legs 2", planText: "y", updatedAt: "" });
    expect(s.getState().templates).toHaveLength(1);
    expect(s.getState().templates[0].name).toBe("Legs 2");
    s.getState().deleteTemplate("t1");
    expect(s.getState().templates).toHaveLength(0);
    s.getState().setAlias("Back Squat", "squat");
    expect(s.getState().aliases).toEqual({ "back squat": "squat" });
    s.getState().removeAlias("back squat");
    expect(s.getState().aliases).toEqual({});
  });

  it("a full storage does not crash, it flags an error", () => {
    const kv = memory();
    kv.setItem = () => { throw new Error("QuotaExceededError"); };
    const s = createDataStore(kv);
    expect(() => s.getState().startWorkout(workout())).not.toThrow();
    expect(s.getState().storageError).toBe(true);
  });
});

describe("exportDue", () => {
  const done = (finishedAt: string) => ({ ...workout(finishedAt), finishedAt });
  const now = new Date("2026-11-20T12:00:00Z");
  it("never exported with a workout", () => {
    expect(exportDue({ workouts: [done("2026-11-19T10:00:00Z")], lastExportAt: null }, now)).toBe(true);
  });
  it("nothing to export", () => {
    expect(exportDue({ workouts: [], lastExportAt: null }, now)).toBe(false);
  });
  it("13 days since export with newer workout", () => {
    expect(exportDue({ workouts: [done("2026-11-19T10:00:00Z")], lastExportAt: "2026-11-07T12:00:00Z" }, now)).toBe(false);
  });
  it("14 days since export with newer workout", () => {
    expect(exportDue({ workouts: [done("2026-11-19T10:00:00Z")], lastExportAt: "2026-11-06T12:00:00Z" }, now)).toBe(true);
  });
  it("old export but nothing new", () => {
    expect(exportDue({ workouts: [done("2026-10-01T10:00:00Z")], lastExportAt: "2026-10-21T12:00:00Z" }, now)).toBe(false);
  });
});
