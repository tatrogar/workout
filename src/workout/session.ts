import type { Plan } from "../plan/types";
import { elapsedMs, isStopwatch, view, type TimerState } from "../timer/engine";
import type { ExerciseLog, ExerciseStatus, LoggedSet, Workout } from "./types";

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

export function createWorkout(plan: Plan, planText: string, now: Date, id: string = newId()): Workout {
  const exercises = plan.exercises.map((ex): ExerciseLog => {
    const log: ExerciseLog = { planned: ex, status: "skipped" };
    if (ex.kind === "strength") log.sets = ex.sets.map((s): LoggedSet => ({ ...s, done: false }));
    if (ex.kind === "hold") log.holds = Array.from({ length: ex.sets }, () => ({ sec: ex.holdSec, done: false }));
    return log;
  });
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
