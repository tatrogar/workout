import { useEffect, useState } from "react";

/** Re-renders about 10×/s while active; returns Date.now(). */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    const onVis = () => setNow(Date.now());
    document.addEventListener("visibilitychange", onVis);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [active]);
  return active ? now : Date.now();
}

/** Keeps the screen on while active; re-acquires after the tab becomes visible again. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        if (document.visibilityState === "visible") lock = await navigator.wakeLock.request("screen");
        if (cancelled) void lock?.release();
      } catch { /* denied or unsupported */ }
    };
    void acquire();
    const onVis = () => { if (document.visibilityState === "visible") void acquire(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVis); void lock?.release(); };
  }, [active]);
}
