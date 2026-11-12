import { useEffect, useRef } from "react";
import { Stepper } from "../../components/ui";
import { circuitPhases, completedPhases, newTimer, sideResults, view, type TimerState } from "../../timer/engine";
import { fireCue } from "../../timer/cues";
import { sideOptions, useSettings } from "../../store/settings";
import { recordSides, setRoundsAtLeast, setRoundsDone } from "../../workout/session";
import type { ExerciseProps } from "./shared";
import { TimerControls } from "./TimerControls";
import { TimerFace } from "./TimerFace";

export function CircuitView({ w, idx, now, timer, update, setTimer }: ExerciseProps) {
  const log = w.exercises[idx];
  const p = log.planned;
  const settings = useSettings();
  const state = timer ?? (p.kind === "circuit" ? newTimer(circuitPhases(p.rounds, p.moves, p.restSec, p.moveRestSec, sideOptions(settings))) : null);
  const last = p.kind === "circuit" ? p.moves.length - 1 : 0;
  // A per-side last move has two phases; the round ends with the second.
  const done = state ? completedPhases(state, now, "MOVE", (ph) => ph.moveIndex === last && ph.part !== 1) : 0;
  const sidesDone = state ? sideResults(state, now).length : 0;
  const appliedSides = useRef(sidesDone);
  useEffect(() => {
    if (state?.startedAt != null && done > (log.roundsDone ?? 0)) update((x) => setRoundsAtLeast(x, idx, done));
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (state?.startedAt != null && sidesDone > appliedSides.current) update((x) => recordSides(x, idx, sideResults(state, Date.now())));
    appliedSides.current = sidesDone;
  }, [sidesDone]); // eslint-disable-line react-hooks/exhaustive-deps
  if (p.kind !== "circuit" || !state) return null;
  const v = view(state, now);
  const move = v.phase?.moveIndex !== undefined && v.phase.label !== "REST" ? p.moves[v.phase.moveIndex] : null;
  const next = state.phases.slice(v.index + 1).find((ph) => ph.label === "MOVE" && ph.part !== 2);
  const round = v.phase?.round ?? p.rounds;
  // A per-side rep move: Left/Right reps for this round, prefilled with the plan.
  const repSide = move && move.perSide && move.reps !== undefined && v.waiting ? move : null;
  const entry = repSide ? log.sideLog?.find((e) => e.round === round && e.moveIndex === v.phase!.moveIndex) : undefined;
  const setSide = (side: "L" | "R", value: number) => {
    const other = side === "L" ? entry?.right ?? repSide!.reps! : entry?.left ?? repSide!.reps!;
    update((x) => recordSides(x, idx, [
      { round, moveIndex: v.phase!.moveIndex!, side, value: Math.max(0, Math.round(value)) },
      { round, moveIndex: v.phase!.moveIndex!, side: side === "L" ? "R" : "L", value: other },
    ]));
  };
  const onChange = (s: TimerState) => {
    // Done on a per-side rep move saves both sides at the planned reps unless they were changed.
    if (repSide && !entry && view(s, Date.now()).index > v.index) {
      update((x) => recordSides(x, idx, [
        { round, moveIndex: v.phase!.moveIndex!, side: "L", value: repSide.reps! },
        { round, moveIndex: v.phase!.moveIndex!, side: "R", value: repSide.reps! },
      ]));
    }
    setTimer(s);
  };
  const sideLabel = v.phase?.side === "L" ? " · left" : v.phase?.side === "R" ? " · right" : "";
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-3xl font-bold">{v.done ? "Circuit done" : v.phase?.label === "SWITCH" ? "Switch sides" : move ? move.name : v.phase?.label === "REST" ? "Rest" : ""}</div>
        {move && !v.done && (move.reps !== undefined || move.perSide) && (
          <div className="text-2xl text-[var(--muted)]">{move.reps !== undefined ? `${move.reps} reps` : `${move.sec}s`}{move.perSide ? " each side" : ""}{sideLabel}</div>
        )}
      </div>
      <TimerFace v={v} sub={`Round ${round} of ${p.rounds}${next && next.moveIndex !== undefined ? ` · next: ${p.moves[next.moveIndex].name}` : ""}`} />
      {repSide && (
        <div className="flex items-center justify-center gap-4" data-testid="rep-sides">
          <label className="flex items-center gap-2">L<Stepper label="Left reps" value={entry?.left ?? repSide.reps} step={1} onChange={(n) => setSide("L", n)} /></label>
          <label className="flex items-center gap-2">R<Stepper label="Right reps" value={entry?.right ?? repSide.reps} step={1} onChange={(n) => setSide("R", n)} /></label>
        </div>
      )}
      {!v.done && <TimerControls state={state} now={now} onChange={onChange} onStart={() => fireCue("WORK", settings)}
        doneLabel={v.waiting ? "Done ✓" : v.phase?.label === "SWITCH" ? "Start next side" : "Skip"} waiting={v.waiting} />}
      <ol className="space-y-1 text-[var(--muted)]">
        {p.moves.map((m, i) => (
          <li key={i} className={move === m ? "font-semibold text-[var(--text)]" : ""}>{i + 1}. {m.name} — {m.reps !== undefined ? `${m.reps} reps` : `${m.sec}s`}{m.perSide ? " each side" : ""}</li>
        ))}
      </ol>
      <div className="flex items-center justify-center gap-3">
        <span>Rounds done</span>
        <Stepper label="Rounds done" value={log.roundsDone ?? 0} step={1} onChange={(n) => update((x) => setRoundsDone(x, idx, Math.round(n)))} suffix={`/ ${p.rounds}`} />
      </div>
    </div>
  );
}
