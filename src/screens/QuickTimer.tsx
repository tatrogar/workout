import { useEffect, useRef, useState } from "react";
import { Button, Card, Stepper, Title } from "../components/ui";
import { countdownPhases, crossedCues, intervalPhases, newTimer, view, withReady, type TimerState } from "../timer/engine";
import { fireCue } from "../timer/cues";
import { cuePhrase } from "../timer/phrases";
import { useNow, useWakeLock } from "../timer/useNow";
import { useSettings } from "../store/settings";
import { TimerControls } from "./exercise/TimerControls";
import { TimerFace } from "./exercise/TimerFace";

/** A timer with no plan and no log: intervals or a single countdown. */
export function QuickTimer() {
  const settings = useSettings();
  const [mode, setMode] = useState<"intervals" | "countdown">("intervals");
  const [rounds, setRounds] = useState(8);
  const [work, setWork] = useState(20);
  const [rest, setRest] = useState(10);
  const [minutes, setMinutes] = useState(5);
  const [state, setState] = useState<TimerState | null>(null);
  const live = state !== null && state.startedAt !== null;
  const now = useNow(live);
  const prev = useRef(now);
  useWakeLock(live);

  const ready = (p: ReturnType<typeof intervalPhases>) => (settings.readyOn && settings.readySec > 0 ? withReady(p, settings.readySec) : p);
  const fresh = (): TimerState => newTimer(mode === "intervals" ? ready(intervalPhases(Math.max(1, rounds), Math.max(1, work), Math.max(0, rest))) : countdownPhases(Math.max(1, Math.round(minutes * 60))));
  const shown = state ?? fresh();
  const v = view(shown, now);

  useEffect(() => {
    const before = prev.current;
    prev.current = now;
    if (!state) return;
    const ex = mode === "intervals" ? { kind: "intervals" as const, name: "Timer", rounds, workSec: work, restSec: rest } : undefined;
    for (const c of crossedCues(state, before, now)) fireCue(c, settings, undefined, cuePhrase(c, view(state, now).phase, ex, settings.voiceDetail));
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <Title right={<a href="#/" className="text-sky-400">‹ Start</a>}>Quick timer</Title>
      {!live && (
        <Card>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Button variant={mode === "intervals" ? "primary" : "secondary"} onClick={() => { setMode("intervals"); setState(null); }}>Intervals</Button>
            <Button variant={mode === "countdown" ? "primary" : "secondary"} onClick={() => { setMode("countdown"); setState(null); }}>Countdown</Button>
          </div>
          {mode === "intervals" ? (
            <div className="space-y-2">
              <Row label="Rounds"><Stepper label="Rounds" value={rounds} step={1} onChange={(n) => setRounds(Math.max(1, Math.round(n)))} /></Row>
              <Row label="Work"><Stepper label="Work seconds" value={work} step={5} suffix="sec" onChange={(n) => setWork(Math.max(1, Math.round(n)))} /></Row>
              <Row label="Rest"><Stepper label="Rest seconds" value={rest} step={5} suffix="sec" onChange={(n) => setRest(Math.max(0, Math.round(n)))} /></Row>
            </div>
          ) : (
            <Row label="Time"><Stepper label="Minutes" value={minutes} step={1} suffix="min" onChange={(n) => setMinutes(Math.max(0.1, n))} /></Row>
          )}
          <p className="mt-3 text-sm text-[var(--muted)]">Nothing here is saved to your log.</p>
        </Card>
      )}
      <TimerFace v={v} label={mode === "countdown" ? "" : undefined} sub={mode === "intervals" && v.phase ? `Round ${v.phase.round} of ${rounds}` : undefined} />
      {v.done
        ? <Button variant="primary" className="w-full" onClick={() => setState(null)}>Reset</Button>
        : <TimerControls state={shown} now={now} onChange={setState} onStart={() => fireCue(mode === "intervals" && settings.readyOn && settings.readySec > 0 ? "WARN" : "WORK", settings)} />}
      {live && !v.done && <Button variant="ghost" className="w-full" onClick={() => setState(null)}>Stop and reset</Button>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4"><span>{label}</span>{children}</div>;
}
