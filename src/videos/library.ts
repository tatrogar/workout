import { parsePlan } from "../plan/parse";
import type { Exercise, Plan } from "../plan/types";
import { normalizeName } from "../trends/series";
import type { Template, Workout } from "../workout/types";
import type { Video } from "./youtube";
import type { UpNext } from "../store/data";

export function videoFor(videos: Record<string, Video>, name: string, aliases: Record<string, string>): Video | null {
  return videos[normalizeName(name, aliases)] ?? null;
}

type Sources = {
  workouts: Workout[];
  active: Workout | null;
  templates: Template[];
  upNext: UpNext[];
  videos: Record<string, Video>;
  knownNames?: string[];
  scheduled?: { planText: string }[];
};

const tidy = (n: string) => n.trim().replace(/\s+/g, " ");
const titleCase = (k: string) => k.charAt(0).toUpperCase() + k.slice(1);

function namesIn(exercises: Exercise[]): string[] {
  return exercises.flatMap((e) => [e.name, ...(e.kind === "circuit" ? e.moves.map((m) => m.name) : [])]);
}

/** Every exercise and circuit-move name in a plan. */
export function planNames(plan: Plan): string[] {
  return namesIn(plan.exercises);
}

/** Every exercise and circuit-move name the app knows about, once each (after merges), alphabetical. */
export function allExerciseNames(s: Sources, aliases: Record<string, string>): { key: string; display: string }[] {
  const raw: string[] = [];
  for (const w of [...s.workouts, ...(s.active ? [s.active] : [])]) raw.push(...namesIn(w.exercises.map((l) => l.planned)));
  for (const t of [...s.templates.map((x) => x.planText), ...s.upNext.map((x) => x.planText), ...(s.scheduled ?? []).map((x) => x.planText)]) {
    const r = parsePlan(t, "lb");
    if (r.ok) raw.push(...namesIn(r.plan.exercises));
  }
  raw.push(...(s.knownNames ?? []));
  const out = new Map<string, string>();
  for (const n of raw) {
    const key = normalizeName(n, aliases);
    const own = normalizeName(n, {}) === key; // prefer the name that is itself the merge target
    if (!out.has(key) || own) out.set(key, own || !out.has(key) ? tidy(n) : out.get(key)!);
  }
  for (const k of Object.keys(s.videos)) {
    const key = normalizeName(k, aliases);
    if (!out.has(key)) out.set(key, titleCase(key));
  }
  return [...out].map(([key, display]) => ({ key, display })).sort((a, b) => a.display.localeCompare(b.display, undefined, { sensitivity: "base" }));
}
