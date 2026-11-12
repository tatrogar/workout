import { useState } from "react";
import { Button, Check, Stepper } from "../../components/ui";
import { plates } from "../../workout/plates";
import { newTimer, restPhases, start } from "../../timer/engine";
import { addSet, editSet, editSide, effectiveRest, toggleSet, toggleSide } from "../../workout/session";
import { useSettings } from "../../store/settings";
import type { ExerciseProps } from "./shared";

export function StrengthView({ w, idx, update, setTimer }: ExerciseProps) {
  const log = w.exercises[idx];
  const settings = useSettings();
  const [showPlates, setShowPlates] = useState(false);
  if (log.planned.kind !== "strength") return null;
  const restSec = effectiveRest(log.planned, settings);
  const isDefaultRest = restSec !== undefined && log.planned.restSec === undefined;
  const step = w.units === "kg" ? 2.5 : 5;
  const sets = log.sets ?? [];
  const weights = [...new Set(sets.map((s) => s.weight).filter((x): x is number => x !== undefined))];
  return (
    <div className="space-y-2">
      {log.planned.perSide
        ? <p className="text-sm text-[var(--muted)]">Each side: check Left and Right.{restSec !== undefined ? ` Rest ${restSec}s${isDefaultRest ? " (your default)" : ""} starts when both are checked.` : ""}</p>
        : restSec !== undefined && <p className="text-sm text-[var(--muted)]">Rest {restSec}s between sets{isDefaultRest ? " (your default)" : ""} — starts when you check a set.</p>}
      {sets.map((s, i) => s.sides ? (
        <div key={i} className={`space-y-2 rounded-xl p-2 ${s.done ? "bg-emerald-950/60" : "bg-slate-800/60"}`}>
          <div className="flex items-center gap-2">
            <span className="w-12 text-sm text-[var(--muted)]">Set {i + 1}</span>
            {s.weight !== undefined
              ? <Stepper label={`Set ${i + 1} weight`} value={s.weight} step={step} onChange={(v) => update((x) => editSet(x, idx, i, { weight: v }))} />
              : <span className="text-[var(--muted)]">bodyweight</span>}
          </div>
          {(["left", "right"] as const).map((side) => (
            <div key={side} className="flex items-center gap-2">
              <Check checked={s.sides![side].done} label={`Set ${i + 1} ${side} done`} onChange={() => {
                update((x) => toggleSide(x, idx, i, side, new Date()));
                const other = side === "left" ? "right" : "left";
                if (!s.sides![side].done && s.sides![other].done && restSec) setTimer(start(newTimer(restPhases(restSec)), Date.now()));
              }} />
              <span className="w-12 text-sm">{side === "left" ? "Left" : "Right"}</span>
              <Stepper label={`Set ${i + 1} ${side} reps`} value={s.sides![side].reps} step={1} onChange={(v) => update((x) => editSide(x, idx, i, side, v))} />
            </div>
          ))}
        </div>
      ) : (
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
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={() => update((x) => addSet(x, idx))}>+ Add set</Button>
        {settings.showPlates && weights.length > 0 && <Button variant="ghost" aria-expanded={showPlates} onClick={() => setShowPlates(!showPlates)}>Plates</Button>}
      </div>
      {showPlates && (
        <ul className="rounded-xl bg-slate-800/60 p-3 text-sm" data-testid="plates">
          {weights.map((wt) => {
            const p = plates(wt, w.units);
            return (
              <li key={wt}><span className="font-semibold">{wt} {w.units}:</span>{" "}
                {p === null ? "can't be loaded on a standard bar" : p.length === 0 ? "empty bar" : `${p.join(" + ")} per side`}</li>
            );
          })}
          <li className="mt-1 text-[var(--muted)]">Assumes a {w.units === "kg" ? "20 kg" : "45 lb"} bar.</li>
        </ul>
      )}
    </div>
  );
}
