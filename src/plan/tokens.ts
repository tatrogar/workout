import type { CircuitMove, Seconds, Units } from "./types";

/** "45s", "90 s", "2 min", "1.5 min", "1:30", "20 minutes" → seconds. A bare number is rejected. */
export function parseDuration(input: string): Seconds | null {
  const s = input.trim().toLowerCase();
  let m = s.match(/^(\d+):([0-5]\d)$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = s.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes)$/);
  if (!m) return null;
  const n = Number(m[1]);
  const secs = m[2].startsWith("s") ? n : n * 60;
  return Math.round(secs);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Clock-style for timers: 45s, 2:00, 1:02:03. */
export function formatDuration(sec: Seconds): string {
  const t = Math.max(0, Math.round(sec));
  if (t < 60) return `${t}s`;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Prose-style for logs: 20 min, 1.5 min, 45s. */
export function formatMinutes(sec: Seconds): string {
  if (sec < 60) return `${Math.round(sec)}s`;
  const min = Math.round((sec / 60) * 10) / 10;
  return `${min} min`;
}

export function parseWeight(input: string, defaultUnits: Units): { value: number; units: Units } | null {
  const m = input.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(lb|lbs|kg|kgs)?$/);
  if (!m) return null;
  const units: Units = m[2] ? (m[2].startsWith("kg") ? "kg" : "lb") : defaultUnits;
  return { value: Number(m[1]), units };
}

/** "Plank 45s", "Push-ups 10 reps", "Side plank 20s/side" — the form plans and exports both use. */
export function moveText(m: CircuitMove): string {
  return `${m.name} ${m.reps !== undefined ? `${m.reps} reps` : `${m.sec}s`}${m.perSide ? "/side" : ""}`;
}
