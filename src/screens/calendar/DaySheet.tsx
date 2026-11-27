import { useState } from "react";
import { Button } from "../../components/ui";
import { dayStatus, todayIso, type Scheduled } from "../../calendar/schedule";
import { parsePlan, type ParseError } from "../../plan/parse";
import { useData } from "../../store/data";
import { useSettings } from "../../store/settings";
import { localDate } from "../../workout/session";
import { workoutMinutes } from "../../export/markdown";
import { startFromText } from "../Paste";
import { SchedulePaste, fmtDate } from "./SchedulePaste";

const STATUS: Record<string, string> = { done: "✓ done", missed: "missed", planned: "planned" };
const STATUS_CLASS: Record<string, string> = { done: "text-emerald-400", missed: "text-rose-300", planned: "text-[var(--muted)]" };

/** Everything on one date: what was done, what's scheduled, and a paste box to add more. */
export function DaySheet({ date, onClose, initialText }: { date: string; onClose(): void; initialText?: string }) {
  const { scheduled, workouts } = useData();
  const items = scheduled.filter((s) => s.date === date);
  const logs = workouts.filter((w) => w.finishedAt && localDate(new Date(w.startedAt)) === date);
  const [adding, setAdding] = useState(items.length === 0 || !!initialText);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-[var(--bg)] px-4 pb-10 pt-4" role="dialog" aria-label={fmtDate(date)}>
      <div className="mx-auto max-w-xl space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">{fmtDate(date)}{date === todayIso() ? " · today" : ""}</h2>
          <Button onClick={onClose}>Close</Button>
        </div>

        {logs.length > 0 && (
          <ul className="space-y-2">
            {logs.map((w) => (
              <li key={w.id}>
                <a href={`#/history/${w.id}`} className="block rounded-xl bg-emerald-950/60 px-4 py-3">✓ {w.title} <span className="text-sm text-[var(--muted)]">· {workoutMinutes(w)} min</span></a>
              </li>
            ))}
          </ul>
        )}

        {items.map((s) => (
          <ItemCard key={s.id} item={s} open={openId === s.id} onToggle={() => setOpenId(openId === s.id ? null : s.id)} />
        ))}

        {adding
          ? <SchedulePaste start={date} initialText={initialText} onDone={() => { setAdding(false); if (items.length === 0 && !initialText) onClose(); }} onCancel={items.length || logs.length ? () => setAdding(false) : onClose} />
          : <Button className="w-full" onClick={() => setAdding(true)}>+ Paste a workout onto this day</Button>}
      </div>
    </div>
  );
}

function ItemCard({ item, open, onToggle }: { item: Scheduled; open: boolean; onToggle(): void }) {
  const { workouts, active, moveScheduled, copyScheduled, deleteScheduled, editScheduled } = useData();
  const units = useSettings((s) => s.units);
  const status = dayStatus(item, workouts, todayIso());
  const [mode, setMode] = useState<"none" | "edit" | "move" | "copy">("none");
  const [date, setDate] = useState(item.date ?? todayIso());
  const [text, setText] = useState(item.planText);
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const isActive = active?.scheduledId === item.id;
  const parsed = parsePlan(item.planText, units);

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)]" data-testid="scheduled-item">
      <button className="flex min-h-touch w-full items-center justify-between px-4 py-3 text-left" aria-expanded={open} onClick={onToggle} aria-label={`Open ${item.title}`}>
        <span className="font-semibold">{item.title}</span>
        <span className={`text-sm ${STATUS_CLASS[status]}`}>{STATUS[status]}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-[var(--line)] p-3">
          {parsed.ok && <p className="text-sm text-[var(--muted)]">{parsed.plan.exercises.map((e) => e.name).join(" · ")}</p>}
          {msg && <p role="status" className="text-sm text-emerald-300">{msg}</p>}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" className="col-span-2" onClick={() => { if (isActive) { window.location.hash = "#/workout"; return; } startFromText(item.planText, units, item.id); }}>
              {isActive ? "Resume" : status === "done" ? "Do it again" : "Start"}
            </Button>
            <Button onClick={() => setMode(mode === "edit" ? "none" : "edit")}>Edit</Button>
            <Button onClick={() => setMode(mode === "move" ? "none" : "move")}>Move to…</Button>
            <Button onClick={() => setMode(mode === "copy" ? "none" : "copy")}>Copy to…</Button>
            <Button variant="danger" onClick={() => { if (window.confirm(`Delete "${item.title}" from ${item.date ? fmtDate(item.date) : "the calendar"}?`)) deleteScheduled(item.id); }}>Delete</Button>
          </div>
          {(mode === "move" || mode === "copy") && (
            <div className="flex items-center gap-2">
              <input type="date" className="min-h-touch flex-1 rounded-xl bg-slate-800 px-3" aria-label={mode === "move" ? "Move to date" : "Copy to date"} value={date} onChange={(e) => setDate(e.target.value)} />
              <Button variant="primary" disabled={!date} onClick={() => {
                if (mode === "move") moveScheduled(item.id, date);
                else { copyScheduled(item.id, date); setMsg(`Copied to ${fmtDate(date)}.`); }
                setMode("none");
              }}>{mode === "move" ? "Move" : "Copy"}</Button>
            </div>
          )}
          {mode === "edit" && (
            <div className="space-y-2">
              <textarea className="h-48 w-full rounded-xl bg-slate-800 p-3 font-mono text-sm" aria-label="Edit plan" value={text} onChange={(e) => { setText(e.target.value); setErrors([]); }} />
              {errors.length > 0 && <ul className="space-y-1 text-sm text-rose-300">{errors.map((e, i) => <li key={i}>Line {e.line}: {e.message}</li>)}</ul>}
              <Button variant="primary" className="w-full" onClick={() => {
                const r = parsePlan(text, units);
                if (!r.ok) { setErrors(r.errors); return; }
                editScheduled(item.id, text, r.plan.title ?? item.title);
                setMode("none");
              }}>Save changes</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
