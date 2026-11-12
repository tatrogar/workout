import { Button, Card, LinkButton, Title } from "../components/ui";
import { useSettings } from "../store/settings";
import { startFromText } from "./Paste";
import { exportDue, useData } from "../store/data";
import { workoutMinutes } from "../export/markdown";
import { localDate } from "../workout/session";
import { formatDuration } from "../plan/tokens";
import { useNow } from "../timer/useNow";

export function Start() {
  const { active, workouts, lastExportAt, upNext, removeUpNext } = useData();
  const units = useSettings((s) => s.units);
  const now = useNow(!!active && !active.pending);
  const due = exportDue({ workouts, lastExportAt }, new Date());
  const recent = workouts.filter((w) => w.finishedAt).slice(0, 3);
  return (
    <div className="space-y-4">
      <Title>Workout</Title>
      {due && (
        <Card className="border-amber-700 bg-amber-950/50">
          <p className="mb-3">Your workouts only live on this phone. {lastExportAt ? "It's been two weeks since your last export." : "You haven't exported yet."}</p>
          <LinkButton href="#/settings" variant="secondary">Export now</LinkButton>
        </Card>
      )}
      {active && (
        <Card className="border-sky-700">
          <p className="text-sm text-[var(--muted)]">{active.pending ? "Ready to start" : `In progress · ${formatDuration(Math.max(0, Math.floor((now - Date.parse(active.startedAt)) / 1000)))}`}</p>
          <p className="mb-3 text-xl font-semibold">{active.title}</p>
          <LinkButton href="#/workout" variant="primary">{active.pending ? "Open" : "Resume"}</LinkButton>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-2">
        <LinkButton href="#/paste" variant={active ? "secondary" : "primary"}>Paste plan</LinkButton>
        <LinkButton href="#/templates">Templates</LinkButton>
        <LinkButton href="#/timer" className="col-span-2">Quick timer</LinkButton>
      </div>
      {upNext.length > 0 && (
        <section>
          <h2 className="mb-2 mt-6 text-lg font-semibold">Up next</h2>
          <ul className="space-y-2" data-testid="up-next">
            {upNext.map((u, i) => (
              <li key={u.id} className="flex items-center gap-2 rounded-xl bg-[var(--surface)] p-2 pl-4">
                <span className="flex-1">{u.title}</span>
                <Button variant={i === 0 && !active ? "primary" : "secondary"} aria-label={`Start ${u.title}`} onClick={() => { if (startFromText(u.planText, units)) removeUpNext(u.id); }}>Start</Button>
                <Button variant="ghost" aria-label={`Remove ${u.title}`} onClick={() => { if (window.confirm(`Remove "${u.title}" from Up next?`)) removeUpNext(u.id); }}>✕</Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h2 className="mb-2 mt-6 text-lg font-semibold">Recent</h2>
        {recent.length === 0 && <p className="text-[var(--muted)]">No workouts yet. In Settings, copy the plan instructions and give them to Claude, then paste its plan here.</p>}
        <ul className="space-y-2">
          {recent.map((w) => (
            <li key={w.id}>
              <a href={`#/history/${w.id}`} className="flex min-h-touch items-center justify-between rounded-xl bg-[var(--surface)] px-4 py-3">
                <span>{w.title}</span>
                <span className="text-sm text-[var(--muted)]">{localDate(new Date(w.startedAt))} · {workoutMinutes(w)} min</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
