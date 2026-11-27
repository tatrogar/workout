import { useMemo, useState } from "react";
import { Button, Card, Title } from "../components/ui";
import { VideoButton } from "../components/VideoButton";
import { useData } from "../store/data";
import { allExerciseNames } from "../videos/library";
import { parseYouTube } from "../videos/youtube";

const fmtStart = (s?: number) => (s ? ` · starts at ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "");

export function Exercises() {
  const data = useData();
  const [q, setQ] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const names = useMemo(() => allExerciseNames(data, data.aliases), [data.workouts, data.active, data.templates, data.upNext, data.videos, data.aliases, data.knownNames]); // eslint-disable-line react-hooks/exhaustive-deps
  const hidden = new Set(data.hiddenExercises);
  const visible = names.filter((n) => !hidden.has(n.key));
  const hiddenNames = data.hiddenExercises.map((k) => names.find((n) => n.key === k) ?? { key: k, display: k.charAt(0).toUpperCase() + k.slice(1) })
    .sort((a, b) => a.display.localeCompare(b.display, undefined, { sensitivity: "base" }));
  const shown = visible.filter((n) => n.display.toLowerCase().includes(q.trim().toLowerCase()));
  const withVideo = visible.filter((n) => data.videos[n.key]).length;
  const remove = (n: { key: string; display: string }) => {
    if (data.videos[n.key] && !window.confirm(`Remove ${n.display} from the list? Its video link will be deleted too.`)) return;
    data.hideExercise(n.key);
    if (openKey === n.key) setOpenKey(null);
  };

  return (
    <div className="space-y-4">
      <Title>Exercises</Title>
      <p className="text-sm text-[var(--muted)]">Add a YouTube link to an exercise and a ▶ Video button shows up whenever it's in a workout. Links with a timestamp (t=95) start there. {withVideo} of {visible.length} have a video. Tap ✕ to take an exercise off this list.</p>
      <input className="min-h-touch w-full rounded-xl bg-slate-800 px-3" placeholder="Search" aria-label="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} />

      {names.length === 0 && <p className="text-[var(--muted)]">Exercises show up here as soon as you check a pasted plan, and from your workouts, templates and Up next.</p>}
      <ul className="space-y-2">
        {shown.map((n) => (
          <li key={n.key}>
            {openKey === n.key
              ? <Editor name={n.display} keyName={n.key} onClose={() => setOpenKey(null)} />
              : (
                <div className="flex items-stretch gap-1">
                  <button className="flex min-h-touch flex-1 items-center justify-between rounded-xl bg-[var(--surface)] px-4 py-2 text-left" onClick={() => setOpenKey(n.key)} aria-label={`Edit video for ${n.display}`}>
                    <span>{n.display}</span>
                    <span className={`text-sm ${data.videos[n.key] ? "text-rose-300" : "text-[var(--muted)]"}`}>{data.videos[n.key] ? "▶ video" : "+ add video"}</span>
                  </button>
                  <button className="w-12 shrink-0 rounded-xl bg-[var(--surface)] text-lg text-[var(--muted)] active:bg-slate-700" aria-label={`Remove ${n.display} from the list`} onClick={() => remove(n)}>✕</button>
                </div>
              )}
          </li>
        ))}
      </ul>

      {hiddenNames.length > 0 && (
        <details className="rounded-2xl border border-[var(--line)] p-3">
          <summary className="min-h-touch cursor-pointer py-3 text-[var(--muted)]">Hidden ({hiddenNames.length})</summary>
          <ul className="space-y-2" data-testid="hidden-list">
            {hiddenNames.map((n) => (
              <li key={n.key} className="flex items-center justify-between rounded-xl bg-[var(--surface)] px-4 py-1">
                <span className="text-[var(--muted)]">{n.display}</span>
                <Button variant="ghost" aria-label={`Bring back ${n.display}`} onClick={() => data.unhideExercise(n.key)}>Bring back</Button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Card>
        <h2 className="mb-2 font-semibold">Add a name</h2>
        <p className="mb-2 text-sm text-[var(--muted)]">For an exercise you haven't done yet. Use the exact name your plans use.</p>
        <div className="flex gap-2">
          <input className="min-h-touch flex-1 rounded-xl bg-slate-800 px-3" placeholder="e.g. Bulgarian split squat" aria-label="New exercise name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button variant="primary" disabled={!newName.trim()} onClick={() => { const k = newName.trim().toLowerCase().replace(/\s+/g, " "); data.unhideExercise(k); setOpenKey(k); setQ(""); }}>Add</Button>
        </div>
        {openKey && !names.some((n) => n.key === openKey) && (
          <div className="mt-3"><Editor name={newName.trim()} keyName={openKey} onClose={() => { setOpenKey(null); setNewName(""); }} /></div>
        )}
      </Card>
    </div>
  );
}

function Editor({ name, keyName, onClose }: { name: string; keyName: string; onClose(): void }) {
  const { videos, setVideo, removeVideo } = useData();
  const current = videos[keyName];
  const [url, setUrl] = useState(current ? `https://youtu.be/${current.id}${current.start ? `?t=${current.start}` : ""}` : "");
  const [error, setError] = useState<string | null>(null);
  const parsed = parseYouTube(url);
  return (
    <div className="space-y-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3" data-testid="video-editor">
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">{name}</span>
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
      <input className="min-h-touch w-full rounded-xl bg-slate-800 px-3" inputMode="url" placeholder="Paste a YouTube link" aria-label={`YouTube link for ${name}`}
        value={url} onChange={(e) => { setUrl(e.target.value); setError(null); }} />
      {url.trim() && !parsed && <p className="text-sm text-rose-300">{error ?? "That isn't a YouTube video link."}</p>}
      {parsed && <p className="text-sm text-[var(--muted)]">YouTube video{fmtStart(parsed.start)}</p>}
      <div className="grid grid-cols-2 gap-2">
        {current ? <Button variant="danger" onClick={() => { removeVideo(keyName); setUrl(""); onClose(); }}>Remove</Button> : <span />}
        <Button variant="primary" disabled={!parsed} onClick={() => { if (setVideo(keyName, url)) onClose(); else setError("That isn't a YouTube video link."); }}>Save</Button>
      </div>
      {current && <VideoButton video={current} name={name} />}
    </div>
  );
}
