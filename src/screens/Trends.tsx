import { useState } from "react";
import { BarChart } from "../charts/BarChart";
import { LineChart } from "../charts/LineChart";
import { Sparkline } from "../charts/Sparkline";
import { fmtDay } from "../charts/scale";
import { Button, Card, Title } from "../components/ui";
import { describeDone } from "../export/describe";
import { useData } from "../store/data";
import { useSettings } from "../store/settings";
import { localDate } from "../workout/session";
import { exerciseNames, exerciseSeries, normalizeName, primaryValue, weeklySeries, type SeriesPoint } from "../trends/series";

export function Trends() {
  const { workouts, aliases, removeAlias } = useData();
  const units = useSettings((s) => s.units);
  const [metric, setMetric] = useState<"workouts" | "minutes">("workouts");
  const weeks = weeklySeries(workouts, new Date());
  const names = exerciseNames(workouts, aliases);
  const aliasList = Object.entries(aliases);
  return (
    <div className="space-y-4">
      <Title>Trends</Title>
      <Card>
        <div className="mb-2 flex gap-2" role="tablist">
          {(["workouts", "minutes"] as const).map((m) => (
            <button key={m} role="tab" aria-selected={metric === m} onClick={() => setMetric(m)}
              className={`min-h-touch flex-1 rounded-lg text-sm font-semibold ${metric === m ? "bg-slate-600" : "bg-slate-800 text-[var(--muted)]"}`}>
              {m === "workouts" ? "Workouts / week" : "Minutes / week"}
            </button>
          ))}
        </div>
        <BarChart label={metric === "workouts" ? "Workouts per week, last 12 weeks" : "Minutes per week, last 12 weeks"}
          unit={metric === "minutes" ? "min" : undefined}
          bars={weeks.map((wk) => ({ label: fmtDay(wk.weekStart), title: `Week of ${fmtDay(wk.weekStart)}`, value: wk[metric] }))} />
      </Card>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Exercises</h2>
        {names.length === 0 && <p className="text-[var(--muted)]">Finish a workout to see trends.</p>}
        <ul className="space-y-2">
          {names.map((n) => {
            const pts = exerciseSeries(workouts, n.key, aliases, units).points;
            return (
              <li key={n.key}>
                <a href={`#/trends/${encodeURIComponent(n.key)}`} className="flex min-h-touch items-center justify-between gap-3 rounded-xl bg-[var(--surface)] px-4 py-2">
                  <span><span className="block">{n.display}</span><span className="text-xs text-[var(--muted)]">{n.sessions} session{n.sessions === 1 ? "" : "s"}</span></span>
                  <Sparkline values={pts.map((p) => primaryValue(p.values))} label={`${n.display} trend`} />
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      {aliasList.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Merged names</h2>
          <ul className="space-y-2">
            {aliasList.map(([from, to]) => (
              <li key={from} className="flex items-center justify-between rounded-xl bg-[var(--surface)] px-4 py-2">
                <span className="text-sm">“{from}” → “{to}”</span>
                <Button variant="ghost" onClick={() => removeAlias(from)}>Undo</Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function ExerciseTrend({ name }: { name: string }) {
  const { workouts, aliases, setAlias } = useData();
  const units = useSettings((s) => s.units);
  const key = normalizeName(name, aliases);
  const { kind, points } = exerciseSeries(workouts, key, aliases, units);
  const names = exerciseNames(workouts, aliases);
  const me = names.find((n) => n.key === key);
  const others = names.filter((n) => n.key !== key);
  const [target, setTarget] = useState("");
  const line = (k: string): { x: string; y: number }[] => points.filter((p) => p.values[k] !== undefined).map((p) => ({ x: p.date, y: p.values[k] }));

  const sessions = workouts.filter((w) => w.finishedAt && points.some((p: SeriesPoint) => p.workoutId === w.id));

  return (
    <div className="space-y-4">
      <Title right={<a href="#/trends" className="text-sky-400">‹ Trends</a>}>{me?.display ?? name}</Title>
      {kind === null && <p className="text-[var(--muted)]">No finished sessions for this exercise.</p>}
      {kind === "strength" && line("topWeight").length > 0 && (
        <>
          <Card><LineChart label="Heaviest set" unit={units} points={line("topWeight")} /></Card>
          <Card><LineChart label="Volume (weight × reps)" unit={units} points={line("volume")} zeroBased /></Card>
        </>
      )}
      {kind === "strength" && line("topWeight").length === 0 && <Card><LineChart label="Total reps" points={line("reps")} zeroBased /></Card>}
      {(kind === "intervals" || kind === "circuit") && <Card><LineChart label="Rounds completed" points={line("done")} reference={{ label: "planned", points: line("planned") }} zeroBased /></Card>}
      {kind === "hold" && <Card><LineChart label="Sets completed" points={line("done")} reference={{ label: "planned", points: line("planned") }} zeroBased /></Card>}
      {kind === "cardio" && (
        <>
          {line("distance").length > 0 && <Card><LineChart label="Distance" points={line("distance")} zeroBased /></Card>}
          {line("paceMinPer").length > 0 && <Card><LineChart label="Pace (min per distance unit, lower is faster)" unit="min" points={line("paceMinPer")} /></Card>}
          <Card><LineChart label="Minutes" unit="min" points={line("minutes")} zeroBased /></Card>
        </>
      )}
      {kind === "other" && <Card><LineChart label="Minutes" unit="min" points={line("minutes")} zeroBased /></Card>}

      {sessions.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Sessions</h2>
          <ul className="space-y-2">
            {sessions.map((w) => {
              const log = w.exercises.find((l) => l.status !== "skipped" && normalizeName(l.planned.name, aliases) === key)!;
              return (
                <li key={w.id}>
                  <a href={`#/history/${w.id}`} className="block rounded-xl bg-[var(--surface)] px-4 py-2">
                    <div className="text-sm text-[var(--muted)]">{fmtDay(localDate(new Date(w.startedAt)))} · {w.title}</div>
                    <div>{describeDone(log)}</div>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {others.length > 0 && (
        <Card>
          <h2 className="mb-1 font-semibold">Same exercise, different name?</h2>
          <p className="mb-3 text-sm text-[var(--muted)]">Merge this into another name so both share one graph. Workouts aren't changed and you can undo it on Trends.</p>
          <div className="flex gap-2">
            <select className="min-h-touch flex-1 rounded-xl bg-slate-800 px-2" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Merge into">
              <option value="">Merge into…</option>
              {others.map((o) => <option key={o.key} value={o.key}>{o.display}</option>)}
            </select>
            <Button variant="primary" disabled={!target} onClick={() => { setAlias(key, target); window.location.hash = `#/trends/${encodeURIComponent(target)}`; }}>Merge</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
