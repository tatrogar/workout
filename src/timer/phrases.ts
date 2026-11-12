import type { Exercise } from "../plan/types";
import type { Cue, Phase } from "./engine";

/** What to say for a cue, or null to stay quiet. `phase` is the phase being entered. */
export function cuePhrase(cue: Cue, phase: Phase | null, exercise: Exercise | undefined, detail: boolean, restTimer = false): string | null {
  if (cue === "WARN") return null;
  if (cue === "END") return restTimer ? "Rest over" : "Done";
  if (cue === "REST") return "Rest";
  if (!detail || !phase) return "Go";
  if (phase.label === "HOLD") return `Hold, set ${phase.round}`;
  if (phase.label === "MOVE" && exercise?.kind === "circuit" && phase.moveIndex !== undefined) {
    const m = exercise.moves[phase.moveIndex];
    if (!m) return "Go";
    const amount = m.reps !== undefined ? `${m.reps} reps` : `${m.sec} seconds`;
    return `${m.name}, ${amount}${m.perSide ? " each side" : ""}`;
  }
  if (phase.label === "WORK" && exercise?.kind === "intervals") return `Round ${phase.round}`;
  return "Go";
}
