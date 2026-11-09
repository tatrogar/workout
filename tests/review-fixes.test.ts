import { afterEach, describe, expect, it, vi } from "vitest";
import { parsePlan } from "../src/plan/parse";
import { addSeconds, circuitPhases, crossedCues, intervalPhases, isStopwatch, newTimer, start, stopwatchPhases, view } from "../src/timer/engine";
import { createWorkout, exerciseStatus, finish, settleTimer, setTimer } from "../src/workout/session";
import { pickShareFile } from "../src/export/share";
import { SPEC_EXAMPLE } from "./plan/example";

const S = 1000;
const T0 = 1_700_000_000_000;

function workout() {
  const r = parsePlan(SPEC_EXAMPLE, "lb");
  if (!r.ok) throw new Error();
  return createWorkout(r.plan, SPEC_EXAMPLE, new Date(T0), "w");
}

describe("review #1: cardio stopwatch time is never lost", () => {
  const RUN = 6;
  it("finish records a running stopwatch", () => {
    const w = setTimer(workout(), { exerciseIndex: RUN, state: start(newTimer(stopwatchPhases()), T0) });
    const done = finish(w, new Date(T0 + 25 * 60 * S));
    expect(done.exercises[RUN].durationSec).toBe(1500);
    expect(exerciseStatus(done.exercises[RUN])).toBe("done");
  });
  it("settleTimer records the stopwatch before it is replaced", () => {
    const w = setTimer(workout(), { exerciseIndex: RUN, state: start(newTimer(stopwatchPhases()), T0) });
    const s = settleTimer(w, T0 + 600 * S);
    expect(s.exercises[RUN].durationSec).toBe(600);
    expect(s.timer).toBeUndefined();
  });
  it("settleTimer leaves other timers alone", () => {
    const w = setTimer(workout(), { exerciseIndex: 3, state: start(newTimer(intervalPhases(8, 20, 10)), T0) });
    expect(settleTimer(w, T0 + 5 * S).timer).toBeDefined();
    expect(isStopwatch(newTimer(stopwatchPhases()))).toBe(true);
  });
});

describe("review #2: no stale cue after the phone was locked", () => {
  it("a gap longer than 1.5 s fires nothing", () => {
    const t = start(newTimer(intervalPhases(8, 20, 10)), T0);
    expect(crossedCues(t, T0 + 5 * S, T0 + 95 * S)).toEqual([]);
    expect(crossedCues(t, T0 + 5 * S, T0 + 600 * S)).toEqual([]);
    expect(crossedCues(t, T0 + 19.9 * S, T0 + 20.1 * S)).toEqual(["REST"]);
  });
});

describe("review #3: audio resumes a suspended context", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
  it("beep resumes a context Android suspended", async () => {
    const resume = vi.fn(() => Promise.resolve());
    const node = () => ({ connect: (x: unknown) => x, start() {}, stop() {}, frequency: { value: 0 }, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, type: "" });
    class FakeCtx { state = "running"; currentTime = 0; destination = {}; resume = resume; createOscillator = node; createGain = node; }
    vi.stubGlobal("AudioContext", FakeCtx);
    const cues = await import("../src/timer/cues");
    cues.unlockAudio();
    const ctx = cues.audioContextForTest()!;
    (ctx as unknown as FakeCtx).state = "suspended";
    resume.mockClear();
    cues.browserDeps.beep(880, 100);
    expect(resume).toHaveBeenCalled();
  });
});

describe("review #4: units before ×", () => {
  it("parses '135 lb × 8' and '155 X 6' in sets", () => {
    const r = parsePlan("## Bench\nsets: 135 lb × 8, 155 lb X 6", "lb");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plan.exercises[0]).toMatchObject({ sets: [{ weight: 135, reps: 8 }, { weight: 155, reps: 6 }] });
  });
});

describe("review #5: share a file Android accepts", () => {
  it("falls back to a .txt text/plain file", () => {
    const can = (f: File) => f.type === "text/plain" && f.name.endsWith(".txt");
    const f = pickShareFile("workout-log-2026-11-09.md", "hi", can);
    expect(f?.name).toBe("workout-log-2026-11-09.txt");
    expect(f?.type).toBe("text/plain");
  });
  it("keeps .md when allowed, null when nothing is", () => {
    expect(pickShareFile("a.md", "x", () => true)?.name).toBe("a.md");
    expect(pickShareFile("a.md", "x", () => false)).toBeNull();
  });
});

describe("review #6: +15s does nothing on a rep move", () => {
  it("waiting phase is unchanged", () => {
    const c = start(newTimer(circuitPhases(1, [{ name: "a", reps: 10 }, { name: "b", sec: 30 }])), T0);
    const after = addSeconds(c, 15, T0 + 40 * S);
    expect(view(after, T0 + 40 * S)).toMatchObject({ index: 0, waiting: true });
  });
});
