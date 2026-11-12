import { useState } from "react";
import { Button } from "../components/ui";
import { describePlanned } from "../export/describe";
import { parsePlan, type ParseError } from "../plan/parse";
import { insertExercises, moveExercise, removeExercise, replaceExercise, setCurrent } from "../workout/session";
import type { Workout } from "../workout/types";

const MARK: Record<string, string> = { done: "✓", partial: "◐", skipped: "" };

/** The whole workout at a glance: jump to an exercise, reorder, remove, add or swap one. */
export function PlanSheet({ w, update, onClose }: { w: Workout; update(fn: (w: Workout) => Workout): void; onClose(): void }) {
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<ParseError[]>([]);
  const cur = w.currentIndex ?? 0;

  const parsed = () => {
    const r = parsePlan(text, w.units);
    if (!r.ok) { setErrors(r.errors); return null; }
    if (r.plan.units !== w.units) { setErrors([{ line: 1, text: "", message: `this workout uses ${w.units}; write the weights in ${w.units}` }]); return null; }
    return r.plan.exercises;
  };
  const add = () => { const ex = parsed(); if (ex) { update((x) => insertExercises(x, cur + 1, ex, Date.now())); setText(""); } };
  const swap = () => {
    const ex = parsed();
    if (!ex) return;
    if (ex.length !== 1) { setErrors([{ line: 1, text: "", message: "to replace the current exercise, write exactly one exercise" }]); return; }
    update((x) => replaceExercise(x, cur, ex[0], Date.now()));
    setText("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-[var(--bg)] px-4 pb-10 pt-4" role="dialog" aria-label="Exercise list">
      <div className="mx-auto max-w-xl space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Exercises</h2>
          <Button onClick={onClose}>Close</Button>
        </div>
        <ol className="space-y-2">
          {w.exercises.map((l, i) => (
            <li key={i} className={`flex items-center gap-1 rounded-xl p-1 ${i === cur ? "bg-sky-950 ring-1 ring-sky-700" : "bg-[var(--surface)]"}`}>
              <button className="min-h-touch flex-1 px-2 py-1 text-left" aria-label={`Go to ${l.planned.name}`} onClick={() => { update((x) => setCurrent(x, i)); onClose(); }}>
                <span className="block font-semibold">{MARK[l.status] && <span className="mr-1 text-emerald-400">{MARK[l.status]}</span>}{l.planned.name}{l.skipped ? " (skipped)" : ""}</span>
                <span className="block text-sm text-[var(--muted)]">{describePlanned(l.planned)}</span>
              </button>
              <button className="h-11 w-9 rounded-lg bg-slate-700 disabled:opacity-30" aria-label={`Move ${l.planned.name} up`} disabled={i === 0} onClick={() => update((x) => moveExercise(x, i, -1, Date.now()))}>↑</button>
              <button className="h-11 w-9 rounded-lg bg-slate-700 disabled:opacity-30" aria-label={`Move ${l.planned.name} down`} disabled={i === w.exercises.length - 1} onClick={() => update((x) => moveExercise(x, i, 1, Date.now()))}>↓</button>
              <button className="h-11 w-9 rounded-lg bg-slate-700 text-rose-300 disabled:opacity-30" aria-label={`Remove ${l.planned.name}`} disabled={w.exercises.length <= 1}
                onClick={() => { if (l.status === "skipped" || window.confirm(`Remove ${l.planned.name}? What you logged for it will be lost.`)) update((x) => removeExercise(x, i, Date.now())); }}>✕</button>
            </li>
          ))}
        </ol>

        <div className="space-y-2 rounded-2xl border border-[var(--line)] p-3">
          <h3 className="font-semibold">Add or swap</h3>
          <p className="text-sm text-[var(--muted)]">Same format as a plan. Adding puts it right after the current exercise.</p>
          <textarea className="h-28 w-full rounded-xl bg-slate-800 p-3 font-mono text-sm" aria-label="New exercise" placeholder={"## Leg press\nstrength: 3x10 @ 200 lb, rest 90s"}
            value={text} onChange={(e) => { setText(e.target.value); setErrors([]); }} />
          {errors.length > 0 && (
            <ul className="space-y-1 text-sm text-rose-300">{errors.map((e, i) => <li key={i}>{e.text ? `Line ${e.line}: ` : ""}{e.message}</li>)}</ul>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={!text.trim()} onClick={swap}>Replace current</Button>
            <Button variant="primary" disabled={!text.trim()} onClick={add}>Add after current</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
