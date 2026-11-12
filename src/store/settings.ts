import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Units } from "../plan/types";

export type Settings = {
  units: Units;
  // cues
  sound: boolean;
  vibration: boolean;
  flash: boolean;
  voice: boolean;        // spoken cues
  voiceDetail: boolean;  // also say round numbers and move names
  // timers
  defaultRestOn: boolean;
  defaultRestSec: number; // rest after a strength set when the plan gives none
  readyOn: boolean;
  readySec: number;       // get-ready countdown before intervals and holds
  // workout screen
  showEffort: boolean;
  showLastTime: boolean;
  showPlates: boolean;
  showBests: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  units: "lb",
  sound: true, vibration: true, flash: true, voice: true, voiceDetail: true,
  defaultRestOn: true, defaultRestSec: 90, readyOn: true, readySec: 5,
  showEffort: true, showLastTime: true, showPlates: true, showBests: true,
};

type SettingsState = Settings & { set(patch: Partial<Settings>): void };

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({ ...DEFAULT_SETTINGS, set: (patch) => set(patch) }),
    { name: "workout.settings", version: 1 },
  ),
);
