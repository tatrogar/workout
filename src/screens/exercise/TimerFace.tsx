import { formatDuration } from "../../plan/tokens";
import type { TimerView } from "../../timer/engine";

const COLORS: Record<string, string> = {
  WORK: "text-emerald-400", HOLD: "text-emerald-400", MOVE: "text-emerald-400",
  REST: "text-sky-400", REST_TIMER: "text-sky-400",
};
const LABELS: Record<string, string> = { WORK: "WORK", HOLD: "HOLD", MOVE: "GO", REST: "REST", REST_TIMER: "REST" };

export function TimerFace({ v, sub }: { v: TimerView; sub?: string }) {
  if (v.done) return <div className="py-6 text-center text-4xl font-bold text-emerald-400">Done</div>;
  const label = v.phase ? LABELS[v.phase.label] : "";
  return (
    <div className="py-2 text-center" aria-live="polite">
      <div className={`text-2xl font-bold tracking-widest ${v.phase ? COLORS[v.phase.label] : ""}`}>{label}</div>
      <div className="font-mono font-bold tabular-nums leading-none" style={{ fontSize: "min(30vw, 9rem)" }} data-testid="timer">
        {v.waiting ? "—" : formatDuration(Math.ceil(v.remainingSec))}
      </div>
      {sub && <div className="mt-1 text-lg text-[var(--muted)]">{sub}</div>}
    </div>
  );
}
