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
import { runningElsewhere, setCurrent, setEffort, setNotes, setTimer, settleTimer, skipExercise, startSession, tickCountdown } from "../workout/session";
import { lastTime } from "../trends/history";
import { fmtDay } from "../charts/scale";
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
  const workouts = useData((s) => s.workouts);
  const aliases = useData((s) => s.aliases);
  const settings = useSettings();
  const now = useNow(!!active);
  const prev = useRef(now);
  useWakeLock(!!active);

  const entry = active?.timer;
  // Fire cues for whatever timer is live, then clear a finished rest timer.
  useEffect(() => {
    const before = prev.current;
    prev.current = now;
    if (!entry || !active) return;
    for (const c of crossedCues(entry.state, before, now)) fireCue(c, settings);
    if (tickCountdown(active, now) !== active) updateActive((w) => tickCountdown(w, now));
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

  if (active.pending) {
    return (
      <div className="flex min-h-full flex-col gap-4">
        <a href="#/" className="min-h-touch py-3 text-sm text-[var(--muted)]">‹ Start</a>
        <h1 className="text-3xl font-bold leading-tight">{active.title}</h1>
        <ol className="space-y-1">
          {active.exercises.map((l, i) => (
            <li key={i} className="flex justify-between gap-3 rounded-lg bg-[var(--surface)] px-3 py-2">
              <span>{l.planned.name}</span><span className="text-right text-sm text-[var(--muted)]">{describePlanned(l.planned)}</span>
            </li>
          ))}
        </ol>
        <p className="text-center text-[var(--muted)]">The session clock starts when you tap the button.</p>
        <Button variant="primary" className="min-h-[5rem] text-2xl" onClick={() => { unlockAudio(); updateActive((w) => startSession(w, new Date())); }}>Start session</Button>
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
  const elapsed = Math.max(0, Math.floor((now - Date.parse(active.startedAt)) / 1000));
  const prior = lastTime(workouts, log.planned.name, aliases);

  return (
    <div className="flex min-h-full flex-col gap-4 pb-28" onPointerDown={unlockAudio}>
      <header className="sticky top-0 z-20 -mx-4 flex items-center justify-between border-b border-[var(--line)] bg-[var(--bg)] px-4 text-sm text-[var(--muted)]">
        <a href="#/" className="min-h-touch py-3 pr-3">‹ Start</a>
        <span className="flex flex-col items-center leading-tight">
          <span className="font-mono text-2xl font-bold tabular-nums text-[var(--text)]" data-testid="session-clock" aria-label="Session time">{formatDuration(elapsed)}</span>
          <span className="max-w-[10rem] truncate text-xs">{active.title}</span>
        </span>
        <button className="min-h-touch py-3 pl-3 font-semibold text-sky-400" onClick={() => navigate("/finish")}>Finish</button>
      </header>

      <div>
        <div className="text-sm text-[var(--muted)]">Exercise {idx + 1} of {active.exercises.length}{log.status === "skipped" && log.skipped ? " · skipped" : ""}</div>
        <h1 className="text-3xl font-bold leading-tight">{log.planned.name}</h1>
        <div className="text-[var(--muted)]">{describePlanned(log.planned)}</div>
        {log.planned.note && <div className="mt-1 text-amber-300">{log.planned.note}</div>}
        {prior && <div className="mt-1 text-sm text-[var(--muted)]" data-testid="last-time">Last time ({fmtDay(prior.date)}): {prior.text}</div>}
      </div>

      <View w={active} idx={idx} now={now} timer={exTimer} update={update} setTimer={putTimer} />

      <textarea className="min-h-[3rem] w-full rounded-xl bg-slate-800 p-3" placeholder="Notes for this exercise"
        value={log.notes ?? ""} onChange={(e) => update((w) => setNotes(w, idx, e.target.value))} />

      <div>
        <div className="mb-1 text-sm text-[var(--muted)]">Effort, 1 easy to 10 all-out (optional)</div>
        <div className="grid grid-cols-10 gap-1" role="radiogroup" aria-label="Effort">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={log.effort === n} aria-label={`Effort ${n}`}
              onClick={() => update((w) => setEffort(w, idx, log.effort === n ? undefined : n))}
              className={`h-11 rounded-lg text-sm font-semibold ${log.effort === n ? "bg-sky-600 text-white" : "bg-slate-800 text-[var(--muted)]"}`}>{n}</button>
          ))}
        </div>
      </div>

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
