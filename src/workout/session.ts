import type { Exercise, Plan, Seconds } from "../plan/types";
import { elapsedMs, isStopwatch, view, type TimerState } from "../timer/engine";
import type { ExerciseLog, ExerciseStatus, LoggedSet, Workout } from "./types";
import type { SideResult } from "../timer/engine";

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function localDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function exerciseStatus(log: ExerciseLog): ExerciseStatus {
  if (log.skipped) return "skipped";
  const p = log.planned;
  const ratio = (done: number, of: number): ExerciseStatus => (done <= 0 ? "skipped" : done >= of ? "done" : "partial");
  switch (p.kind) {
    case "strength": return ratio(log.sets?.filter((s) => s.done).length ?? 0, p.sets.length);
    case "hold": return ratio(log.holds?.filter((h) => h.done).length ?? 0, p.sets);
    case "intervals":
    case "circuit": return ratio(log.roundsDone ?? 0, p.rounds);
    case "cardio":
    case "other": return ratio(log.durationSec ?? 0, p.durationSec);
  }
}

function withStatus(log: ExerciseLog): ExerciseLog {
  return { ...log, status: exerciseStatus(log) };
}

export function newLog(ex: Exercise): ExerciseLog {
  const log: ExerciseLog = { planned: ex, status: "skipped" };
  if (ex.kind === "strength") {
    log.sets = ex.sets.map((s): LoggedSet => ({
      ...s, done: false,
      ...(ex.perSide ? { sides: { left: { reps: s.reps, done: false }, right: { reps: s.reps, done: false } } } : {}),
    }));
  }
  if (ex.kind === "hold") log.holds = Array.from({ length: ex.sets }, () => ({ sec: ex.holdSec, done: false, ...(ex.perSide ? { sides: {} } : {}) }));
  return log;
}

export function createWorkout(plan: Plan, planText: string, now: Date, id: string = newId()): Workout {
  const exercises = plan.exercises.map(newLog);
  return {
    id,
    title: plan.title ?? localDate(now),
    startedAt: now.toISOString(),
    units: plan.units,
    exercises,
    planText,
    pending: true,
    currentIndex: 0,
  };
}

function mapEx(w: Workout, i: number, fn: (log: ExerciseLog) => ExerciseLog): Workout {
  return { ...w, exercises: w.exercises.map((e, j) => (j === i ? withStatus(fn(e)) : e)) };
}

/** Any recorded progress un-skips an exercise. */
const unskip = (log: ExerciseLog): ExerciseLog => ({ ...log, skipped: undefined });

export function toggleSet(w: Workout, exIdx: number, setIdx: number, now: Date): Workout {
  return mapEx(w, exIdx, (log) => ({
    ...unskip(log),
    sets: log.sets?.map((s, k) => (k === setIdx ? (s.done ? { ...s, done: false, at: undefined } : { ...s, done: true, at: now.toISOString() }) : s)),
  }));
}

export function editSet(w: Workout, exIdx: number, setIdx: number, patch: { weight?: number; reps?: number }): Workout {
  return mapEx(w, exIdx, (log) => ({ ...log, sets: log.sets?.map((s, k) => (k === setIdx ? { ...s, ...patch } : s)) }));
}

export function addSet(w: Workout, exIdx: number): Workout {
  return mapEx(w, exIdx, (log) => {
    const last = log.sets?.at(-1);
    const fresh: LoggedSet = last ? { ...(last.weight !== undefined ? { weight: last.weight } : {}), reps: last.reps, done: false } : { reps: 1, done: false };
    if (last?.sides) fresh.sides = { left: { reps: last.sides.left.reps, done: false }, right: { reps: last.sides.right.reps, done: false } };
    return { ...log, sets: [...(log.sets ?? []), fresh] };
  });
}

export function toggleHold(w: Workout, exIdx: number, i: number): Workout {
  return mapEx(w, exIdx, (log) => ({ ...unskip(log), holds: log.holds?.map((h, k) => (k === i ? { ...h, done: !h.done } : h)) }));
}

export function setRoundsDone(w: Workout, exIdx: number, n: number): Workout {
  return mapEx(w, exIdx, (log) => ({ ...unskip(log), roundsDone: Math.max(0, n) }));
}

/** Timer-driven count: never lowers a number the owner entered by hand. */
export function setRoundsAtLeast(w: Workout, exIdx: number, n: number): Workout {
  if ((w.exercises[exIdx]?.roundsDone ?? 0) >= n) return w;
  return setRoundsDone(w, exIdx, n);
}

