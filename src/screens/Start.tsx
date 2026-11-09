import { Card, LinkButton, Title } from "../components/ui";
import { exportDue, useData } from "../store/data";
import { workoutMinutes } from "../export/markdown";
import { localDate } from "../workout/session";

export function Start() {
  const { active, workouts, lastExportAt } = useData();
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
          <p className="text-sm text-[var(--muted)]">In progress</p>
          <p className="mb-3 text-xl font-semibold">{active.title}</p>
          <LinkButton href="#/workout" variant="primary">Resume</LinkButton>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-2">
        <LinkButton href="#/paste" variant={active ? "secondary" : "primary"}>Paste plan</LinkButton>
        <LinkButton href="#/templates">Templates</LinkButton>
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
