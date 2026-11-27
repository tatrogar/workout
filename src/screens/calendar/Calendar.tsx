import { useEffect, useState } from "react";
import { Button, Title } from "../../components/ui";
import { addDays, dayStatus, loggedDates, mondayOf, monthGrid, shortTitle, todayIso } from "../../calendar/schedule";
import { useData } from "../../store/data";
import { DaySheet } from "./DaySheet";
import { fmtDate } from "./SchedulePaste";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const HEAD = ["M", "T", "W", "T", "F", "S", "S"];
const VIEW_KEY = "workout.calendarView";
export const PENDING_KEY = "workout.pendingSchedule";

const readView = (): "month" | "week" => { try { return localStorage.getItem(VIEW_KEY) === "week" ? "week" : "month"; } catch { return "month"; } };
const takePending = (): string | null => {
  try { const t = localStorage.getItem(PENDING_KEY); localStorage.removeItem(PENDING_KEY); return t; } catch { return null; }
};

export function Calendar() {
  const { scheduled, workouts, deleteScheduled } = useData();
  const today = todayIso();
  const [view, setViewRaw] = useState<"month" | "week">(readView);
  const [anchor, setAnchor] = useState(today);
  const [open, setOpen] = useState<{ date: string; text?: string } | null>(null);
  const setView = (v: "month" | "week") => { setViewRaw(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ } };

  // Arriving from Paste plan → "Put on calendar": open today with the plan already in the box.
  useEffect(() => { const t = takePending(); if (t) setOpen({ date: today, text: t }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const logged = loggedDates(workouts);
  const on = (d: string) => scheduled.filter((s) => s.date === d);
  const unscheduled = scheduled.filter((s) => s.date === null);
  const [y, m] = anchor.split("-").map(Number);
  const grid = monthGrid(y, m - 1);
  const weekStart = mondayOf(anchor);
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const step = (dir: number) => {
    if (view === "week") setAnchor(addDays(anchor, 7 * dir));
    else setAnchor(`${new Date(y, m - 1 + dir, 1).getFullYear()}-${String(new Date(y, m - 1 + dir, 1).getMonth() + 1).padStart(2, "0")}-01`);
  };

  return (
    <div className="space-y-3">
      <Title right={<a href="#/history" className="text-sky-400">History ›</a>}>Calendar</Title>
      <div className="flex items-center gap-2">
        <Button aria-label={view === "week" ? "Previous week" : "Previous month"} onClick={() => step(-1)}>‹</Button>
        <div className="flex-1 text-center text-lg font-semibold" data-testid="calendar-heading">
          {view === "month" ? `${MONTHS[m - 1]} ${y}` : `Week of ${fmtDate(weekStart)}`}
        </div>
        <Button aria-label={view === "week" ? "Next week" : "Next month"} onClick={() => step(1)}>›</Button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button variant={view === "month" ? "primary" : "secondary"} aria-pressed={view === "month"} onClick={() => setView("month")}>Month</Button>
        <Button variant={view === "week" ? "primary" : "secondary"} aria-pressed={view === "week"} onClick={() => setView("week")}>Week</Button>
        <Button onClick={() => setAnchor(today)}>Today</Button>
      </div>

      {view === "month" ? (
        <div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-[var(--muted)]">{HEAD.map((h, i) => <div key={i}>{h}</div>)}</div>
          <div className="mt-1 grid grid-cols-7 gap-1" role="grid" aria-label="Month">
            {grid.flat().map((d) => {
              const items = on(d);
              const inMonth = Number(d.slice(5, 7)) === m;
              return (
                <button key={d} onClick={() => setOpen({ date: d })} aria-label={`${fmtDate(d)}${items.length ? `: ${items.map((s) => s.title).join(", ")}` : ""}${logged.has(d) ? ", done" : ""}`}
                  className={`flex min-h-[4.25rem] flex-col items-stretch overflow-hidden rounded-lg p-1 text-left ${inMonth ? "bg-[var(--surface)]" : "bg-slate-800/50 opacity-60"} ${d === today ? "ring-2 ring-sky-500" : ""}`}>
                  <span className="flex items-center justify-between text-xs">
                    <span className={d === today ? "font-bold text-sky-300" : ""}>{Number(d.slice(8))}</span>
                    {logged.has(d) && <span className="text-emerald-400" aria-hidden>✓</span>}
                  </span>
                  {items.slice(0, 2).map((s) => {
                    const st = dayStatus(s, workouts, today);
                    return (
                      <span key={s.id} className={`truncate rounded px-0.5 text-[10px] leading-tight ${st === "done" ? "bg-emerald-900/70" : st === "missed" ? "bg-rose-900/60 line-through" : "bg-sky-900/70"}`}>
                        {shortTitle(s.title, 9)}
                      </span>
                    );
                  })}
                  {items.length > 2 && <span className="text-[10px] text-[var(--muted)]">+{items.length - 2}</span>}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">✓ done · blue planned · red struck-through missed. Tap a day to add or open a workout.</p>
        </div>
      ) : (
        <ul className="space-y-2" aria-label="Week">
          {week.map((d) => {
            const items = on(d);
            return (
              <li key={d}>
                <button onClick={() => setOpen({ date: d })} aria-label={fmtDate(d)}
                  className={`w-full rounded-xl bg-[var(--surface)] px-4 py-3 text-left ${d === today ? "ring-2 ring-sky-500" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{fmtDate(d)}{d === today ? " · today" : ""}</span>
                    {logged.has(d) && <span className="text-emerald-400">✓ done</span>}
                  </div>
                  {items.length === 0 && <div className="text-sm text-[var(--muted)]">Nothing scheduled</div>}
                  {items.map((s) => {
                    const st = dayStatus(s, workouts, today);
                    return <div key={s.id} className={`text-sm ${st === "missed" ? "text-rose-300 line-through" : st === "done" ? "text-emerald-300" : ""}`}>{s.title}{st === "missed" ? " (missed)" : ""}</div>;
                  })}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {unscheduled.length > 0 && (
        <section className="rounded-2xl border border-[var(--line)] p-3">
          <h2 className="mb-1 font-semibold">Unscheduled</h2>
          <p className="mb-2 text-sm text-[var(--muted)]">From your old Up next list. Give each one a date or delete it.</p>
          <ul className="space-y-2" data-testid="unscheduled">
            {unscheduled.map((s) => <Unscheduled key={s.id} id={s.id} title={s.title} onDelete={() => { if (window.confirm(`Delete "${s.title}"?`)) deleteScheduled(s.id); }} />)}
          </ul>
        </section>
      )}

      {open && <DaySheet key={open.date} date={open.date} initialText={open.text} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Unscheduled({ id, title, onDelete }: { id: string; title: string; onDelete(): void }) {
  const moveScheduled = useData((s) => s.moveScheduled);
  const [date, setDate] = useState(todayIso());
  return (
    <li className="space-y-2 rounded-xl bg-[var(--surface)] p-3">
      <div className="font-semibold">{title}</div>
      <div className="flex items-center gap-2">
        <input type="date" className="min-h-touch flex-1 rounded-xl bg-slate-800 px-3" aria-label={`Date for ${title}`} value={date} onChange={(e) => setDate(e.target.value)} />
        <Button variant="primary" disabled={!date} onClick={() => moveScheduled(id, date)}>Schedule</Button>
        <Button variant="ghost" aria-label={`Delete ${title}`} onClick={onDelete}>✕</Button>
      </div>
    </li>
  );
}
