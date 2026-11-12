import type { Cue } from "./engine";

export type CueSettings = { sound: boolean; vibration: boolean; flash: boolean; voice?: boolean };
export type CueDeps = {
  beep(freq: number, ms: number, delayMs?: number): void;
  vibrate(pattern: number[]): void;
  flash(color: string): void;
  speak?(text: string): void;
};

export const FLASH_COLORS: Record<Cue, string> = { WORK: "#22c55e", REST: "#3b82f6", WARN: "#ffffff", END: "#ffffff" };

const SOUNDS: Record<Cue, [freq: number, ms: number, delay: number][]> = {
  WORK: [[880, 180, 0], [1320, 260, 200]],
  REST: [[660, 220, 0], [440, 300, 240]],
  WARN: [[1000, 100, 0]],
  END: [[880, 180, 0], [880, 180, 260], [1320, 400, 520]],
};
const VIBES: Record<Cue, number[]> = {
  WORK: [300],
  REST: [150, 100, 150],
  WARN: [60],
  END: [250, 120, 250, 120, 400],
};

let ctx: AudioContext | null = null;

/** Must run inside a tap handler (browsers block audio until then). */
export function unlockAudio(): void {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch { /* no audio */ }
}

export function audioContextForTest(): AudioContext | null {
  return ctx;
}

type FlashListener = (color: string) => void;
const flashListeners = new Set<FlashListener>();
export function onFlash(fn: FlashListener): () => void {
  flashListeners.add(fn);
  return () => flashListeners.delete(fn);
}

export const browserDeps: CueDeps = {
  beep(freq, ms, delayMs = 0) {
    if (!ctx) return;
    if (ctx.state !== "running") void ctx.resume().catch(() => {});
    const t = ctx.currentTime + delayMs / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.6, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + ms / 1000 + 0.02);
  },
  vibrate(pattern) {
    try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
  },
  flash(color) {
    flashListeners.forEach((fn) => fn(color));
  },
  speak(text) {
    try {
      if (typeof speechSynthesis === "undefined") return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      speechSynthesis.speak(u);
    } catch { /* no speech on this device */ }
  },
};

export function fireCue(kind: Cue, settings: CueSettings, deps: CueDeps = browserDeps, say?: string | null): void {
  if (settings.voice && say) deps.speak?.(say);
  if (settings.sound) for (const [f, ms, d] of SOUNDS[kind]) deps.beep(f, ms, d);
  if (settings.vibration) deps.vibrate(VIBES[kind]);
  if (settings.flash) deps.flash(FLASH_COLORS[kind]);
}
