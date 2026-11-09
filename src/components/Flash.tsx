import { useEffect, useState } from "react";
import { onFlash } from "../timer/cues";

/** One ~300 ms full-screen color pulse per cue. Never strobes: a new cue restarts the single pulse. */
export function FlashOverlay() {
  const [flash, setFlash] = useState<{ color: string; key: number } | null>(null);
  useEffect(() => onFlash((color) => setFlash({ color, key: Date.now() })), []);
  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 320);
    return () => window.clearTimeout(id);
  }, [flash]);
  if (!flash) return null;
  return (
    <div key={flash.key} aria-hidden data-testid="flash"
      className="pointer-events-none fixed inset-0 z-50"
      style={{ background: flash.color, animation: "flash-fade 300ms ease-out forwards" }} />
  );
}
