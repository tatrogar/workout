import { Button, Check, Stepper } from "../../components/ui";
import { newTimer, restPhases, start } from "../../timer/engine";
import { addSet, editSet, toggleSet } from "../../workout/session";
import type { ExerciseProps } from "./shared";

export function StrengthView({ w, idx, update, setTimer }: ExerciseProps) {
  const log = w.exercises[idx];
  if (log.planned.kind !== "strength") return null;
  const restSec = log.planned.restSec;
  const step = w.units === "kg" ? 2.5 : 5;
  const sets = log.sets ?? [];
  return (
    <div className="space-y-2">
      {restSec !== undefined && <p className="text-sm text-[var(--muted)]">Rest {restSec}s between sets — starts when you check a set.</p>}
      {sets.map((s, i) => (
        <div key={i} className={`flex items-center gap-2 rounded-xl p-2 ${s.done ? "bg-emerald-950/60" : "bg-slate-800/60"}`}>
          <Check checked={s.done} label={`Set ${i + 1} done`} onChange={() => {
            update((x) => toggleSet(x, idx, i, new Date()));
            if (!s.done && restSec) setTimer(start(newTimer(restPhases(restSec)), Date.now()));
          }} />
          <span className="w-5 text-sm text-[var(--muted)]">{i + 1}</span>
          {s.weight !== undefined
            ? <Stepper label={`Set ${i + 1} weight`} value={s.weight} step={step} onChange={(v) => update((x) => editSet(x, idx, i, { weight: v }))} />
            : <span className="w-[8.5rem] text-center text-[var(--muted)]">bodyweight</span>}
          <span className="text-[var(--muted)]">×</span>
          <Stepper label={`Set ${i + 1} reps`} value={s.reps} step={1} onChange={(v) => update((x) => editSet(x, idx, i, { reps: Math.round(v) }))} />
        </div>
      ))}
      <Button variant="ghost" className="w-full" onClick={() => update((x) => addSet(x, idx))}>+ Add set</Button>
    </div>
  );
}
