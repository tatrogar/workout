import { describe, expect, it } from "vitest";
import {
  addSeconds, circuitPhases, crossedCues, elapsedMs, holdPhases, intervalPhases, newTimer,
  pause, restPhases, resume, skip, start, view,
} from "../../src/timer/engine";

const S = 1000;
const T0 = 1_700_000_000_000;

describe("phase builders", () => {
  it("intervals have no trailing rest", () => {
    const p = intervalPhases(8, 20, 10);
    expect(p).toHaveLength(15);
    expect(p[14]).toMatchObject({ label: "WORK", round: 8, sec: 20 });
    expect(p[1]).toMatchObject({ label: "REST", round: 1, sec: 10 });
  });
  it("holds rest between sets only", () => {
    expect(holdPhases(3, 45, 30).map((p) => p.label)).toEqual(["HOLD", "REST", "HOLD", "REST", "HOLD"]);
    expect(holdPhases(2, 45).map((p) => p.label)).toEqual(["HOLD", "HOLD"]);
  });
  it("circuits step through moves; rep moves wait (sec 0)", () => {
    const p = circuitPhases(2, [{ name: "Plank", sec: 45 }, { name: "Dead bug", reps: 10 }], 60);
    expect(p.map((x) => [x.label, x.sec, x.round, x.moveIndex])).toEqual([
      ["MOVE", 45, 1, 0], ["MOVE", 0, 1, 1], ["REST", 60, 1, undefined], ["MOVE", 45, 2, 0], ["MOVE", 0, 2, 1],
    ]);
  });
});

describe("view", () => {
  const t = start(newTimer(intervalPhases(8, 20, 10)), T0);
  it("is in the right phase", () => {
    expect(view(t, T0 + 25 * S)).toMatchObject({ index: 1, remainingSec: 5, done: false });
    expect(view(t, T0 + 25 * S).phase?.label).toBe("REST");
  });
  it("is done long after the end (phone was locked)", () => {
    expect(view(t, T0 + 600 * S)).toMatchObject({ done: true, phase: null });
  });
  it("not started shows the first phase full", () => {
    expect(view(newTimer(restPhases(60)), T0)).toMatchObject({ index: 0, remainingSec: 60, done: false });
  });
  it("pause and resume", () => {
    let s = pause(t, T0 + 5 * S);
    expect(view(s, T0 + 50 * S).remainingSec).toBe(15);
    s = resume(s, T0 + 65 * S);
    expect(view(s, T0 + 70 * S)).toMatchObject({ index: 0, remainingSec: 10 });
    expect(elapsedMs(s, T0 + 70 * S)).toBe(10 * S);
  });
  it("addSeconds extends the current phase", () => {
    const r = start(newTimer(restPhases(60)), T0);
    expect(view(addSeconds(r, 15, T0 + 10 * S), T0 + 10 * S).remainingSec).toBe(65);
  });
  it("skip jumps to the next phase", () => {
    const s = skip(t, T0 + 3 * S);
    expect(view(s, T0 + 3 * S)).toMatchObject({ index: 1, remainingSec: 10 });
  });
  it("rep moves wait until skipped", () => {
    const c = start(newTimer(circuitPhases(1, [{ name: "a", sec: 10 }, { name: "b", reps: 5 }])), T0);
    expect(view(c, T0 + 100 * S)).toMatchObject({ index: 1, done: false, waiting: true });
    const d = skip(c, T0 + 100 * S);
    expect(view(d, T0 + 100 * S).done).toBe(true);
  });
});

describe("crossedCues", () => {
  const t = start(newTimer(intervalPhases(8, 20, 10)), T0);
  it("warns at 3-2-1", () => {
    expect(crossedCues(t, T0 + 17.5 * S, T0 + 18.5 * S)).toEqual(["WARN"]);
    expect(crossedCues(t, T0 + 10 * S, T0 + 11 * S)).toEqual([]);
  });
  it("cues the new phase", () => {
    expect(crossedCues(t, T0 + 19.9 * S, T0 + 20.1 * S)).toEqual(["REST"]);
    expect(crossedCues(t, T0 + 29.9 * S, T0 + 30.1 * S)).toEqual(["WORK"]);
  });
  it("ends a rest timer", () => {
    const r = start(newTimer(restPhases(60)), T0);
    expect(crossedCues(r, T0 + 59.9 * S, T0 + 60.1 * S)).toEqual(["END"]);
  });
  it("does not replay missed cues", () => {
    expect(crossedCues(t, T0 + 5 * S, T0 + 600 * S)).toEqual(["END"]);
    expect(crossedCues(t, T0 + 5 * S, T0 + 95 * S)).toEqual(["WORK"]);
  });
});
