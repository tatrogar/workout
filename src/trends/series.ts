import type { ExerciseKind, Units } from "../plan/types";
import { localDate } from "../workout/session";
import type { ExerciseLog, Workout } from "../workout/types";

const LB_PER_KG = 2.20462;
const round1 = (n: number) => Math.round(n * 10) / 10;

export function normalizeName(name: string, aliases: Record<string, string>): string {
  let k = name.trim().toLowerCase().replace(/\s+/g, " ");
  const seen = new Set<string>();
  while (aliases[k] && !seen.has(k)) { seen.add(k); k = aliases[k]; }
  return k;
}

const finished = (ws: Workout[]) => ws.filter((w) => w.finishedAt);
const newestFirst = (ws: Workout[]) => [...ws].sort((a, b) => b.startedAt.localeCompare(a.startedAt));

export type ExerciseName = { key: string; display: string; kind: ExerciseKind; sessions: number };

export function exerciseNames(ws: Workout[], aliases: Record<string, string>): ExerciseName[] {
  const out = new Map<string, ExerciseName>();
  for (const w of newestFirst(finished(ws))) {
    const seenHere = new Set<string>();
    for (const log of w.exercises) {
      if (log.status === "skipped") continue;
      const key = normalizeName(log.planned.name, aliases);
      if (seenHere.has(key)) continue;
      seenHere.add(key);
      const have = out.get(key);
      if (have) have.sessions++;
      else out.set(key, { key, display: log.planned.name.trim().replace(/\s+/g, " "), kind: log.planned.kind, sessions: 1 });
    }
  }
  return [...out.values()];
}

export type SeriesPoint = { date: string; workoutId: string; values: Record<string, number> };

function convert(weight: number, from: Units, to: Units): number {
  if (from === to) return weight;
  return round1(from === "kg" ? weight * LB_PER_KG : weight / LB_PER_KG);
}

function values(log: ExerciseLog, from: Units, to: Units): Record<string, number> | null {
  const p = log.planned;
  switch (p.kind) {
    case "strength": {
      const done = (log.sets ?? []).filter((s) => s.done);
      if (!done.length) return null;
      const weighted = done.filter((s) => s.weight !== undefined);
      if (!weighted.length) return { reps: done.reduce((a, s) => a + s.reps, 0) };
      return {
        topWeight: Math.max(...weighted.map((s) => convert(s.weight!, from, to))),
        volume: round1(weighted.reduce((a, s) => a + convert(s.weight!, from, to) * s.reps, 0)),
      };
    }
    case "intervals":
    case "circuit": return { done: log.roundsDone ?? 0, planned: p.rounds };
    case "hold": return { done: log.holds?.filter((h) => h.done).length ?? 0, planned: p.sets };
    case "cardio": {
      const minutes = round1((log.durationSec ?? 0) / 60);
      const v: Record<string, number> = { minutes };
      if (log.distance && log.distance > 0) {
        v.distance = log.distance;
        v.paceMinPer = minutes / log.distance;
      }
      return v;
    }
    case "other": return { minutes: round1((log.durationSec ?? 0) / 60) };
  }
}

/** One workout can list an exercise more than once: max the top weight, add up everything else. */
function combine(vs: Record<string, number>[]): Record<string, number> | null {
  if (!vs.length) return null;
  if (vs.length === 1) return vs[0];
  const out: Record<string, number> = {};
  for (const v of vs) {
    for (const [k, n] of Object.entries(v)) {
      if (k === "paceMinPer") continue;
      out[k] = k === "topWeight" ? Math.max(out[k] ?? -Infinity, n) : round1((out[k] ?? 0) + n);
    }
  }
  if (out.distance > 0 && out.minutes !== undefined) out.paceMinPer = out.minutes / out.distance;
  return out;
}

export function exerciseSeries(ws: Workout[], key: string, aliases: Record<string, string>, units: Units): { kind: ExerciseKind | null; points: SeriesPoint[] } {
  let kind: ExerciseKind | null = null;
  const points: SeriesPoint[] = [];
  const chron = newestFirst(finished(ws)).reverse();
  for (const w of chron) {
    const logs = w.exercises.filter((l) => l.status !== "skipped" && normalizeName(l.planned.name, aliases) === key);
    if (!logs.length) continue;
    kind ??= logs[0].planned.kind;
    const same = logs.filter((l) => l.planned.kind === kind);
    const v = combine(same.map((l) => values(l, w.units, units)).filter((x): x is Record<string, number> => x !== null));
    if (v) points.push({ date: localDate(new Date(w.startedAt)), workoutId: w.id, values: v });
  }
  return { kind, points };
}

function mondayOf(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

export function weeklySeries(ws: Workout[], now: Date, weeks = 12): { weekStart: string; workouts: number; minutes: number }[] {
  const thisWeek = mondayOf(now);
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(thisWeek);
    d.setDate(d.getDate() - 7 * (weeks - 1 - i));
    return { weekStart: localDate(d), workouts: 0, minutes: 0 };
  });
  const index = new Map(buckets.map((b, i) => [b.weekStart, i]));
  for (const w of finished(ws)) {
    const i = index.get(localDate(mondayOf(new Date(w.startedAt))));
    if (i === undefined) continue;
    buckets[i].workouts++;
    buckets[i].minutes += Math.max(0, Math.round((Date.parse(w.finishedAt!) - Date.parse(w.startedAt)) / 60000));
  }
  return buckets;
}

/** The one number a sparkline shows. */
export function primaryValue(v: Record<string, number>): number {
  return v.topWeight ?? v.reps ?? v.done ?? v.distance ?? v.minutes ?? 0;
}
