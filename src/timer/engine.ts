import type { CircuitMove, Seconds } from "../plan/types";

/** sec 0 means "wait for Done" (a rep-count move). */
export type Phase = { label: "WORK" | "REST" | "HOLD" | "MOVE" | "REST_TIMER"; sec: Seconds; round: number; moveIndex?: number };
export type TimerState = { phases: Phase[]; startedAt: number | null; pausedAt: number | null; pausedTotalMs: number };
export type TimerView = { index: number; phase: Phase | null; remainingSec: number; done: boolean; waiting: boolean };
export type Cue = "WORK" | "REST" | "WARN" | "END";

export function intervalPhases(rounds: number, workSec: Seconds, restSec: Seconds): Phase[] {
  const out: Phase[] = [];
  for (let r = 1; r <= rounds; r++) {
    out.push({ label: "WORK", sec: workSec, round: r });
    if (r < rounds && restSec > 0) out.push({ label: "REST", sec: restSec, round: r });
  }
  return out;
}

export function holdPhases(sets: number, holdSec: Seconds, restSec?: Seconds): Phase[] {
  const out: Phase[] = [];
  for (let r = 1; r <= sets; r++) {
    out.push({ label: "HOLD", sec: holdSec, round: r });
    if (r < sets && restSec) out.push({ label: "REST", sec: restSec, round: r });
  }
  return out;
}

export function circuitPhases(rounds: number, moves: CircuitMove[], restSec?: Seconds): Phase[] {
  const out: Phase[] = [];
  for (let r = 1; r <= rounds; r++) {
    moves.forEach((m, i) => out.push({ label: "MOVE", sec: m.sec ?? 0, round: r, moveIndex: i }));
    if (r < rounds && restSec) out.push({ label: "REST", sec: restSec, round: r });
  }
  return out;
}

export function restPhases(sec: Seconds): Phase[] {
  return [{ label: "REST_TIMER", sec, round: 1 }];
}

export function newTimer(phases: Phase[]): TimerState {
  return { phases, startedAt: null, pausedAt: null, pausedTotalMs: 0 };
}

export function elapsedMs(s: TimerState, now: number): number {
  if (s.startedAt === null) return 0;
  return Math.max(0, (s.pausedAt ?? now) - s.startedAt - s.pausedTotalMs);
}

export function start(s: TimerState, now: number): TimerState {
  if (s.startedAt !== null) return s;
  return { ...s, startedAt: now, pausedAt: null, pausedTotalMs: 0 };
}

export function pause(s: TimerState, now: number): TimerState {
  if (s.startedAt === null || s.pausedAt !== null) return s;
  return { ...s, pausedAt: now };
}

export function resume(s: TimerState, now: number): TimerState {
  if (s.pausedAt === null) return s;
  return { ...s, pausedAt: null, pausedTotalMs: s.pausedTotalMs + (now - s.pausedAt) };
}

/** Where elapsed time lands: phase index and where that phase started (ms). */
function locate(phases: Phase[], elapsed: number): { index: number; phaseStart: number; waiting: boolean } {
  let t = 0;
  for (let i = 0; i < phases.length; i++) {
    const p = phases[i];
    if (p.sec === 0) return { index: i, phaseStart: t, waiting: true };
    const end = t + p.sec * 1000;
    if (elapsed < end) return { index: i, phaseStart: t, waiting: false };
    t = end;
  }
  return { index: phases.length, phaseStart: t, waiting: false };
}

export function view(s: TimerState, now: number): TimerView {
  const e = elapsedMs(s, now);
  const { index, phaseStart, waiting } = locate(s.phases, e);
  if (index >= s.phases.length) return { index, phase: null, remainingSec: 0, done: true, waiting: false };
  const phase = s.phases[index];
  const remainingSec = waiting ? 0 : (phaseStart + phase.sec * 1000 - e) / 1000;
  return { index, phase, remainingSec, done: false, waiting };
}

function withPhaseSec(s: TimerState, index: number, sec: Seconds): TimerState {
  const phases = s.phases.map((p, i) => (i === index ? { ...p, sec } : p));
  return { ...s, phases };
}

export function addSeconds(s: TimerState, sec: number, now: number): TimerState {
  const v = view(s, now);
  if (v.done || !v.phase) return s;
  return withPhaseSec(s, v.index, Math.max(0.001, v.phase.sec + sec));
}

/** End the current phase now. Starts the timer if it wasn't running. */
export function skip(s: TimerState, now: number): TimerState {
  const started = start(s, now);
  const e = elapsedMs(started, now);
  const { index, phaseStart } = locate(started.phases, e);
  if (index >= started.phases.length) return started;
  return withPhaseSec(started, index, Math.max(0.001, (e - phaseStart) / 1000));
}

function cueFor(label: Phase["label"]): Cue {
  return label === "REST" || label === "REST_TIMER" ? "REST" : "WORK";
}

/** Cues to fire for the clock moving from prevNow to now. Only the latest event; missed ones are not replayed. */
export function crossedCues(s: TimerState, prevNow: number, now: number): Cue[] {
  if (s.startedAt === null) return [];
  const a = view(s, prevNow);
  const b = view(s, now);
  if (b.done) return a.done ? [] : ["END"];
  if (b.index !== a.index) return [cueFor(b.phase!.label)];
  if (b.waiting) return [];
  for (const k of [1, 2, 3]) if (b.remainingSec <= k && a.remainingSec > k) return ["WARN"];
  return [];
}

/** How many phases with this label (and optional filter) have fully finished by `now`. */
export function completedPhases(s: TimerState, now: number, label: Phase["label"], filter: (p: Phase) => boolean = () => true): number {
  const v = view(s, now);
  return s.phases.slice(0, v.index).filter((p) => p.label === label && filter(p)).length;
}
