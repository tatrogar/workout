import type { Units } from "../plan/types";
import { describeDone } from "../export/describe";
import { localDate } from "../workout/session";
import type { ExerciseLog, Workout } from "../workout/types";
import { convert, normalizeName } from "./series";

const newestFirst = (ws: Workout[]) => ws.filter((w) => w.finishedAt).sort((a, b) => b.startedAt.localeCompare(a.startedAt));

/** What happened the last time this exercise was done, for showing during a workout. */
export function lastTime(ws: Workout[], name: string, aliases: Record<string, string>): { date: string; text: string } | null {
  const key = normalizeName(name, aliases);
  for (const w of newestFirst(ws)) {
    const log = w.exercises.find((l) => l.status !== "skipped" && normalizeName(l.planned.name, aliases) === key);
    if (log) return { date: localDate(new Date(w.startedAt)), text: describeDone(log) };
  }
  return null;
}

/** The single number a personal best is judged on, or null if this kind has none. */
function bestOf(log: ExerciseLog, from: Units, to: Units): { value: number; unit: string } | null {
  const p = log.planned;
  if (log.status === "skipped") return null;
  if (p.kind === "strength") {
    const ws = (log.sets ?? []).filter((s) => s.done && s.weight !== undefined).map((s) => convert(s.weight!, from, to));
    return ws.length ? { value: Math.max(...ws), unit: ` ${to}` } : null;
  }
  if (p.kind === "cardio") return log.distance && log.distance > 0 ? { value: log.distance, unit: ` ${p.distanceUnit ?? "mi"}` } : null;
  if (p.kind === "hold") {
    const hs = (log.holds ?? []).filter((h) => h.done).map((h) => h.sec);
    return hs.length ? { value: Math.max(...hs), unit: "s hold" } : null;
  }
  return null;
}

/** Lines like "Squat: 190 lb, up from 185" for anything in `workout` that beats all of `history`. */
export function personalBests(history: Workout[], workout: Workout, aliases: Record<string, string>, units: Units): string[] {
  const past = history.filter((w) => w.finishedAt && w.id !== workout.id);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const log of workout.exercises) {
    const key = normalizeName(log.planned.name, aliases);
    const now = bestOf(log, workout.units, units);
    if (!now || seen.has(key)) continue;
    seen.add(key);
    const before = past.flatMap((w) => w.exercises
      .filter((l) => l.planned.kind === log.planned.kind && normalizeName(l.planned.name, aliases) === key)
      .map((l) => bestOf(l, w.units, units)?.value))
      .filter((v): v is number => v !== undefined);
    if (!before.length) continue;
    const prev = Math.max(...before);
    if (now.value > prev) out.push(`${log.planned.name}: ${now.value}${now.unit}, up from ${prev}`);
  }
  return out;
}
