import { useRef, useState } from "react";
import { Button, Card, Title, Toggle } from "../components/ui";
import { exportFileName, toMarkdown } from "../export/markdown";
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

  const doExport = async () => {
    const now = new Date();
    const text = toMarkdown(data.workouts, data.aliases, settings.units, now);
    const r = await shareOrDownload(exportFileName(now), text);
    if (r !== "cancelled") { data.markExported(now); data.clearStorageError(); setMsg(r === "shared" ? "Shared." : "Saved to Downloads."); }
  };

  const doImport = async (file: File) => {
    const r = parseExport(await file.text());
    if (!r.ok) { setMsg(r.message); return; }
    const before = data.workouts.length;
    const merged = mergeWorkouts(data.workouts, r.workouts);
    data.replaceWorkouts(merged, { ...r.aliases, ...data.aliases });
    setMsg(`Imported. ${merged.length - before} new workout${merged.length - before === 1 ? "" : "s"}, ${merged.length} total.`);
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
        <Button variant="primary" className="w-full" onClick={() => void doExport()}>Export log</Button>
        <Button variant="ghost" className="mt-2 w-full" onClick={() => fileRef.current?.click()}>Import a backup…</Button>
        <input ref={fileRef} type="file" accept=".md,text/markdown,text/plain" className="hidden" data-testid="import-file"
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
        <h2 className="mb-1 font-semibold">Timer cues</h2>
        <Toggle label="Chime" checked={settings.sound} onChange={(v) => settings.set({ sound: v })} />
        <Toggle label="Vibrate" checked={settings.vibration} onChange={(v) => settings.set({ vibration: v })} />
        <Toggle label="Flash the screen" hint="One short color pulse per cue" checked={settings.flash} onChange={(v) => settings.set({ flash: v })} />
        <Button className="mt-2 w-full" onClick={() => { unlockAudio(); fireCue("WORK", settings); }}>Test cue</Button>
      </Card>
    </div>
  );
}
