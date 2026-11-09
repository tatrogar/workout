import { Button, Check, Stepper } from "../../components/ui";
import { formatDuration } from "../../plan/tokens";
import { elapsedMs, newTimer, pause, resume, start } from "../../timer/engine";
import { unlockAudio } from "../../timer/cues";
import { setCardio } from "../../workout/session";
import type { ExerciseProps } from "./shared";

const STOPWATCH = [{ label: "WORK" as const, sec: 24 * 3600, round: 1 }];

export function CardioView({ w, idx, now, timer, update, setTimer }: ExerciseProps) {
  const log = w.exercises[idx];
  const p = log.planned;
  if (p.kind !== "cardio") return null;
  const running = timer && timer.startedAt !== null && timer.pausedAt === null;
  const secs = timer ? Math.floor(elapsedMs(timer, now) / 1000) : log.durationSec ?? 0;
  const unit = p.distanceUnit ?? "mi";
  return (
    <div className="space-y-4">
      <p className="text-center text-[var(--muted)]">Planned {Math.round(p.durationSec / 60)} min{p.distance ? `, ${p.distance} ${unit}` : ""}</p>
      <div className="text-center font-mono font-bold tabular-nums" style={{ fontSize: "min(22vw, 7rem)" }} data-testid="timer">{formatDuration(secs)}</div>
      <div className="grid grid-cols-2 gap-2">
        {!timer && <Button variant="primary" className="col-span-2 text-xl" onClick={() => { unlockAudio(); setTimer(start(newTimer(STOPWATCH), Date.now() - (log.durationSec ?? 0) * 1000)); }}>{log.durationSec ? "Continue" : "Start stopwatch"}</Button>}
        {timer && <Button onClick={() => setTimer(running ? pause(timer, now) : resume(timer, Date.now()))}>{running ? "Pause" : "Resume"}</Button>}
        {timer && <Button variant="primary" onClick={() => { update((x) => setCardio(x, idx, { durationSec: secs })); setTimer(null); }}>Stop & save</Button>}
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

export function OtherView({ w, idx, update }: ExerciseProps) {
  const log = w.exercises[idx];
  const p = log.planned;
  if (p.kind !== "other") return null;
  const done = (log.durationSec ?? 0) > 0;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-4 py-4">
        <Check checked={done} label="Done" onChange={() => update((x) => setCardio(x, idx, { durationSec: done ? 0 : p.durationSec }))} />
        <span className="text-2xl">{Math.round(p.durationSec / 60)} min</span>
      </div>
      <label className="flex items-center justify-center gap-2">Actual minutes
        <Stepper label="Actual minutes" value={Math.round(((log.durationSec ?? 0) / 60) * 10) / 10} step={1} onChange={(m) => update((x) => setCardio(x, idx, { durationSec: Math.round(m * 60) }))} />
      </label>
    </div>
  );
}
