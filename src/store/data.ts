import { create, type StoreApi, type UseBoundStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Template, Workout } from "../workout/types";
import { finish, reopen } from "../workout/session";
import { parseYouTube, type Video } from "../videos/youtube";
import type { Scheduled } from "../calendar/schedule";
import { newId } from "../workout/session";

export type KV = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };

export type UpNext = { id: string; title: string; planText: string };

export type DataState = {
  /** Calendar entries. */
  scheduled: Scheduled[];
  /** Add entries; any existing entries on `replaceDates` are removed first. */
  schedule(items: Scheduled[], replaceDates: string[]): void;
  moveScheduled(id: string, date: string): void;
  /** Returns the new entry's id. */
  copyScheduled(id: string, date: string): string | null;
  editScheduled(id: string, planText: string, title: string): void;
  deleteScheduled(id: string): void;
  mergeScheduled(items: Scheduled[]): void;
  /** One video per exercise, keyed by normalized name. */
  videos: Record<string, Video>;
  /** false when the link isn't a YouTube video. */
  setVideo(name: string, url: string): boolean;
  removeVideo(name: string): void;
  mergeVideos(v: Record<string, Video>): void;
  /** Exercise names removed from the Exercises list (normalized). */
  hiddenExercises: string[];
  hideExercise(name: string): void;
  unhideExercise(name: string): void;
  mergeHidden(keys: string[]): void;
  /** Names from plans that were pasted and checked, so they can get a video before being done. */
  knownNames: string[];
  addKnownNames(names: string[]): void;
  upNext: UpNext[];
  addUpNext(items: UpNext[]): void;
  removeUpNext(id: string): void;
  /** false when another workout is already in progress. */
  reopenWorkout(id: string, now: Date): boolean;
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
        scheduled: [],
        schedule: (items, replaceDates) => {
          const drop = new Set(replaceDates);
          set({ scheduled: [...get().scheduled.filter((x) => !(x.date && drop.has(x.date))), ...items] });
        },
        moveScheduled: (id, date) => set({ scheduled: get().scheduled.map((x) => (x.id === id ? { ...x, date } : x)) }),
        copyScheduled: (id, date) => {
          const src = get().scheduled.find((x) => x.id === id);
          if (!src) return null;
          const copy: Scheduled = { id: newId(), date, title: src.title, planText: src.planText };
          set({ scheduled: [...get().scheduled, copy] });
          return copy.id;
        },
        editScheduled: (id, planText, title) => set({ scheduled: get().scheduled.map((x) => (x.id === id ? { ...x, planText, title } : x)) }),
        deleteScheduled: (id) => set({ scheduled: get().scheduled.filter((x) => x.id !== id) }),
        mergeScheduled: (items) => {
          const have = new Set(get().scheduled.map((x) => x.id));
          set({ scheduled: [...get().scheduled, ...items.filter((x) => !have.has(x.id))] });
        },
        videos: {},
        setVideo: (name, url) => {
          const v = parseYouTube(url);
          const k = aliasKey(name);
          if (!v || !k) return false;
          set({ videos: { ...get().videos, [k]: v } });
          return true;
        },
        removeVideo: (name) => {
          const { [aliasKey(name)]: _gone, ...rest } = get().videos;
          set({ videos: rest });
        },
        mergeVideos: (v) => set({ videos: { ...v, ...get().videos } }),
        knownNames: [],
        addKnownNames: (names) => {
          const have = new Set(get().knownNames.map(aliasKey));
          const add: string[] = [];
          for (const n of names) {
            const k = aliasKey(n);
            if (!k || have.has(k)) continue;
            have.add(k);
            add.push(n.trim().replace(/\s+/g, " "));
          }
          if (add.length) set({ knownNames: [...get().knownNames, ...add] });
        },
        hiddenExercises: [],
        hideExercise: (name) => {
          const k = aliasKey(name);
          if (!k) return;
          const { [k]: _gone, ...videos } = get().videos;
          const hidden = get().hiddenExercises.includes(k) ? get().hiddenExercises : [...get().hiddenExercises, k];
          set({ hiddenExercises: hidden, videos });
        },
        unhideExercise: (name) => set({ hiddenExercises: get().hiddenExercises.filter((k) => k !== aliasKey(name)) }),
        mergeHidden: (keys) => set({ hiddenExercises: [...new Set([...get().hiddenExercises, ...keys.map(aliasKey).filter(Boolean)])] }),
        upNext: [],
        addUpNext: (items) => set({ upNext: [...get().upNext, ...items] }),
        removeUpNext: (id) => set({ upNext: get().upNext.filter((u) => u.id !== id) }),
        reopenWorkout: (id, now) => {
          const w = get().workouts.find((x) => x.id === id);
          if (!w || get().active) return false;
          set({ active: reopen(w, now), workouts: get().workouts.filter((x) => x.id !== id) });
          return true;
        },
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
          set({
            active: null,
            workouts: [done, ...get().workouts.filter((w) => w.id !== done.id)].sort(byNewest),
            scheduled: done.scheduledId ? get().scheduled.map((x) => (x.id === done.scheduledId ? { ...x, workoutId: done.id } : x)) : get().scheduled,
          });
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
        version: 2,
        storage: createJSONStorage(() => safe),
        partialize: ({ workouts, templates, active, aliases, lastExportAt, upNext, videos, hiddenExercises, knownNames, scheduled }) => ({ workouts, templates, active, aliases, lastExportAt, upNext, videos, hiddenExercises, knownNames, scheduled }),
        // v2: the calendar replaces Up next; old Up next items become unscheduled calendar entries.
        migrate: (persisted, version) => {
          const s = (persisted ?? {}) as Partial<DataState>;
          if (version < 2 && s.upNext?.length) {
            s.scheduled = [...(s.scheduled ?? []), ...s.upNext.map((u) => ({ id: u.id, date: null, title: u.title, planText: u.planText }))];
            s.upNext = [];
          }
          return s as DataState;
        },
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
