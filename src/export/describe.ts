import type { Exercise } from "../plan/types";
import { formatMinutes } from "../plan/tokens";
import type { ExerciseLog, LoggedSet } from "../workout/types";

const restTxt = (s?: number) => (s !== undefined ? `, rest ${s}s` : "");
const setTxt = (s: { weight?: number; reps: number }) => (s.weight !== undefined ? `${s.weight}x${s.reps}` : `bw x${s.reps}`);

export function describePlanned(ex: Exercise): string {
  switch (ex.kind) {
    case "strength": {
      const f = ex.sets[0];
      const same = ex.sets.every((s) => s.reps === f.reps && s.weight === f.weight);
      const body = same ? `${ex.sets.length}x${f.reps}${f.weight !== undefined ? ` @ ${f.weight}` : ""}` : ex.sets.map(setTxt).join(", ");
      return `${body}${restTxt(ex.restSec)}`;
    }
    case "intervals": return `${ex.rounds} x ${ex.workSec}s/${ex.restSec}s`;
    case "hold": return `${ex.sets} x ${ex.holdSec}s${restTxt(ex.restSec)}`;
    case "circuit": return `${ex.rounds} rounds`;
    case "cardio": return `${formatMinutes(ex.durationSec)}${ex.distance !== undefined ? `, ${ex.distance} ${ex.distanceUnit ?? "mi"}` : ""}`;
    case "other": return formatMinutes(ex.durationSec);
  }
}

/** Short result for one-line use: "done 8/8 rounds", "185x5 ✓, …", "skipped". */
export function describeDone(log: ExerciseLog): string {
  if (log.status === "skipped") return "skipped";
  const p = log.planned;
  switch (p.kind) {
    case "strength": return (log.sets ?? []).map((s: LoggedSet) => `${setTxt(s)} ${s.done ? "✓" : "✗"}`).join(", ");
    case "intervals": return `done ${log.roundsDone ?? 0}/${p.rounds} rounds`;
    case "hold": return `done ${log.holds?.filter((h) => h.done).length ?? 0}/${p.sets} sets`;
    case "circuit": return `done ${log.roundsDone ?? 0}/${p.rounds}`;
    case "cardio":
      return `done ${formatMinutes(log.durationSec ?? 0)}${log.distance ? `, ${log.distance} ${p.distanceUnit ?? "mi"}` : ""}`;
    case "other": return `done ${formatMinutes(log.durationSec ?? 0)}`;
  }
}

/** Lines for one exercise, as written in the export file. */
export function describeLog(log: ExerciseLog): string[] {
  const name = log.planned.name;
  const lines: string[] = [];
  if (log.status === "skipped") lines.push(`- ${name} — skipped`);
  else if (log.planned.kind === "strength") {
    lines.push(`- ${name} — planned ${describePlanned(log.planned)}`, `  - done: ${describeDone(log)}`);
  } else lines.push(`- ${name} — planned ${describePlanned(log.planned)} — ${describeDone(log)}`);
  if (log.planned.kind === "circuit" && log.status !== "skipped")
    lines.push(`  - moves: ${log.planned.moves.map((m) => `${m.name} ${m.reps !== undefined ? `${m.reps} reps` : `${m.sec}s`}`).join(", ")}`);
  if (log.notes) lines.push(`  - note: ${log.notes}`);
  return lines;
}
