import type { Exercise } from "../plan/types";
import { formatMinutes, moveText } from "../plan/tokens";
import type { ExerciseLog, LoggedSet, SidePair } from "../workout/types";

const restTxt = (s?: number) => (s !== undefined ? `, rest ${s}s` : "");
const setTxt = (s: { weight?: number; reps: number }, side = "") => (s.weight !== undefined ? `${s.weight}x${s.reps}${side}` : `bw x${s.reps}${side}`);
const sideVal = (v: number | undefined, unit: string) => (v ? `${v}${unit}` : "–");
/** "25x L10 R8 ✓" — a side not done shows "–". */
function sideSetTxt(s: LoggedSet): string {
  const sd = s.sides!;
  const l = sd.left.done ? `L${sd.left.reps}` : "L–";
  const r = sd.right.done ? `R${sd.right.reps}` : "R–";
  return `${s.weight !== undefined ? `${s.weight}x` : "bw"} ${l} ${r} ${s.done ? "✓" : "✗"}`;
}
const pairTxt = (p: SidePair, unit: string, sep: string) => `L ${sideVal(p.left, unit)}${sep}R ${sideVal(p.right, unit)}`;

export function describePlanned(ex: Exercise): string {
  switch (ex.kind) {
    case "strength": {
      const f = ex.sets[0];
      const same = ex.sets.every((s) => s.reps === f.reps && s.weight === f.weight);
      const side = ex.perSide ? "/side" : "";
      const body = same ? `${ex.sets.length}x${f.reps}${side}${f.weight !== undefined ? ` @ ${f.weight}` : ""}` : ex.sets.map((s) => setTxt(s, side)).join(", ");
      return `${body}${restTxt(ex.restSec)}`;
    }
    case "intervals": return `${ex.rounds} x ${ex.workSec}s/${ex.restSec}s`;
    case "hold": return `${ex.sets} x ${ex.holdSec}s${ex.perSide ? "/side" : ""}${restTxt(ex.restSec)}`;
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
    case "strength": return (log.sets ?? []).map((s: LoggedSet) => (s.sides ? sideSetTxt(s) : `${setTxt(s)} ${s.done ? "✓" : "✗"}`)).join(", ");
    case "intervals": return `done ${log.roundsDone ?? 0}/${p.rounds} rounds`;
    case "hold":
      if (p.perSide) return `done ${(log.holds ?? []).map((h) => pairTxt(h.sides ?? {}, "s", " ")).join(", ")}`;
      return `done ${log.holds?.filter((h) => h.done).length ?? 0}/${p.sets} sets`;
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
    lines.push(`  - moves: ${log.planned.moves.map(moveText).join(", ")}${log.planned.moveRestSec !== undefined ? ` (rest ${log.planned.moveRestSec}s between moves)` : ""}`);
  if (log.planned.kind === "circuit" && log.status !== "skipped") {
    const moves = log.planned.moves;
    for (const e of log.sideLog ?? []) {
      const m = moves[e.moveIndex];
      if (m) lines.push(`  - ${m.name} round ${e.round}: ${pairTxt(e, m.reps !== undefined ? "" : "s", ", ")}`);
    }
  }
  if (log.effort !== undefined && log.status !== "skipped") lines.push(`  - effort: ${log.effort}/10`);
  if (log.notes) lines.push(`  - note: ${log.notes}`);
  return lines;
}