/** Name of the exercise whose interval/hold/circuit timer is running somewhere other than exIdx, else null. */
export function runningElsewhere(w: Workout, exIdx: number, now: number): string | null {
  const t = w.timer;
  if (!t || t.exerciseIndex === exIdx || t.state.startedAt === null) return null;
  if (t.state.phases[0]?.label === "REST_TIMER" || isStopwatch(t.state)) return null;
  const kind = w.exercises[t.exerciseIndex]?.planned.kind;
  if (kind === "cardio" || kind === "other") return null; // its time is saved automatically
  if (view(t.state, now).done) return null;
  return w.exercises[t.exerciseIndex]?.planned.name ?? null;
}

export function setCardio(w: Workout, exIdx: number, v: { durationSec?: number; distance?: number }): Workout {
  return mapEx(w, exIdx, (log) => ({ ...unskip(log), ...v }));
}

export function setNotes(w: Workout, exIdx: number, text: string): Workout {
  return mapEx(w, exIdx, (log) => ({ ...log, notes: text || undefined }));
}

export function skipExercise(w: Workout, exIdx: number): Workout {
  return mapEx(w, exIdx, (log) => ({ ...log, skipped: true }));
}

export function setCurrent(w: Workout, i: number): Workout {
  return { ...w, currentIndex: Math.max(0, Math.min(w.exercises.length - 1, i)) };
}

export function setTimer(w: Workout, timer: { exerciseIndex: number; state: TimerState } | undefined): Workout {
  return { ...w, timer };
}

/** The session clock starts here; the logged length counts from this tap. */
export function startSession(w: Workout, now: Date): Workout {
  const { pending: _p, ...rest } = w;
  return { ...rest, startedAt: now.toISOString() };
}

export function setEffort(w: Workout, exIdx: number, effort: number | undefined): Workout {
  const v = effort === undefined ? undefined : Math.max(1, Math.min(10, Math.round(effort)));
  return mapEx(w, exIdx, (log) => ({ ...log, effort: v }));
}

/** The live timer if it is a cardio/other countdown (or legacy stopwatch) that has been started. */
function durationTimer(w: Workout) {
  const t = w.timer;
  if (!t || t.state.startedAt === null || t.state.phases[0]?.label === "REST_TIMER") return null;
  const planned = w.exercises[t.exerciseIndex]?.planned;
  if (!planned || (planned.kind !== "cardio" && planned.kind !== "other")) return null;
  return { t, planned };
}

/** Before a timer is dropped or replaced: a cardio/other timer writes the time actually spent into the log. */
export function settleTimer(w: Workout, now: number): Workout {
  const d = durationTimer(w);
  if (!d) return w;
  const secs = Math.round(elapsedMs(d.t.state, now) / 1000);
  return setTimer(setCardio(w, d.t.exerciseIndex, { durationSec: secs }), undefined);
}

/** Called every tick. When a countdown hits zero the exercise is checked off with its planned time;
 *  'other' stops there, cardio keeps counting so a longer session logs its real length. */
export function tickCountdown(w: Workout, now: number): Workout {
  const d = durationTimer(w);
  if (!d || isStopwatch(d.t.state) || !view(d.t.state, now).done) return w;
  const i = d.t.exerciseIndex;
  if (d.planned.kind === "other") return setTimer(setCardio(w, i, { durationSec: d.planned.durationSec }), undefined);
  if ((w.exercises[i].durationSec ?? 0) >= d.planned.durationSec) return w;
  return setCardio(w, i, { durationSec: d.planned.durationSec });
}

export function finish(w: Workout, now: Date, notes?: string): Workout {
  const { timer: _t, currentIndex: _c, pending: _p, ...rest } = settleTimer(w, now.getTime());
  return {
    ...rest,
    finishedAt: now.toISOString(),
    notes: notes || w.notes,
    exercises: rest.exercises.map(withStatus),
  };
}

/** Timer-driven: the first n holds are done (never un-checks ones the owner ticked by hand). */
export function setHoldsDone(w: Workout, exIdx: number, n: number): Workout {
  return mapEx(w, exIdx, (log) => ({ ...unskip(log), holds: log.holds?.map((h, k) => (k < n ? { ...h, done: true } : h)) }));
}

// ---- Changing the plan mid-workout. Indexes shift, so any timer is saved (cardio/other) and dropped first.

function restructure(w: Workout, now: number, fn: (logs: ExerciseLog[], cur: number) => { logs: ExerciseLog[]; cur: number }): Workout {
  const base = setTimer(settleTimer(w, now), undefined);
  const { logs, cur } = fn(base.exercises, base.currentIndex ?? 0);
  return { ...base, exercises: logs, currentIndex: Math.max(0, Math.min(logs.length - 1, cur)) };
}

export function insertExercises(w: Workout, at: number, exercises: Exercise[], now: number): Workout {
  if (!exercises.length) return w;
  const i = Math.max(0, Math.min(w.exercises.length, at));
  return restructure(w, now, (logs, cur) => ({
    logs: [...logs.slice(0, i), ...exercises.map(newLog), ...logs.slice(i)],
    cur: i <= cur ? cur + exercises.length : cur,
  }));
}

