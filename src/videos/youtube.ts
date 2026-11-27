/** A YouTube video and an optional start time in seconds. */
export type Video = { id: string; start?: number };

const HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtube-nocookie.com", "youtube-nocookie.com"]);
const ID = /^[A-Za-z0-9_-]{11}$/;

export function isVideoId(s: unknown): s is string {
  return typeof s === "string" && ID.test(s);
}

/** "95", "95s", "1m35s", "2h1m5s" → seconds. */
function parseTime(t: string | null | undefined): number | undefined {
  if (!t) return undefined;
  if (/^\d+$/.test(t)) return Number(t) || undefined;
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (!m || !m[0]) return undefined;
  const sec = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return sec || undefined;
}

/** Any normal YouTube link → { id, start }. Anything else → null. */
export function parseYouTube(input: string): Video | null {
  const raw = input.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (!HOSTS.has(host)) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  let id: string | null = null;
  if (host === "youtu.be") id = parts[0] ?? null;
  else if (parts[0] === "watch") id = url.searchParams.get("v");
  else if (["shorts", "embed", "live"].includes(parts[0])) id = parts[1] ?? null;
  if (!isVideoId(id)) return null;
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const start = parseTime(url.searchParams.get("t") ?? url.searchParams.get("start") ?? hash.get("t"));
  return start ? { id, start } : { id };
}

/** Privacy-enhanced embed; plays inline on phones. */
export function embedUrl(v: Video): string {
  return `https://www.youtube-nocookie.com/embed/${v.id}?${v.start ? `start=${v.start}&` : ""}playsinline=1&rel=0`;
}
