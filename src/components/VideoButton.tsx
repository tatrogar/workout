import { useEffect, useState } from "react";
import { embedUrl, type Video } from "../videos/youtube";

function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

/** ▶ Video toggle with an inline player. The player only loads when opened. */
export function VideoButton({ video, name, compact = false }: { video: Video; name: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const online = useOnline();
  return (
    <div className={compact ? "" : "mt-2"}>
      <button type="button" aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} video for ${name}`} onClick={() => setOpen(!open)}
        className={`${compact ? "h-9 px-3 text-sm" : "min-h-touch px-4"} rounded-xl bg-rose-700/80 font-semibold text-white active:bg-rose-800`}>
        {open ? "✕ Close video" : "▶ Video"}
      </button>
      {open && (
        online ? (
          <div className="mt-2 aspect-video w-full overflow-hidden rounded-xl bg-black" data-testid="video-player">
            <iframe className="h-full w-full" src={embedUrl(video)} title={`Video for ${name}`} loading="lazy"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          </div>
        ) : (
          <p className="mt-2 rounded-xl bg-slate-800 p-3 text-sm" data-testid="video-offline">Needs a connection. Videos can't play without signal.</p>
        )
      )}
    </div>
  );
}
