import { useEffect } from "react";
import { Check } from "../../components/ui";
import { completedPhases, holdPhases, newTimer, view } from "../../timer/engine";
import { fireCue } from "../../timer/cues";
import { useSettings } from "../../store/settings";
import { setHoldsDone, toggleHold } from "../../workout/session";
import type { ExerciseProps } from "./shared";
import { TimerControls } from "./TimerControls";
import { TimerFace } from "./TimerFace";

export function HoldView({ w, idx, now, timer, update, setTimer }: ExerciseProps) {
  const log = w.exercises[idx];
  const p = log.planned;
  const settings = useSettings();
  const state = timer ?? (p.kind === "hold" ? newTimer(holdPhases(p.sets, p.holdSec, p.restSec)) : null);
  const done = state ? completedPhases(state, now, "HOLD") : 0;
  useEffect(() => {
    if (state?.startedAt != null && done > 0) update((x) => setHoldsDone(x, idx, done));
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  if (p.kind !== "hold" || !state) return null;
  const v = view(state, now);
  return (
    <div className="space-y-4">
      <TimerFace v={v} sub={`Set ${v.phase?.round ?? p.sets} of ${p.sets} · ${p.holdSec}s`} />
      {!v.done && <TimerControls state={state} now={now} onChange={setTimer} onStart={() => fireCue("WORK", settings)} />}
      <div className="flex justify-center gap-3">
        {(log.holds ?? []).map((h, i) => (
          <Check key={i} checked={h.done} label={`Hold ${i + 1} done`} onChange={() => update((x) => toggleHold(x, idx, i))} />
        ))}
      </div>
    </div>
  );
}
