import type { Workout } from "../workout/types";
import { FORMAT_VERSION } from "./markdown";

export type ImportResult = { ok: true; workouts: Workout[]; aliases: Record<string, string>; skipped: number } | { ok: false; message: string };

const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const str = (v: unknown) => typeof v === "string";

function validExercise(e: unknown): boolean {
  const log = e as { planned?: Record<string, unknown>; status?: unknown };
  const p = log?.planned;
  if (!p || !str(p.name) || !["done", "partial", "skipped"].includes(log.status as string)) return false;
  switch (p.kind) {
    case "strength": return Array.isArray(p.sets) && p.sets.length > 0 && p.sets.every((s: { reps?: unknown }) => num(s?.reps));
    case "intervals": return num(p.rounds) && num(p.workSec) && num(p.restSec);
    case "hold": return num(p.sets) && num(p.holdSec);
    case "circuit": return num(p.rounds) && Array.isArray(p.moves);
    case "cardio":
    case "other": return num(p.durationSec);
    default: return false;
  }
}

function validWorkout(w: unknown): boolean {
  const x = w as Partial<Workout>;
  return !!x && str(x.id) && str(x.startedAt) && (x.units === "lb" || x.units === "kg") && Array.isArray(x.exercises) && x.exercises.every(validExercise);
}

export function parseExport(text: string): ImportResult {
  const blocks = [...text.matchAll(/```json\s*\n([\s\S]*?)\n```/g)];
  if (!blocks.length) return { ok: false, message: "This file has no workout data block. Pick a file this app exported." };
  let data: unknown;
  try { data = JSON.parse(blocks[blocks.length - 1][1]); } catch { return { ok: false, message: "The data block in this file is damaged." }; }
  const d = data as { formatVersion?: unknown; workouts?: unknown; aliases?: unknown };
  if (d.formatVersion !== FORMAT_VERSION) return { ok: false, message: `This file is format version ${String(d.formatVersion)}; this app reads version ${FORMAT_VERSION}.` };
  if (!Array.isArray(d.workouts)) return { ok: false, message: "The data block has no workouts list." };
  const workouts = (d.workouts as Workout[]).filter(validWorkout);
  const aliases = d.aliases && typeof d.aliases === "object" ? (d.aliases as Record<string, string>) : {};
  return { ok: true, workouts, aliases, skipped: d.workouts.length - workouts.length };
}

export function mergeWorkouts(existing: Workout[], incoming: Workout[]): Workout[] {
  const byId = new Map<string, Workout>();
  for (const w of [...existing, ...incoming]) {
    const have = byId.get(w.id);
    if (!have || (w.finishedAt ?? "") > (have.finishedAt ?? "")) byId.set(w.id, w);
  }
  return [...byId.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
