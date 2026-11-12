import { useEffect, useRef } from "react";
import { Check } from "../../components/ui";
import { completedPhases, holdPhases, newTimer, sideResults, view, withReady } from "../../timer/engine";
import { fireCue } from "../../timer/cues";
import { sideOptions, useSettings } from "../../store/settings";
import { recordSides, setHoldsDone, toggleHold } from "../../workout/session";
import type { ExerciseProps } from "./shared";
import { TimerControls } from "./TimerControls";
import { TimerFace } from "./TimerFace";

export function HoldView({ w, idx, now, timer, update, setTimer }: ExerciseProps) {
  const log = w.exercises[idx];
  const p = log.planned;
  const settings = useSettings();
  const perSide = p.kind === "hold" && !!p.perSide;
  const phases = p.kind === "hold" ? holdPhases(p.sets, p.holdSec, p.restSec, perSide, sideOptions(settings)) : [];
  const state = timer ?? (p.kind === "hold" ? newTimer(settings.readyOn && settings.readySec > 0 ? withReady(phases, settings.readySec) : phases) : null);
  const done = state ? (perSide ? sideResults(state, now).length : completedPhases(state, now, "HOLD")) : 0;
  // Only what the timer finishes while this screen is open is written, so an untick survives leaving and coming back.
  const applied = useRef(done);
  useEffect(() => {
    if (state?.startedAt != null && done > applied.current) {
      if (perSide) update((x) => recordSides(x, idx, sideResults(state, Date.now())));
      else update((x) => setHoldsDone(x, idx, done));
    }
    applied.current = done;
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  if (p.kind !== "hold" || !state) return null;
  const v = view(state, now);
  const sideNote = v.phase?.side ? ` · ${v.phase.side === "L" ? "left" : "right"}` : "";
  return (
    <div className="space-y-4">
      <TimerFace v={v} sub={`Set ${v.phase?.round ?? p.sets} of ${p.sets} · ${p.holdSec}s${perSide ? " each side" : ""}${sideNote}`} />
      {!v.done && <TimerControls state={state} now={now} onChange={setTimer} onStart={() => fireCue(settings.readyOn && settings.readySec > 0 ? "WARN" : "WORK", settings)}
        doneLabel={v.phase?.label === "SWITCH" ? "Start next side" : "Skip"} />}
      <div className="flex flex-wrap justify-center gap-3">
        {(log.holds ?? []).map((h, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <Check checked={h.done} label={`Hold ${i + 1} done`} onChange={() => update((x) => toggleHold(x, idx, i))} />
            {perSide && <span className="text-xs text-[var(--muted)]" data-testid={`hold-${i + 1}-sides`}>L {h.sides?.left ?? "–"} · R {h.sides?.right ?? "–"}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
