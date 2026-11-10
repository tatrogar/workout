import { useEffect, useRef } from "react";
import { Button, LinkButton } from "../components/ui";
import { formatDuration } from "../plan/tokens";
import { addSeconds, crossedCues, view, type TimerState } from "../timer/engine";
import { fireCue, unlockAudio } from "../timer/cues";
import { useNow, useWakeLock } from "../timer/useNow";
import { navigate } from "../router";
import { useData } from "../store/data";
import { useSettings } from "../store/settings";
import { describePlanned } from "../export/describe";
import { runningElsewhere, setCurrent, setNotes, setTimer, settleTimer, skipExercise } from "../workout/session";
import type { Workout as W } from "../workout/types";
import { CardioView, OtherView } from "./exercise/CardioView";
import { CircuitView } from "./exercise/CircuitView";
import { HoldView } from "./exercise/HoldView";
import { IntervalsView } from "./exercise/IntervalsView";
import type { ExerciseProps } from "./exercise/shared";
import { StrengthView } from "./exercise/StrengthView";

const VIEWS: Record<string, (p: ExerciseProps) => JSX.Element | null> = {
  strength: StrengthView, intervals: IntervalsView, hold: HoldView, circuit: CircuitView, cardio: CardioView, other: OtherView,
};

export function Workout() {
  const active = useData((s) => s.active);
  const updateActive = useData((s) => s.updateActive);
  const settings = useSettings();
  const now = useNow(!!active);
  const prev = useRef(now);
  useWakeLock(!!active);

  const entry = active?.timer;
  // Fire cues for whatever timer is live, then clear a finished rest timer.
  useEffect(() => {
    const before = prev.current;
    prev.current = now;
    if (!entry) return;
    for (const c of crossedCues(entry.state, before, now)) fireCue(c, settings);
    if (entry.state.phases[0]?.label === "REST_TIMER" && view(entry.state, now).done) {
      updateActive((w) => setTimer(w, undefined));
    }
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!active) {
    return (
      <div className="space-y-4 pt-10 text-center">
        <p className="text-lg">No workout in progress.</p>
        <LinkButton href="#/" variant="primary">Go to Start</LinkButton>
      </div>
    );
  }

  const idx = active.currentIndex ?? 0;
  const log = active.exercises[idx];
  const last = active.exercises.length - 1;
  const isRest = entry?.state.phases[0]?.label === "REST_TIMER";
  const exTimer = entry && entry.exerciseIndex === idx && !isRest ? entry.state : null;
  const update = (fn: (w: W) => W) => updateActive(fn);
  const putTimer = (state: TimerState | null) => {
    const other = state ? runningElsewhere(active, idx, Date.now()) : null;
    if (other && !window.confirm(`The ${other} timer is still running. Stop it and start this one?`)) return;
    updateActive((w) => setTimer(state && w.timer && w.timer.exerciseIndex !== idx ? settleTimer(w, Date.now()) : w, state ? { exerciseIndex: idx, state } : undefined));
  };
  const go = (i: number) => {
    // Leaving an exercise drops its unstarted/finished timer, but keeps a running rest timer.
    updateActive((w) => {
      let x = setCurrent(settleTimer(w, Date.now()), i);
      if (x.timer && x.timer.state.phases[0]?.label !== "REST_TIMER") {
        const v = view(x.timer.state, Date.now());
        if (v.done || x.timer.state.startedAt === null) x = setTimer(x, undefined);
      }
      return x;
    });
  };
  const View = VIEWS[log.planned.kind];
  const elapsed = Math.floor((now - Date.parse(active.startedAt)) / 1000);

  return (
    <div className="flex min-h-full flex-col gap-4 pb-28" onPointerDown={unlockAudio}>
      <header className="flex items-center justify-between text-sm text-[var(--muted)]">
        <a href="#/" className="min-h-touch py-3 pr-3">‹ Start</a>
        <span className="truncate px-2">{active.title} · {formatDuration(elapsed)}</span>
        <button className="min-h-touch py-3 pl-3 font-semibold text-sky-400" onClick={() => navigate("/finish")}>Finish</button>
      </header>

      <div>
        <div className="text-sm text-[var(--muted)]">Exercise {idx + 1} of {active.exercises.length}{log.status === "skipped" && log.skipped ? " · skipped" : ""}</div>
        <h1 className="text-3xl font-bold leading-tight">{log.planned.name}</h1>
        <div className="text-[var(--muted)]">{describePlanned(log.planned)}</div>
        {log.planned.note && <div className="mt-1 text-amber-300">{log.planned.note}</div>}
      </div>

      <View w={active} idx={idx} now={now} timer={exTimer} update={update} setTimer={putTimer} />

      <textarea className="min-h-[3rem] w-full rounded-xl bg-slate-800 p-3" placeholder="Notes for this exercise"
        value={log.notes ?? ""} onChange={(e) => update((w) => setNotes(w, idx, e.target.value))} />

      <div className="grid grid-cols-3 gap-2">
        <Button disabled={idx === 0} onClick={() => go(idx - 1)}>‹ Prev</Button>
        <Button variant="ghost" onClick={() => { update((w) => skipExercise(w, idx)); if (idx < last) go(idx + 1); }}>Skip exercise</Button>
        {idx < last
          ? <Button variant="primary" onClick={() => go(idx + 1)}>Next ›</Button>
          : <Button variant="primary" onClick={() => navigate("/finish")}>Finish</Button>}
      </div>

      {isRest && entry && <RestBar state={entry.state} now={now} onChange={(s) => updateActive((w) => setTimer(w, { ...entry, state: s }))} onSkip={() => updateActive((w) => setTimer(w, undefined))} />}
    </div>
  );
}

function RestBar({ state, now, onChange, onSkip }: { state: TimerState; now: number; onChange(s: TimerState): void; onSkip(): void }) {
  const v = view(state, now);
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-sky-800 bg-sky-950 px-4 pb-6 pt-3" data-testid="rest-timer">
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <div className="flex-1">
          <div className="text-sm font-semibold tracking-widest text-sky-300">REST</div>
          <div className="font-mono text-5xl font-bold tabular-nums">{formatDuration(Math.ceil(v.remainingSec))}</div>
        </div>
        <Button onClick={() => onChange(addSeconds(state, 15, now))}>+15s</Button>
        <Button variant="primary" onClick={onSkip}>Skip</Button>
      </div>
    </div>
  );
}
