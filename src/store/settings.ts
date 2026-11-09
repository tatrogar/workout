import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Units } from "../plan/types";

export type Settings = { units: Units; sound: boolean; vibration: boolean; flash: boolean };
type SettingsState = Settings & { set(patch: Partial<Settings>): void };

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({ units: "lb", sound: true, vibration: true, flash: true, set: (patch) => set(patch) }),
    { name: "workout.settings", version: 1 },
  ),
);
