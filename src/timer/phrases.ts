import type { Exercise } from "../plan/types";
import type { Cue, Phase } from "./engine";

/** What to say for a cue, or null to stay quiet. `phase` is the phase being entered. */
export function cuePhrase(cue: Cue, phase: Phase | null, exercise: Exercise | undefined, detail: boolean, restTimer = false): string | null {
  if (cue === "WARN") return null;
  if (cue === "END") return restTimer ? "Rest over" : "Done";
  if (cue === "REST") return phase?.label === "SWITCH" ? "Switch sides" : "Rest";
  const sideWord = phase?.side === "L" ? "Left" : phase?.side === "R" ? "Right" : null;
  // The second side is just named; the first side gets the move name too when detail is on.
  if (sideWord && (phase?.part === 2 || !detail)) return sideWord;
  if (!detail || !phase) return "Go";
  if (phase.label === "HOLD") return `Hold, set ${phase.round}${sideWord ? `, ${sideWord.toLowerCase()}` : ""}`;
  if (phase.label === "MOVE" && exercise?.kind === "circuit" && phase.moveIndex !== undefined) {
    const m = exercise.moves[phase.moveIndex];
    if (!m) return "Go";
    const amount = m.reps !== undefined ? `${m.reps} reps` : `${m.sec} seconds`;
    return `${m.name}, ${amount}${sideWord ? `, ${sideWord.toLowerCase()}` : m.perSide ? " each side" : ""}`;
  }
  if (phase.label === "WORK" && exercise?.kind === "intervals") return `Round ${phase.round}`;
  return "Go";
}
