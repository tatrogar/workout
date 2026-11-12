import { useRef, useState } from "react";
import { Button, Card, Stepper, Title, Toggle } from "../components/ui";
import { exportFileName, recentWorkouts, toMarkdown } from "../export/markdown";
import { mergeWorkouts, parseExport } from "../export/importFile";
import { shareOrDownload } from "../export/share";
import { CLAUDE_INSTRUCTIONS } from "../plan/instructions";
import { useData } from "../store/data";
import { useSettings } from "../store/settings";
import { fireCue, unlockAudio } from "../timer/cues";

export function Settings() {
  const settings = useSettings();
  const data = useData();
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const count = data.workouts.filter((w) => w.finishedAt).length;

  const doExport = async (recentOnly: boolean) => {
    const now = new Date();
    const ws = recentOnly ? recentWorkouts(data.workouts, now, 28) : data.workouts;
    const text = toMarkdown(ws, data.aliases, settings.units, now);
    const r = await shareOrDownload(exportFileName(now), text);
    if (r === "cancelled") return;
    // Only a full export counts as a backup.
    if (!recentOnly) { data.markExported(now); data.clearStorageError(); }
    setMsg(r === "shared" ? "Shared." : "Saved to Downloads.");
  };

  const doImport = async (file: File) => {
    const r = parseExport(await file.text());
    if (!r.ok) { setMsg(r.message); return; }
    const before = data.workouts.length;
    const merged = mergeWorkouts(data.workouts, r.workouts);
    data.replaceWorkouts(merged, { ...r.aliases, ...data.aliases });
    const bad = r.skipped ? ` ${r.skipped} damaged workout${r.skipped === 1 ? " was" : "s were"} left out.` : "";
    setMsg(`Imported. ${merged.length - before} new workout${merged.length - before === 1 ? "" : "s"}, ${merged.length} total.${bad}`);
  };

  return (
    <div className="space-y-4">
      <Title>Settings</Title>
      {msg && <div role="status" className="rounded-xl bg-slate-700 px-4 py-3">{msg}</div>}

      <Card>
        <h2 className="mb-1 font-semibold">Your log</h2>
        <p className="mb-3 text-sm text-[var(--muted)]">
          {count} workout{count === 1 ? "" : "s"} on this phone. {data.lastExportAt ? `Last export ${new Date(data.lastExportAt).toLocaleDateString()}.` : "Never exported."} The file is what you give Claude for feedback — and your only backup.
        </p>
        <Button variant="primary" className="w-full" onClick={() => void doExport(true)}>Export last 4 weeks (for Claude)</Button>
        <Button className="mt-2 w-full" onClick={() => void doExport(false)}>Export everything (backup)</Button>
        <Button variant="ghost" className="mt-2 w-full" onClick={() => fileRef.current?.click()}>Import a backup…</Button>
        <input ref={fileRef} type="file" className="hidden" data-testid="import-file"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f); e.target.value = ""; }} />
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Planning with Claude</h2>
        <p className="mb-3 text-sm text-[var(--muted)]">Copy these instructions into a Claude chat (or a Claude Project) once. Then ask for a workout and paste the plan it writes.</p>
        <Button className="w-full" onClick={async () => {
          try { await navigator.clipboard.writeText(CLAUDE_INSTRUCTIONS); setMsg("Copied plan instructions."); }
          catch { setMsg("Couldn't copy — long-press the text below instead."); }
        }}>Copy plan instructions for Claude</Button>
        <details className="mt-2 text-sm"><summary className="min-h-touch cursor-pointer py-3 text-[var(--muted)]">Show instructions</summary>
          <pre className="whitespace-pre-wrap rounded-lg bg-slate-900 p-3 text-xs">{CLAUDE_INSTRUCTIONS}</pre>
        </details>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Units</h2>
        <div className="grid grid-cols-2 gap-2">
          {(["lb", "kg"] as const).map((u) => (
            <Button key={u} variant={settings.units === u ? "primary" : "secondary"} onClick={() => settings.set({ units: u })}>{u === "lb" ? "Pounds (lb)" : "Kilograms (kg)"}</Button>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Timers</h2>
        <Toggle label="Default rest after a set" hint="Used when the plan gives no rest for a strength exercise" checked={settings.defaultRestOn} onChange={(v) => settings.set({ defaultRestOn: v })} />
        {settings.defaultRestOn && <TimeRow label="Default rest" value={settings.defaultRestSec} step={15} min={15} onChange={(v) => settings.set({ defaultRestSec: v })} />}
        <Toggle label="Get-ready countdown" hint="Before intervals and holds start" checked={settings.readyOn} onChange={(v) => settings.set({ readyOn: v })} />
        {settings.readyOn && <TimeRow label="Get ready" value={settings.readySec} step={1} min={3} onChange={(v) => settings.set({ readySec: v })} />}
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Timer cues</h2>
        <Toggle label="Chime" checked={settings.sound} onChange={(v) => settings.set({ sound: v })} />
        <Toggle label="Vibrate" checked={settings.vibration} onChange={(v) => settings.set({ vibration: v })} />
        <Toggle label="Flash the screen" hint="One short color pulse per cue" checked={settings.flash} onChange={(v) => settings.set({ flash: v })} />
        <Toggle label="Spoken cues" hint={'Says "Rest", "Go", "Done"'} checked={settings.voice} onChange={(v) => settings.set({ voice: v })} />
        {settings.voice && <Toggle label="Say rounds and move names" hint={'"Round 3", "Plank, 45 seconds"'} checked={settings.voiceDetail} onChange={(v) => settings.set({ voiceDetail: v })} />}
        <Button className="mt-2 w-full" onClick={() => { unlockAudio(); fireCue("WORK", settings, undefined, settings.voiceDetail ? "Round 1" : "Go"); }}>Test cue</Button>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Workout screen</h2>
        <Toggle label="Effort rating" hint="The 1–10 row under each exercise" checked={settings.showEffort} onChange={(v) => settings.set({ showEffort: v })} />
        <Toggle label="Last time" hint="What you did the previous session" checked={settings.showLastTime} onChange={(v) => settings.set({ showLastTime: v })} />
        <Toggle label="Plates button" hint="Plates per side for barbell weights" checked={settings.showPlates} onChange={(v) => settings.set({ showPlates: v })} />
        <Toggle label="New bests on Finish" checked={settings.showBests} onChange={(v) => settings.set({ showBests: v })} />
      </Card>
    </div>
  );
}

function TimeRow({ label, value, step, min, onChange }: { label: string; value: number; step: number; min: number; onChange(v: number): void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1 pl-4">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <Stepper label={`${label} seconds`} value={value} step={step} suffix="sec" onChange={(v) => onChange(Math.max(min, Math.round(v)))} />
    </div>
  );
}
