import { addSeconds, pause, resume, skip, start, type TimerState } from "../../timer/engine";
import { unlockAudio } from "../../timer/cues";
import { Button } from "../../components/ui";

export function TimerControls({ state, now, onChange, onStart, doneLabel, waiting = false }: {
  state: TimerState; now: number; onChange(s: TimerState): void; onStart?(): void; doneLabel?: string; waiting?: boolean;
}) {
  const running = state.startedAt !== null && state.pausedAt === null;
  return (
    <div className="grid grid-cols-3 gap-2">
      {state.startedAt === null ? (
        <Button variant="primary" className="col-span-3 text-xl" onClick={() => { unlockAudio(); onChange(start(state, Date.now())); onStart?.(); }}>Start</Button>
      ) : (
        <>
          <Button onClick={() => { unlockAudio(); onChange(running ? pause(state, now) : resume(state, Date.now())); }}>{running ? "Pause" : "Resume"}</Button>
          <Button disabled={waiting} onClick={() => onChange(addSeconds(state, 15, now))}>+15s</Button>
          <Button onClick={() => onChange(skip(state, now))}>{doneLabel ?? "Skip"}</Button>
        </>
      )}
    </div>
  );
}
