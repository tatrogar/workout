import { useEffect } from "react";
import { Stepper } from "../../components/ui";
import { circuitPhases, completedPhases, newTimer, view } from "../../timer/engine";
import { fireCue } from "../../timer/cues";
import { useSettings } from "../../store/settings";
import { setRoundsAtLeast, setRoundsDone } from "../../workout/session";
import type { ExerciseProps } from "./shared";
import { TimerControls } from "./TimerControls";
import { TimerFace } from "./TimerFace";

export function CircuitView({ w, idx, now, timer, update, setTimer }: ExerciseProps) {
  const log = w.exercises[idx];
  const p = log.planned;
  const settings = useSettings();
  const state = timer ?? (p.kind === "circuit" ? newTimer(circuitPhases(p.rounds, p.moves, p.restSec)) : null);
  const last = p.kind === "circuit" ? p.moves.length - 1 : 0;
  const done = state ? completedPhases(state, now, "MOVE", (ph) => ph.moveIndex === last) : 0;
  useEffect(() => {
    if (state?.startedAt != null && done > (log.roundsDone ?? 0)) update((x) => setRoundsAtLeast(x, idx, done));
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  if (p.kind !== "circuit" || !state) return null;
  const v = view(state, now);
  const move = v.phase?.moveIndex !== undefined ? p.moves[v.phase.moveIndex] : null;
  const next = state.phases.slice(v.index + 1).find((ph) => ph.label === "MOVE");
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-3xl font-bold">{v.done ? "Circuit done" : move ? move.name : v.phase?.label === "REST" ? "Rest" : ""}</div>
        {move?.reps !== undefined && !v.done && <div className="text-2xl text-[var(--muted)]">{move.reps} reps</div>}
      </div>
      <TimerFace v={v} sub={`Round ${v.phase?.round ?? p.rounds} of ${p.rounds}${next && next.moveIndex !== undefined ? ` · next: ${p.moves[next.moveIndex].name}` : ""}`} />
      {!v.done && <TimerControls state={state} now={now} onChange={setTimer} onStart={() => fireCue("WORK", settings)} doneLabel={v.waiting ? "Done ✓" : "Skip"} waiting={v.waiting} />}
      <ol className="space-y-1 text-[var(--muted)]">
        {p.moves.map((m, i) => (
          <li key={i} className={move === m ? "font-semibold text-[var(--text)]" : ""}>{i + 1}. {m.name} — {m.reps !== undefined ? `${m.reps} reps` : `${m.sec}s`}</li>
        ))}
      </ol>
      <div className="flex items-center justify-center gap-3">
        <span>Rounds done</span>
        <Stepper label="Rounds done" value={log.roundsDone ?? 0} step={1} onChange={(n) => update((x) => setRoundsDone(x, idx, Math.round(n)))} suffix={`/ ${p.rounds}`} />
      </div>
    </div>
  );
}
