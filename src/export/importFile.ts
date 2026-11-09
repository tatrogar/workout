import type { Workout } from "../workout/types";
import { FORMAT_VERSION } from "./markdown";

export type ImportResult = { ok: true; workouts: Workout[]; aliases: Record<string, string> } | { ok: false; message: string };

export function parseExport(text: string): ImportResult {
  const blocks = [...text.matchAll(/```json\s*\n([\s\S]*?)\n```/g)];
  if (!blocks.length) return { ok: false, message: "This file has no workout data block. Pick a file this app exported." };
  let data: unknown;
  try { data = JSON.parse(blocks[blocks.length - 1][1]); } catch { return { ok: false, message: "The data block in this file is damaged." }; }
  const d = data as { formatVersion?: unknown; workouts?: unknown; aliases?: unknown };
  if (d.formatVersion !== FORMAT_VERSION) return { ok: false, message: `This file is format version ${String(d.formatVersion)}; this app reads version ${FORMAT_VERSION}.` };
  if (!Array.isArray(d.workouts)) return { ok: false, message: "The data block has no workouts list." };
  const workouts = (d.workouts as Workout[]).filter((w) => w && typeof w.id === "string" && typeof w.startedAt === "string" && Array.isArray(w.exercises));
  const aliases = d.aliases && typeof d.aliases === "object" ? (d.aliases as Record<string, string>) : {};
  return { ok: true, workouts, aliases };
}

export function mergeWorkouts(existing: Workout[], incoming: Workout[]): Workout[] {
  const byId = new Map<string, Workout>();
  for (const w of [...existing, ...incoming]) {
    const have = byId.get(w.id);
    if (!have || (w.finishedAt ?? "") > (have.finishedAt ?? "")) byId.set(w.id, w);
  }
  return [...byId.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