export function removeExercise(w: Workout, idx: number, now: number): Workout {
  if (w.exercises.length <= 1 || idx < 0 || idx >= w.exercises.length) return w;
  return restructure(w, now, (logs, cur) => ({ logs: logs.filter((_, j) => j !== idx), cur: idx < cur ? cur - 1 : cur }));
}

export function moveExercise(w: Workout, idx: number, delta: number, now: number): Workout {
  const to = idx + delta;
  if (idx < 0 || idx >= w.exercises.length || to < 0 || to >= w.exercises.length) return w;
  return restructure(w, now, (logs, cur) => {
    const next = [...logs];
    [next[idx], next[to]] = [next[to], next[idx]];
    return { logs: next, cur: cur === idx ? to : cur === to ? idx : cur };
  });
}

export function replaceExercise(w: Workout, idx: number, ex: Exercise, now: number): Workout {
  if (idx < 0 || idx >= w.exercises.length) return w;
  return restructure(w, now, (logs, cur) => ({ logs: logs.map((l, j) => (j === idx ? newLog(ex) : l)), cur }));
}

/** Put a finished workout back in progress. The session clock picks up where it stopped. */
export function reopen(w: Workout, now: Date): Workout {
  const { finishedAt, ...rest } = w;
  const ran = finishedAt ? Math.max(0, Date.parse(finishedAt) - Date.parse(w.startedAt)) : 0;
  return { ...rest, startedAt: new Date(now.getTime() - ran).toISOString(), currentIndex: 0 };
}

/** Rest after a strength set: the plan's own, else the default from Settings if that is on. */
export function effectiveRest(ex: Exercise, s: { defaultRestOn: boolean; defaultRestSec: Seconds }): Seconds | undefined {
  if (ex.kind !== "strength") return undefined;
  return ex.restSec ?? (s.defaultRestOn && s.defaultRestSec > 0 ? s.defaultRestSec : undefined);
}

// ---- Per-side logging

type SideKey = "left" | "right";
const key = (s: "L" | "R"): SideKey => (s === "L" ? "left" : "right");

/** Check or uncheck one side of a per-side strength set. The set is done once both sides are. */
export function toggleSide(w: Workout, exIdx: number, setIdx: number, side: SideKey, now: Date): Workout {
  return mapEx(w, exIdx, (log) => ({
    ...unskip(log),
    sets: log.sets?.map((s, k) => {
      if (k !== setIdx || !s.sides) return s;
      const sides = { ...s.sides, [side]: { ...s.sides[side], done: !s.sides[side].done } };
      const done = sides.left.done && sides.right.done;
      return { ...s, sides, done, at: done ? now.toISOString() : undefined };
    }),
  }));
}

export function editSide(w: Workout, exIdx: number, setIdx: number, side: SideKey, reps: number): Workout {
  return mapEx(w, exIdx, (log) => ({
    ...log,
    sets: log.sets?.map((s, k) => (k === setIdx && s.sides ? { ...s, sides: { ...s.sides, [side]: { ...s.sides[side], reps: Math.max(0, Math.round(reps)) } } } : s)),
  }));
}

/** Write timed side results (holds) or per-side move results (circuits) into the log. Idempotent. */
export function recordSides(w: Workout, exIdx: number, results: SideResult[]): Workout {
  if (!results.length) return w;
  return mapEx(w, exIdx, (log) => {
    if (log.planned.kind === "hold" && log.holds) {
      const holds = log.holds.map((h, i) => {
        const mine = results.filter((r) => r.round === i + 1 && r.moveIndex === undefined);
        if (!mine.length) return h;
        const sides = { ...h.sides };
        for (const r of mine) sides[key(r.side)] = r.value;
        return { ...h, sides, done: (sides.left ?? 0) > 0 && (sides.right ?? 0) > 0 };
      });
      return { ...unskip(log), holds };
    }
    if (log.planned.kind === "circuit") {
      const list = [...(log.sideLog ?? [])];
      for (const r of results) {
        if (r.moveIndex === undefined) continue;
        const i = list.findIndex((e) => e.round === r.round && e.moveIndex === r.moveIndex);
        const entry = i >= 0 ? { ...list[i] } : { round: r.round, moveIndex: r.moveIndex };
        entry[key(r.side)] = r.value;
        if (i >= 0) list[i] = entry; else list.push(entry);
      }
      list.sort((a, b) => a.round - b.round || a.moveIndex - b.moveIndex);
      return { ...unskip(log), sideLog: list };
    }
    return log;
  });
}

/** Reps that count for a set: both sides' done reps for a per-side set. */
export function setReps(s: LoggedSet): number {
  if (!s.sides) return s.reps;
  return (s.sides.left.done ? s.sides.left.reps : 0) + (s.sides.right.done ? s.sides.right.reps : 0);
}
