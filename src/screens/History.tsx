import { useState } from "react";
import { Button, Card, Stepper, Title } from "../components/ui";
import { Sparkline } from "../charts/Sparkline";
import { describeDone, describePlanned } from "../export/describe";
import { copyForClaude, workoutMinutes } from "../export/markdown";
import { navigate } from "../router";
import { useData } from "../store/data";
import { useSettings } from "../store/settings";
import { exerciseSeries, normalizeName, primaryValue } from "../trends/series";
import { exerciseStatus, localDate, setCardio, setNotes, setRoundsDone } from "../workout/session";
import type { Workout } from "../workout/types";
import { StrengthView } from "./exercise/StrengthView";

export function History() {
  const workouts = useData((s) => s.workouts).filter((w) => w.finishedAt);
  return (
    <div className="space-y-2">
      <Title>History</Title>
      {workouts.length === 0 && <p className="text-[var(--muted)]">Finished workouts show up here.</p>}
      <ul className="space-y-2">
        {workouts.map((w) => {
          const done = w.exercises.filter((e) => e.status === "done").length;
          return (
            <li key={w.id}>
              <a href={`#/history/${w.id}`} className="block rounded-xl bg-[var(--surface)] px-4 py-3">
                <div className="flex justify-between gap-2"><span className="font-semibold">{w.title}</span><span className="text-sm text-[var(--muted)]">{workoutMinutes(w)} min</span></div>
                <div className="text-sm text-[var(--muted)]">{localDate(new Date(w.startedAt))} · ✓ {done}/{w.exercises.length}</div>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function WorkoutDetail({ id }: { id: string }) {
  const { workouts, aliases, upsertWorkout, deleteWorkout, reopenWorkout, active } = useData();
  const [copied, setCopied] = useState(false);
  const units = useSettings((s) => s.units);
  const found = workouts.find((w) => w.id === id);
  const [draft, setDraft] = useState<Workout | null>(null);
  if (!found) return <p className="pt-10 text-center">Workout not found. <a className="text-sky-400" href="#/history">History</a></p>;
  const w = draft ?? found;
  const editing = draft !== null;
  const update = (fn: (x: Workout) => Workout) => setDraft(fn(w));

  return (
    <div className="space-y-4">
      <Title right={<a href="#/history" className="text-sky-400">‹ History</a>}>{editing ? "Edit" : w.title}</Title>
      <p className="text-[var(--muted)]">{localDate(new Date(w.startedAt))} · {workoutMinutes(w)} min{w.units !== units ? ` · weights in ${w.units}` : ""}</p>
      {editing && (
        <input className="min-h-touch w-full rounded-xl bg-slate-800 px-3 text-lg" value={w.title} aria-label="Title"
          onChange={(e) => setDraft({ ...w, title: e.target.value })} />
      )}
      {editing
        ? <textarea className="min-h-[4rem] w-full rounded-xl bg-slate-800 p-3" placeholder="Workout notes" value={w.notes ?? ""} onChange={(e) => setDraft({ ...w, notes: e.target.value || undefined })} />
        : w.notes && <Card><p>{w.notes}</p></Card>}

      {w.exercises.map((log, i) => {
        const key = normalizeName(log.planned.name, aliases);
        const spark = exerciseSeries(workouts, key, aliases, units).points.map((p) => primaryValue(p.values));
        return (
          <Card key={i}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <a href={`#/trends/${encodeURIComponent(key)}`} className="text-lg font-semibold">{log.planned.name}</a>
                <div className="text-sm text-[var(--muted)]">planned {describePlanned(log.planned)}</div>
              </div>
              <Sparkline values={spark} label={`${log.planned.name} trend`} />
            </div>
            {!editing && <p className={`mt-2 ${log.status === "skipped" ? "text-[var(--muted)]" : ""}`}>{describeDone(log)}</p>}
            {!editing && log.effort !== undefined && <p className="mt-1 text-sm text-[var(--muted)]">Effort {log.effort}/10</p>}
            {!editing && log.notes && <p className="mt-1 text-sm text-amber-200">“{log.notes}”</p>}
            {editing && <EditExercise w={w} idx={i} update={update} />}
          </Card>
        );
      })}

      {editing ? (
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => setDraft(null)}>Cancel</Button>
          <Button variant="primary" onClick={() => { upsertWorkout(w); setDraft(null); }}>Save changes</Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="primary" className="col-span-2" onClick={async () => {
            try { await navigator.clipboard.writeText(copyForClaude(found)); setCopied(true); } catch { /* no permission */ }
          }}>{copied ? "Copied ✓ — paste it into Claude" : "Copy for Claude"}</Button>
          <Button className="col-span-2" disabled={!!active} onClick={() => { if (reopenWorkout(found.id, new Date())) navigate("/workout"); }}>
            {active ? "Finish the workout in progress to continue this one" : "Continue this workout"}
          </Button>
          <Button onClick={() => setDraft(found)}>Edit</Button>
          <Button variant="danger" onClick={() => { if (window.confirm("Delete this workout for good?")) { deleteWorkout(w.id); navigate("/history"); } }}>Delete</Button>
        </div>
      )}
    </div>
  );
}

function EditExercise({ w, idx, update }: { w: Workout; idx: number; update(fn: (x: Workout) => Workout): void }) {
  const log = w.exercises[idx];
  const p = log.planned;
  return (
    <div className="mt-3 space-y-2">
      {p.kind === "strength" && <StrengthView w={w} idx={idx} now={0} timer={null} update={update} setTimer={() => {}} />}
      {(p.kind === "intervals" || p.kind === "circuit") && (
        <label className="flex items-center gap-2">Rounds done
          <Stepper label="Rounds done" value={log.roundsDone ?? 0} step={1} suffix={`/ ${p.rounds}`} onChange={(n) => update((x) => setRoundsDone(x, idx, Math.round(n)))} />
        </label>
      )}
      {p.kind === "hold" && (
        <label className="flex items-center gap-2">Sets held
          <Stepper label="Sets held" value={log.holds?.filter((h) => h.done).length ?? 0} step={1} suffix={`/ ${p.sets}`}
            onChange={(n) => update((x) => ({ ...x, exercises: x.exercises.map((e, j) => {
              if (j !== idx) return e;
              const next = { ...e, skipped: undefined, holds: e.holds?.map((h, k) => ({ ...h, done: k < n })) };
              return { ...next, status: exerciseStatus(next) };
            }) }))} />
        </label>
      )}
      {(p.kind === "cardio" || p.kind === "other") && (
        <label className="flex items-center gap-2">Minutes
          <Stepper label="Minutes" value={Math.round(((log.durationSec ?? 0) / 60) * 10) / 10} step={1} onChange={(m) => update((x) => setCardio(x, idx, { durationSec: Math.round(m * 60) }))} />
        </label>
      )}
      {p.kind === "cardio" && (
        <label className="flex items-center gap-2">Distance
          <Stepper label="Distance" value={log.distance} step={0.1} suffix={p.distanceUnit ?? "mi"} onChange={(d) => update((x) => setCardio(x, idx, { distance: d }))} />
        </label>
      )}
      <textarea className="w-full rounded-xl bg-slate-800 p-2 text-sm" placeholder="Note" value={log.notes ?? ""} onChange={(e) => update((x) => setNotes(x, idx, e.target.value))} />
    </div>
  );
}
