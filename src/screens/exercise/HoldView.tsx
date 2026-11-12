import { useEffect, useRef } from "react";
import { Check } from "../../components/ui";
import { completedPhases, holdPhases, newTimer, view, withReady } from "../../timer/engine";
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
  const state = timer ?? (p.kind === "hold" ? newTimer(settings.readyOn && settings.readySec > 0 ? withReady(holdPhases(p.sets, p.holdSec, p.restSec), settings.readySec) : holdPhases(p.sets, p.holdSec, p.restSec)) : null);
  const done = state ? completedPhases(state, now, "HOLD") : 0;
  // Only holds the timer finishes while this screen is open get ticked, so an untick survives leaving and coming back.
  const applied = useRef(done);
  useEffect(() => {
    if (state?.startedAt != null && done > applied.current) update((x) => setHoldsDone(x, idx, done));
    applied.current = done;
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  if (p.kind !== "hold" || !state) return null;
  const v = view(state, now);
  return (
    <div className="space-y-4">
      <TimerFace v={v} sub={`Set ${v.phase?.round ?? p.sets} of ${p.sets} · ${p.holdSec}s`} />
      {!v.done && <TimerControls state={state} now={now} onChange={setTimer} onStart={() => fireCue(settings.readyOn && settings.readySec > 0 ? "WARN" : "WORK", settings)} />}
      <div className="flex justify-center gap-3">
        {(log.holds ?? []).map((h, i) => (
          <Check key={i} checked={h.done} label={`Hold ${i + 1} done`} onChange={() => update((x) => toggleHold(x, idx, i))} />
        ))}
      </div>
    </div>
  );
}
