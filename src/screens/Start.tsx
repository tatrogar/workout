import { Button, Card, LinkButton, Title } from "../components/ui";
import { useSettings } from "../store/settings";
import { startFromText } from "./Paste";
import { dayStatus, todayIso } from "../calendar/schedule";
import { exportDue, useData } from "../store/data";
import { workoutMinutes } from "../export/markdown";
import { localDate } from "../workout/session";
import { formatDuration } from "../plan/tokens";
import { useNow } from "../timer/useNow";

export function Start() {
  const { active, workouts, lastExportAt, scheduled } = useData();
  const today = todayIso();
  const todays = scheduled.filter((s) => s.date === today);
  const units = useSettings((s) => s.units);
  const now = useNow(!!active && !active.pending);
  const due = exportDue({ workouts, lastExportAt }, new Date());
  const recent = workouts.filter((w) => w.finishedAt).slice(0, 3);
  return (
    <div className="space-y-4">
      <Title>Workout</Title>
      {todays.length > 0 && (
        <section className="space-y-2" data-testid="today">
          {todays.map((s) => {
            const st = dayStatus(s, workouts, today);
            const isActive = active?.scheduledId === s.id;
            return (
              <Card key={s.id} className={st === "done" ? "border-emerald-700" : "border-sky-600"}>
                <p className="text-sm text-[var(--muted)]">Today</p>
                <p className="mb-3 text-xl font-semibold">{st === "done" ? "✓ " : ""}{s.title}</p>
                {st === "done"
                  ? <p className="text-sm text-emerald-300">Done.</p>
                  : isActive
                    ? <LinkButton href="#/workout" variant="primary">Resume</LinkButton>
                    : <Button variant="primary" className="w-full" aria-label={`Start ${s.title}`} onClick={() => startFromText(s.planText, units, s.id)}>Start</Button>}
              </Card>
            );
          })}
        </section>
      )}
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
        <LinkButton href="#/calendar">Calendar</LinkButton>
        <LinkButton href="#/timer">Quick timer</LinkButton>
      </div>
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
