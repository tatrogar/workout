import { create, type StoreApi, type UseBoundStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Template, Workout } from "../workout/types";
import { finish } from "../workout/session";

export type KV = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };

export type DataState = {
  workouts: Workout[];
  templates: Template[];
  active: Workout | null;
  aliases: Record<string, string>;
  lastExportAt: string | null;
  storageError: boolean;
  startWorkout(w: Workout): void;
  updateActive(fn: (w: Workout) => Workout): void;
  finishActive(now: Date, notes?: string): string | null;
  discardActive(): void;
  deleteWorkout(id: string): void;
  upsertWorkout(w: Workout): void;
  saveTemplate(t: Template): void;
  deleteTemplate(id: string): void;
  setAlias(from: string, to: string): void;
  removeAlias(from: string): void;
  markExported(at: Date): void;
  replaceWorkouts(ws: Workout[], aliases: Record<string, string>): void;
  clearStorageError(): void;
};

const DAY = 86_400_000;
export const aliasKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

const byNewest = (a: Workout, b: Workout) => b.startedAt.localeCompare(a.startedAt);

let persistRequested = false;
function requestPersist() {
  if (persistRequested) return;
  persistRequested = true;
  try { void navigator.storage?.persist?.(); } catch { /* unsupported */ }
}

export function createDataStore(kv: KV): UseBoundStore<StoreApi<DataState>> {
  let flagError = () => {};
  const safe: KV = {
    getItem: (k) => { try { return kv.getItem(k); } catch { return null; } },
    setItem: (k, v) => {
      try { kv.setItem(k, v); requestPersist(); } catch { flagError(); }
    },
    removeItem: (k) => { try { kv.removeItem(k); } catch { /* ignore */ } },
  };
  const store = create<DataState>()(
    persist(
      (set, get) => ({
        workouts: [],
        templates: [],
        active: null,
        aliases: {},
        lastExportAt: null,
        storageError: false,
        startWorkout: (w) => set({ active: w }),
        updateActive: (fn) => { const a = get().active; if (a) set({ active: fn(a) }); },
        finishActive: (now, notes) => {
          const a = get().active;
          if (!a) return null;
          const done = finish(a, now, notes);
          set({ active: null, workouts: [done, ...get().workouts.filter((w) => w.id !== done.id)].sort(byNewest) });
          return done.id;
        },
        discardActive: () => set({ active: null }),
        deleteWorkout: (id) => set({ workouts: get().workouts.filter((w) => w.id !== id) }),
        upsertWorkout: (w) => set({ workouts: [w, ...get().workouts.filter((x) => x.id !== w.id)].sort(byNewest) }),
        saveTemplate: (t) => set({ templates: [t, ...get().templates.filter((x) => x.id !== t.id)] }),
        deleteTemplate: (id) => set({ templates: get().templates.filter((t) => t.id !== id) }),
        setAlias: (from, to) => {
          const f = aliasKey(from);
          const t = aliasKey(to);
          if (f && t && f !== t) set({ aliases: { ...get().aliases, [f]: t } });
        },
        removeAlias: (from) => {
          const { [aliasKey(from)]: _gone, ...rest } = get().aliases;
          set({ aliases: rest });
        },
        markExported: (at) => set({ lastExportAt: at.toISOString() }),
        replaceWorkouts: (ws, aliases) => set({ workouts: [...ws].sort(byNewest), aliases }),
        clearStorageError: () => set({ storageError: false }),
      }),
      {
        name: "workout.data",
        version: 1,
        storage: createJSONStorage(() => safe),
        partialize: ({ workouts, templates, active, aliases, lastExportAt }) => ({ workouts, templates, active, aliases, lastExportAt }),
      },
    ),
  );
  flagError = () => { if (!store.getState().storageError) store.setState({ storageError: true }); };
  return store;
}

export function exportDue(s: { workouts: Workout[]; lastExportAt: string | null }, now: Date): boolean {
  const last = s.lastExportAt ? Date.parse(s.lastExportAt) : null;
  const newer = s.workouts.some((w) => w.finishedAt && (last === null || Date.parse(w.finishedAt) > last));
  if (!newer) return false;
  return last === null || now.getTime() - last >= 14 * DAY;
}

const browserKV: KV =
  typeof localStorage !== "undefined"
    ? localStorage
    : { getItem: () => null, setItem: () => {}, removeItem: () => {} };

export const useData = createDataStore(browserKV);
