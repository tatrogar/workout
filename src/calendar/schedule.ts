/** A workout plan on the calendar. date null = unscheduled (e.g. moved over from the old Up next list). */
export type Scheduled = { id: string; date: string | null; title: string; planText: string; workoutId?: string };
export type DayStatus = "done" | "missed" | "planned";

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** "YYYY-MM-DD" → a local Date at noon (noon avoids daylight-saving edge cases). */
const fromIso = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d, 12); };

export function todayIso(now = new Date()): string {
  return toIso(now);
}

export function addDays(iso: string, n: number): string {
  const d = fromIso(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(iso: string): number {
  return (fromIso(iso).getDay() + 6) % 7;
}

export type WeekStart = "mon" | "sun";

/** First day of the week containing `iso`, for weeks starting Monday or Sunday. */
export function startOfWeek(iso: string, start: WeekStart = "mon"): string {
  const back = start === "sun" ? fromIso(iso).getDay() : weekdayIndex(iso);
  return addDays(iso, -back);
}

export function mondayOf(iso: string): string {
  return startOfWeek(iso, "mon");
}

/** Whole weeks covering a month (month is 0-based, like Date), starting Monday or Sunday. */
export function monthGrid(year: number, month: number, start: WeekStart = "mon"): string[][] {
  const first = toIso(new Date(year, month, 1, 12));
  const last = toIso(new Date(year, month + 1, 0, 12));
  const weeks: string[][] = [];
  for (let d = startOfWeek(first, start); d <= last; d = addDays(d, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
  return weeks;
}

const WEEKDAY = /^(mon(?:day)?|tue(?:s|sday)?|wed(?:s|nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i;
const ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** A title that starts with a weekday ("Mon · Upper", "Tuesday: run") → 0 (Mon) … 6 (Sun). */
export function weekdayOf(title: string): number | null {
  const m = title.trim().match(WEEKDAY);
  return m ? ORDER.indexOf(m[1].slice(0, 3).toLowerCase()) : null;
}

/** Calendar label: drop a leading weekday ("Mon · Upper" → "Upper") and shorten long names. */
export function shortTitle(title: string, max = 14): string {
  const stripped = title.trim().replace(WEEKDAY, "").replace(/^\s*[·\-–—:|,]?\s*/, "").trim();
  const t = stripped || title.trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/**
 * Where pasted workouts go. One workout: the tapped date. Several, all titled with weekdays: each on the
 * first matching weekday on or after the tapped date. Otherwise: consecutive days from the tapped date.
 */
export function placePlans<T extends { title: string }>(plans: T[], tapped: string): (T & { date: string })[] {
  if (plans.length === 1) return [{ ...plans[0], date: tapped }];
  const days = plans.map((p) => weekdayOf(p.title));
  if (days.every((d) => d !== null)) {
    const start = weekdayIndex(tapped);
    return plans.map((p, i) => ({ ...p, date: addDays(tapped, (days[i]! - start + 7) % 7) }));
  }
  return plans.map((p, i) => ({ ...p, date: addDays(tapped, i) }));
}

export function dayStatus(s: Scheduled, workouts: { id: string; finishedAt?: string }[], today: string): DayStatus {
  if (s.workoutId && workouts.some((w) => w.id === s.workoutId && w.finishedAt)) return "done";
  if (s.date && s.date < today) return "missed";
  return "planned";
}

/** Dates (local) that have at least one finished workout. */
export function loggedDates(workouts: { startedAt: string; finishedAt?: string }[]): Set<string> {
  return new Set(workouts.filter((w) => w.finishedAt).map((w) => toIso(new Date(w.startedAt))));
}
