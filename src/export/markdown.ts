import type { Units } from "../plan/types";
import { localDate } from "../workout/session";
import type { Workout } from "../workout/types";
import { describeLog } from "./describe";

export const FORMAT_VERSION = 1;

export function workoutMinutes(w: Workout): number {
  if (!w.finishedAt) return 0;
  return Math.max(0, Math.round((Date.parse(w.finishedAt) - Date.parse(w.startedAt)) / 60000));
}

/** Workouts started within the last `days` days. */
export function recentWorkouts(workouts: Workout[], now: Date, days: number): Workout[] {
  const cutoff = now.getTime() - days * 86_400_000;
  return workouts.filter((w) => Date.parse(w.startedAt) >= cutoff);
}

export function exportFileName(now: Date): string {
  return `workout-log-${localDate(now)}.md`;
}

function clean(w: Workout): Workout {
  const { timer: _t, currentIndex: _c, pending: _p, ...rest } = w;
  return rest;
}

/** One workout as it appears in the export: heading, notes, one entry per exercise. */
export function workoutSection(w: Workout, units: Units): string[] {
  const unitNote = w.units !== units ? ` · weights in ${w.units}` : "";
  const out = [`## ${localDate(new Date(w.startedAt))} · ${w.title} · ${workoutMinutes(w)} min${unitNote}`];
  if (w.notes) out.push(`Notes: ${w.notes}`);
  out.push("");
  for (const log of w.exercises) out.push(...describeLog(log));
  return out;
}

/** Just one workout as plain text, for pasting straight into a chat. */
export function copyForClaude(w: Workout): string {
  return [`Workout log entry from my workout app (units: ${w.units}).`, "", ...workoutSection(w, w.units), ""].join("\n");
}

export function toMarkdown(workouts: Workout[], aliases: Record<string, string>, units: Units, now: Date): string {
  const done = workouts.filter((w) => w.finishedAt).map(clean).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const dates = done.map((w) => localDate(new Date(w.startedAt)));
  const range = done.length ? ` · ${dates[dates.length - 1]} to ${dates[0]}` : "";
  const out: string[] = [
    "# Workout log",
    `Exported ${localDate(now)} · ${done.length} workout${done.length === 1 ? "" : "s"}${range} · units: ${units}`,
    "",
  ];
  for (const w of done) out.push(...workoutSection(w, units), "");
  const data = { formatVersion: FORMAT_VERSION, exportedAt: now.toISOString(), units, aliases, workouts: done };
  out.push("---", "", `Raw data (format version ${FORMAT_VERSION}):`, "", "```json", JSON.stringify(data), "```", "");
  return out.join("\n");
}
