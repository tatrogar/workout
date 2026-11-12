import { Button, Check, Stepper } from "../../components/ui";
import { formatDuration } from "../../plan/tokens";
import { countdownPhases, elapsedMs, newTimer, pause, resume, start, view } from "../../timer/engine";
import { unlockAudio } from "../../timer/cues";
import { setCardio } from "../../workout/session";
import type { ExerciseProps } from "./shared";
import { TimerControls } from "./TimerControls";
import { TimerFace } from "./TimerFace";

/** Counts down from the planned time, then keeps counting up (+1:23) so a longer session logs its real length. */
export function CardioView({ w, idx, now, timer, update, setTimer }: ExerciseProps) {
  const log = w.exercises[idx];
  const p = log.planned;
  if (p.kind !== "cardio") return null;
  const running = timer && timer.startedAt !== null && timer.pausedAt === null;
  const elapsed = timer ? Math.floor(elapsedMs(timer, now) / 1000) : 0;
  const v = timer ? view(timer, now) : null;
  const unit = p.distanceUnit ?? "mi";
  const face = !timer ? formatDuration(p.durationSec) : v && !v.done ? formatDuration(Math.ceil(v.remainingSec)) : `+${formatDuration(elapsed - p.durationSec)}`;
  return (
    <div className="space-y-4">
      <p className="text-center text-[var(--muted)]">
        Planned {Math.round(p.durationSec / 60)} min{p.distance ? `, ${p.distance} ${unit}` : ""}
        {timer && v?.done ? " · past the planned time, still counting" : ""}
      </p>
      <div className={`text-center font-mono font-bold tabular-nums ${v?.done ? "text-emerald-400" : ""}`} style={{ fontSize: "min(22vw, 7rem)" }} data-testid="timer">{face}</div>
      <div className="grid grid-cols-2 gap-2">
        {!timer && (
          <Button variant="primary" className="col-span-2 text-xl" onClick={() => { unlockAudio(); setTimer(start(newTimer(countdownPhases(p.durationSec)), Date.now() - (log.durationSec ?? 0) * 1000)); }}>
            {log.durationSec ? "Continue" : "Start countdown"}
          </Button>
        )}
        {timer && <Button onClick={() => setTimer(running ? pause(timer, Date.now()) : resume(timer, Date.now()))}>{running ? "Pause" : "Resume"}</Button>}
        {timer && <Button variant="primary" onClick={() => { update((x) => setCardio(x, idx, { durationSec: elapsed })); setTimer(null); }}>Stop & save</Button>}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <label className="flex items-center gap-2">Minutes
          <Stepper label="Minutes" value={Math.round(((log.durationSec ?? 0) / 60) * 10) / 10} step={1} onChange={(m) => update((x) => setCardio(x, idx, { durationSec: Math.round(m * 60) }))} />
        </label>
        <label className="flex items-center gap-2">Distance
          <Stepper label="Distance" value={log.distance} step={0.1} suffix={unit} onChange={(d) => update((x) => setCardio(x, idx, { distance: d }))} />
        </label>
      </div>
    </div>
  );
}

/** Warm-ups, mobility, cooldowns: a countdown that checks the exercise off at zero. */
export function OtherView({ w, idx, now, timer, update, setTimer }: ExerciseProps) {
  const log = w.exercises[idx];
  const p = log.planned;
  if (p.kind !== "other") return null;
  const done = (log.durationSec ?? 0) >= p.durationSec;
  const state = timer ?? newTimer(countdownPhases(p.durationSec));
  const v = view(state, now);
  return (
    <div className="space-y-4">
      {done && !timer
        ? <div className="py-6 text-center text-4xl font-bold text-emerald-400">Done</div>
        : <TimerFace v={v} label="" />}
      {!(done && !timer) && <TimerControls state={state} now={now} onChange={setTimer} doneLabel="Done ✓" />}
      <div className="flex items-center justify-center gap-4">
        <Check checked={done} label="Done" onChange={() => { setTimer(null); update((x) => setCardio(x, idx, { durationSec: done ? 0 : p.durationSec })); }} />
        <label className="flex items-center gap-2">Minutes
          <Stepper label="Actual minutes" value={Math.round(((log.durationSec ?? 0) / 60) * 10) / 10} step={1} onChange={(m) => update((x) => setCardio(x, idx, { durationSec: Math.round(m * 60) }))} />
        </label>
      </div>
    </div>
  );
}
