import { useEffect } from "react";
import { completedPhases, intervalPhases, newTimer, view, withReady } from "../../timer/engine";
import { fireCue } from "../../timer/cues";
import { useSettings } from "../../store/settings";
import { setRoundsAtLeast } from "../../workout/session";
import type { ExerciseProps } from "./shared";
import { TimerControls } from "./TimerControls";
import { TimerFace } from "./TimerFace";

export function IntervalsView({ w, idx, now, timer, update, setTimer }: ExerciseProps) {
  const log = w.exercises[idx];
  const p = log.planned;
  const settings = useSettings();
  const state = timer ?? (p.kind === "intervals" ? newTimer(withReady(intervalPhases(p.rounds, p.workSec, p.restSec))) : null);
  const done = state ? completedPhases(state, now, "WORK") : 0;
  useEffect(() => {
    if (state?.startedAt != null && done > (log.roundsDone ?? 0)) update((x) => setRoundsAtLeast(x, idx, done));
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  if (p.kind !== "intervals" || !state) return null;
  const v = view(state, now);
  const round = v.phase?.round ?? p.rounds;
  return (
    <div className="space-y-4">
      <TimerFace v={v} sub={`Round ${round} of ${p.rounds} · ${p.workSec}s on / ${p.restSec}s off`} />
      {!v.done && <TimerControls state={state} now={now} onChange={setTimer} onStart={() => fireCue("WARN", settings)} />}
      <p className="text-center text-[var(--muted)]">Rounds done: {log.roundsDone ?? 0} / {p.rounds}</p>
    </div>
  );
}
