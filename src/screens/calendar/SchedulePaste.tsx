import { useState } from "react";
import { Button, Card } from "../../components/ui";
import { addDays, placePlans, weekdayIndex, type Scheduled } from "../../calendar/schedule";
import { looksLikePlan, parsePlan, splitPlans, type ParseError } from "../../plan/parse";
import { useData } from "../../store/data";
import { useSettings } from "../../store/settings";
import { planNames } from "../../videos/library";
import { newId } from "../../workout/session";

const DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function fmtDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
  return `${DAY[weekdayIndex(iso)]} ${month} ${d}`;
}

type Placed = { title: string; planText: string; date: string };

/** Paste box → check with the normal parser → preview of dates → confirm. */
export function SchedulePaste({ start, initialText = "", onDone, onCancel }: { start: string; initialText?: string; onDone(dates: string[]): void; onCancel?(): void }) {
  const units = useSettings((s) => s.units);
  const { scheduled, schedule, addKnownNames } = useData();
  const [text, setText] = useState(initialText);
  const [errors, setErrors] = useState<{ workout: number; total: number; errors: ParseError[] }[] | null>(null);
  const [prose, setProse] = useState(false);
  const [placed, setPlaced] = useState<Placed[] | null>(null);
  const [choice, setChoice] = useState<Record<string, "replace" | "add">>({});

  const check = () => {
    const parts = splitPlans(text);
    const results = parts.map((p) => ({ p, r: parsePlan(p, units) }));
    const bad = results.map((x, i) => ({ workout: i + 1, total: parts.length, errors: x.r.ok ? [] : x.r.errors })).filter((x) => x.errors.length);
    setProse(bad.length > 0 && !looksLikePlan(text));
    if (bad.length) { setErrors(bad); setPlaced(null); return; }
    setErrors(null);
    const ok = results.map((x, i) => ({ title: (x.r.ok && x.r.plan.title) || `Workout ${i + 1}`, planText: x.p }));
    setPlaced(placePlans(ok, start));
    setChoice({});
    addKnownNames(results.flatMap((x) => (x.r.ok ? planNames(x.r.plan) : [])));
  };

  const taken = (date: string) => scheduled.filter((s) => s.date === date);
  const conflictDates = placed ? [...new Set(placed.map((p) => p.date).filter((d) => taken(d).length > 0))] : [];
  const ready = conflictDates.every((d) => choice[d]);

  const save = () => {
    if (!placed) return;
    const items: Scheduled[] = placed.map((p) => ({ id: newId(), date: p.date, title: p.title, planText: p.planText }));
    schedule(items, conflictDates.filter((d) => choice[d] === "replace"));
    onDone([...new Set(placed.map((p) => p.date))]);
  };

  return (
    <div className="space-y-3">
      {!placed && (
        <>
          <textarea className="h-48 w-full rounded-xl bg-slate-800 p-3 font-mono text-sm" aria-label="Plan to schedule"
            placeholder={"Paste a plan (or a whole week).\n\n# Mon · Upper\n## Warm-up\nother: 5 min"} value={text}
            onChange={(e) => { setText(e.target.value); setErrors(null); }} />
          <div className="grid grid-cols-2 gap-2">
            {onCancel ? <Button onClick={onCancel}>Cancel</Button> : <span />}
            <Button variant="primary" disabled={!text.trim()} onClick={check}>Check plan</Button>
          </div>
        </>
      )}

      {errors && prose && (
        <Card className="border-rose-700">
          <h3 className="mb-1 font-semibold text-rose-300">This isn't in the workout-app format</h3>
          <p className="text-sm">It reads like a normal message. Ask Claude to rewrite it in the app format, in a code block, then paste that.</p>
        </Card>
      )}
      {errors && !prose && (
        <Card className="border-rose-700">
          <ul className="space-y-2 text-sm" data-testid="schedule-errors">
            {errors.map((w) => w.errors.map((e, i) => (
              <li key={`${w.workout}-${i}`}>
                {w.total > 1 && <span className="font-semibold">Workout {w.workout}, </span>}
                <span className="font-semibold">Line {e.line}:</span> <code className="text-amber-200">{e.text || "(empty)"}</code><br />{e.message}
              </li>
            )))}
          </ul>
        </Card>
      )}

      {placed && (
        <Card>
          <h3 className="mb-2 text-lg font-semibold">{placed.length === 1 ? "Schedule this workout?" : `Schedule ${placed.length} workouts?`}</h3>
          <ul className="mb-3 space-y-2" data-testid="schedule-preview">
            {placed.map((p, i) => (
              <li key={i} className="rounded-lg bg-slate-800/60 px-3 py-2">
                <span className="font-semibold">{fmtDate(p.date)}</span> — {p.title}
              </li>
            ))}
          </ul>
          {conflictDates.map((d) => (
            <div key={d} className="mb-3 rounded-lg border border-amber-700 p-3" role="radiogroup" aria-label={`${fmtDate(d)} already has a workout`}>
              <p className="mb-2 text-sm">{fmtDate(d)} already has {taken(d).map((s) => `"${s.title}"`).join(" and ")}.</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant={choice[d] === "replace" ? "primary" : "secondary"} role="radio" aria-checked={choice[d] === "replace"} onClick={() => setChoice({ ...choice, [d]: "replace" })}>Replace it</Button>
                <Button variant={choice[d] === "add" ? "primary" : "secondary"} role="radio" aria-checked={choice[d] === "add"} onClick={() => setChoice({ ...choice, [d]: "add" })}>Add a second</Button>
              </div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => { setPlaced(null); onCancel?.(); }}>Cancel</Button>
            <Button variant="primary" disabled={!ready} onClick={save}>{ready ? "Save to calendar" : "Choose above first"}</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

export { addDays };
