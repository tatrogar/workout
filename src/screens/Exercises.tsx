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
  const names = useMemo(() => allExerciseNames(data, data.aliases), [data.workouts, data.active, data.templates, data.upNext, data.videos, data.aliases]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = names.filter((n) => n.display.toLowerCase().includes(q.trim().toLowerCase()));
  const withVideo = names.filter((n) => data.videos[n.key]).length;

  return (
    <div className="space-y-4">
      <Title>Exercises</Title>
      <p className="text-sm text-[var(--muted)]">Add a YouTube link to an exercise and a ▶ Video button shows up whenever it's in a workout. Links with a timestamp (t=95) start there. {withVideo} of {names.length} have a video.</p>
      <input className="min-h-touch w-full rounded-xl bg-slate-800 px-3" placeholder="Search" aria-label="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} />

      {names.length === 0 && <p className="text-[var(--muted)]">Exercises from your workouts, templates and Up next show up here.</p>}
      <ul className="space-y-2">
        {shown.map((n) => (
          <li key={n.key}>
            {openKey === n.key
              ? <Editor name={n.display} keyName={n.key} onClose={() => setOpenKey(null)} />
              : (
                <button className="flex min-h-touch w-full items-center justify-between rounded-xl bg-[var(--surface)] px-4 py-2 text-left" onClick={() => setOpenKey(n.key)} aria-label={`Edit video for ${n.display}`}>
                  <span>{n.display}</span>
                  <span className={`text-sm ${data.videos[n.key] ? "text-rose-300" : "text-[var(--muted)]"}`}>{data.videos[n.key] ? "▶ video" : "+ add video"}</span>
                </button>
              )}
          </li>
        ))}
      </ul>

      <Card>
        <h2 className="mb-2 font-semibold">Add a name</h2>
        <p className="mb-2 text-sm text-[var(--muted)]">For an exercise you haven't done yet. Use the exact name your plans use.</p>
        <div className="flex gap-2">
          <input className="min-h-touch flex-1 rounded-xl bg-slate-800 px-3" placeholder="e.g. Bulgarian split squat" aria-label="New exercise name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button variant="primary" disabled={!newName.trim()} onClick={() => { setOpenKey(newName.trim().toLowerCase().replace(/\s+/g, " ")); setQ(""); }}>Add</Button>
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
