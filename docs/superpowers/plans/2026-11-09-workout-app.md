# Workout App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An offline Android PWA that runs workouts pasted from Claude (timers, checkboxes, cues), keeps history, graphs trends, and exports a Markdown+JSON log for Claude.

**Architecture:** Static React app on GitHub Pages. Pure modules (parser, timer engine, session reducers, trends, export/import) hold all logic and are unit-tested; zustand stores persist to localStorage; screens are thin.

**Tech Stack:** React 18, Vite 5, TypeScript 5, Tailwind 3, zustand 4 (`persist`), vite-plugin-pwa, Vitest 2, Playwright (preinstalled, smoke test only).

**Spec:** `docs/superpowers/specs/2026-11-09-workout-app-design.md`

## Global Constraints

- No server, no accounts, no network calls at runtime. Works offline after first load.
- Hash routes (`#/...`). Vite `base: '/workout/'`.
- Default units `lb`. Settings: units, sound, vibration, flash — all on by default except units.
- Flash is a single ~300 ms pulse: green on WORK start, blue on REST start, white for 3-2-1 and rest-timer end. Never strobing.
- Parser never guesses: any unmatched line is an error with line number, the line, and an example of the expected form.
- Export file name `workout-log-YYYY-MM-DD.md`; JSON block has `formatVersion: 1`, `exportedAt`, `units`, `aliases`, `workouts`.
- Export reminder: workouts newer than last export AND (never exported OR last export ≥ 14 days ago).
- Timers computed from stored timestamps, never tick counts.
- Active workout persisted on every change.
- Charts are hand-written SVG, no chart library.
- Same stack/versions as the Classroom app's `package.json` (`tatrogar/app`).

## Review Focus

1. **Pasted plan wrapped in a Markdown code fence, or using `×`/`X` and curly quotes** (Claude often does this) → parses as if plain. Test in Task 3.
2. **App killed or phone locked during a rest/interval timer** → on reopen the timer shows the correct remaining time or the correct later phase. Test in Task 4 and Task 7.
3. **Importing the same backup twice, or a backup overlapping current data** → no duplicate workouts; same id keeps the one with later `finishedAt`. Test in Task 8.
4. **Units switched lb→kg after months of lb history** → trends show all points in the current unit (converted), export keeps each workout's own unit. Test in Task 9.
5. **Exercise names differing only by case/whitespace ("Squat", " squat ")** → same trend line without a manual merge. Test in Task 9.

---

## File Structure

```
.github/workflows/deploy.yml      Pages deploy (copied from tatrogar/app)
index.html, vite.config.ts, tailwind.config.js, postcss.config.js, tsconfig.json, package.json
public/icon-192.png, icon-512.png  PWA icons (simple generated)
src/main.tsx                      mount
src/App.tsx                       hash router + nav
src/router.ts                     useHashRoute(): {path, params}
src/plan/types.ts                 Units, Exercise, Plan (spec "Data model")
src/plan/tokens.ts                parseDuration, parseWeight, formatDuration
src/plan/parse.ts                 parsePlan
src/plan/instructions.ts          CLAUDE_INSTRUCTIONS
src/timer/engine.ts               timer sequences, pure
src/timer/cues.ts                 beep/vibrate/flash
src/timer/useNow.ts               rAF/interval clock hook
src/workout/types.ts              Workout, ExerciseLog, Template
src/workout/session.ts            pure reducers over Workout
src/store/*.ts                    zustand stores
src/export/markdown.ts            toMarkdown
src/export/importFile.ts          parseExport, mergeWorkouts
src/trends/series.ts              trend series, pure
src/charts/{LineChart,BarChart,Sparkline}.tsx
src/screens/*.tsx                 one file per route
src/screens/exercise/*.tsx        one view per exercise kind
tests/**/*.test.ts                Vitest
e2e/smoke.spec.ts                 Playwright
```

---

### Task 1: Scaffold, deploy, router

**Files:** all root config files, `.github/workflows/deploy.yml`, `src/main.tsx`, `src/App.tsx`, `src/router.ts`, `src/index.css`, `tests/router.test.ts`, `README.md`, `.gitignore`

**Interfaces:**
- Produces: `parseHash(hash: string): { path: string; params: Record<string,string> }` matching patterns `/`, `/paste`, `/workout`, `/finish`, `/history`, `/history/:id`, `/templates`, `/templates/:id`, `/trends`, `/trends/:name`, `/settings`; unknown → `{path:'/'}`. `useHashRoute()` hook returning the same. `navigate(to: string)`.

- [ ] **Step 1:** Copy `package.json`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `.github/workflows/deploy.yml` from `/home/user/App`; rename package to `workout`; set `vite.config.ts` with `base: '/workout/'`, react plugin, `VitePWA({ registerType: 'autoUpdate', manifest: { name: 'Workout', short_name: 'Workout', display: 'standalone', theme_color: '#0f172a', background_color: '#0f172a', icons: [192, 512] }, workbox: { globPatterns: ['**/*.{js,css,html,png,svg}'] } })`, and vitest `environment: 'node'`. Generate two solid-color PNG icons. `npm install`.
- [ ] **Step 2: Failing test** `tests/router.test.ts`: `parseHash('#/history/abc')` → `{path:'/history/:id', params:{id:'abc'}}`; `parseHash('#/trends/back%20squat')` → params `{name:'back squat'}`; `parseHash('')` and `parseHash('#/nope')` → path `/`.
- [ ] **Step 3:** Run `npx vitest run tests/router.test.ts` → FAIL.
- [ ] **Step 4:** Implement `src/router.ts`; `App.tsx` renders a placeholder per route and a bottom nav (Start, History, Trends, Templates, Settings). Dark theme base on `body`.
- [ ] **Step 5:** `npm test` PASS and `npm run build` succeeds with `dist/manifest.webmanifest` present.
- [ ] **Step 6:** Commit `feat: scaffold app, router, Pages deploy`.

### Task 2: Plan types and tokens

**Files:** `src/plan/types.ts`, `src/plan/tokens.ts`, `tests/plan/tokens.test.ts`

**Interfaces:**
- Produces: types `Units`, `Seconds`, `Exercise` (union exactly as spec "Data model"), `Plan`. `parseDuration(s: string): Seconds | null`; `formatDuration(sec: Seconds): string` (`45s`, `2:00`, `1:02:03`); `parseWeight(s: string, defaultUnits: Units): { value: number; units: Units } | null`.

- [ ] **Step 1: Failing tests:** `parseDuration` of `45s`→45, `90 s`→90, `2 min`→120, `2min`→120, `1:30`→90, `20 minutes`→1200, `abc`→null, `''`→null. `formatDuration(45)`→`'45s'`, `(120)`→`'2:00'`, `(3723)`→`'1:02:03'`. `parseWeight('185 lb','lb')`→`{185,'lb'}`, `('80kg','lb')`→`{80,'kg'}`, `('135','kg')`→`{135,'kg'}`, `('heavy','lb')`→null.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: plan types and duration/weight tokens`.

### Task 3: Plan parser and Claude instructions

**Files:** `src/plan/parse.ts`, `src/plan/instructions.ts`, `tests/plan/parse.test.ts`

**Interfaces:**
- Consumes: Task 2.
- Produces: `parsePlan(text: string, defaultUnits: Units): { ok: true; plan: Plan } | { ok: false; errors: { line: number; text: string; message: string }[] }`. `CLAUDE_INSTRUCTIONS: string`. `planToText(plan: Plan): string` (inverse, used by "save as template" after in-app edits).

Pre-processing before line parsing: strip a surrounding ``` fence (with or without language tag); replace `×` and standalone `X` between numbers with `x`; replace curly quotes; trim lines; drop blank lines. Line numbers in errors refer to the original pasted text.

- [ ] **Step 1: Failing tests** (`tests/plan/parse.test.ts`):
  - `parses spec example`: the full example plan from the spec yields 8 exercises with kinds `strength, sets→strength, strength, intervals, hold, circuit, cardio, other`; Squat sets = 3× `{weight:185,reps:5}`, `restSec:120`, note `'pause at the bottom'`; Bench sets `[{135,8},{155,6},{175,4}]`, rest 90; Pull-ups sets 3×`{reps:8}` with no weight; Tabata `{rounds:8, workSec:20, restSec:10}`; Plank `{sets:3, holdSec:45, restSec:30}`; circuit rounds 3, rest 60, moves `[{Plank,sec:45},{Dead bug,reps:10},{Side plank,sec:30}]`; cardio `{durationSec:1200, distance:2, distanceUnit:'mi'}`; other `{durationSec:600}`; title `'Leg day'`.
  - `title optional`: no `#` line → `plan.title` undefined.
  - `kg plan`: `strength: 3x5 @ 80 kg` with default `lb` → weights stored as 80 and `plan.units === 'kg'` (plan units = unit of the first explicit weight, else the default). Mixed units in one plan (`80 kg` then `185 lb`) → error on the second line, message `use one unit per plan`.
  - `code fence and ×`: same Squat line wrapped in ```` ```text ... ``` ```` and written `3×5` parses identically.
  - `bad line error`: `## Squat\nstrength: 3 by 5` → `ok:false`, errors `[{line:2, text:'strength: 3 by 5', message: contains '3x5 @ 185 lb'}]`.
  - `exercise without type line` → error on the `##` line, message contains `expected a line like "strength: 3x5 @ 185 lb"`.
  - `circuit with no moves` → error.
  - `move line outside circuit` → error.
  - `line before first ## (not title)` → error.
  - `round trip`: `parsePlan(planToText(p)).plan` deep-equals `p` for the spec example.
  - `instructions contain the example and the name rule`: `CLAUDE_INSTRUCTIONS` includes `strength: 3x5 @ 185 lb` and `reuse exact exercise names`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement as a line-by-line state machine (`none → exercise-header → typed`, circuit collects `- ` lines). Each type line has one regex; on no match push error with a per-type example message. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: plan parser and Claude instructions`.

### Task 4: Timer engine

**Files:** `src/timer/engine.ts`, `tests/timer/engine.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type Phase = { label: 'WORK'|'REST'|'HOLD'|'MOVE'|'REST_TIMER'; sec: Seconds; round: number; moveIndex?: number };
  type TimerState = { phases: Phase[]; startedAt: number | null; pausedAt: number | null; pausedTotalMs: number };
  type TimerView = { index: number; phase: Phase | null; remainingSec: number; done: boolean };
  function intervalPhases(rounds: number, workSec: Seconds, restSec: Seconds): Phase[]; // no trailing rest after last round
  function holdPhases(sets: number, holdSec: Seconds, restSec?: Seconds): Phase[];
  function circuitPhases(rounds: number, moves: {name:string; sec?:number; reps?:number}[], restSec?: Seconds): Phase[]; // rep moves get sec 0 = wait for Done
  function restPhases(sec: Seconds): Phase[];
  function start(s: TimerState, now: number): TimerState;
  function pause(s: TimerState, now: number): TimerState;
  function resume(s: TimerState, now: number): TimerState;
  function addSeconds(s: TimerState, sec: number, now: number): TimerState; // extends current phase
  function skip(s: TimerState, now: number): TimerState; // jump to next phase
  function view(s: TimerState, now: number): TimerView;
  function crossedCues(s: TimerState, prevNow: number, now: number): ('WORK'|'REST'|'WARN'|'END')[];
  ```
  Phases with `sec: 0` (rep moves) hold until `skip`. Implement by storing per-phase offsets: `addSeconds`/`skip` mutate `phases` (a copy) so `view` stays a pure sum over durations.

- [ ] **Step 1: Failing tests:** `intervalPhases(8,20,10)` has 15 phases, last is WORK round 8. `view` at start+25s → index 1 REST, remaining 5. At start+1000s → `done:true`. Pause at +5s, resume at +65s, view at +70s → index 0, remaining 10. `addSeconds(+15)` on a 60s rest at +10s → remaining 65. `skip` at +3s on interval → index 1 REST remaining 10. `crossedCues` from +17.5 to +18.5 → `['WARN']` (3-2-1 at 3,2,1 s remaining); from +19.9 to +20.1 → `['REST']`; for restPhases ending → `['END']`. **Locked-phone case:** `view` at start + 10 minutes for `intervalPhases(8,20,10)` started at 0 → `done:true` with no exception; `crossedCues(prev=+5s, now=+600s)` returns only `['END']` (no replay of missed cues — spec).
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: timestamp-based timer engine`.

### Task 5: Cues (chime, vibrate, flash) and clock hook

**Files:** `src/timer/cues.ts`, `src/timer/useNow.ts`, `src/components/Flash.tsx`, `tests/timer/cues.test.ts`

**Interfaces:**
- Produces: `fireCue(kind: 'WORK'|'REST'|'WARN'|'END', settings: {sound:boolean; vibration:boolean; flash:boolean}, deps?: CueDeps): void` where `CueDeps = { beep(freq:number, ms:number): void; vibrate(pattern:number[]): void; flash(color:string): void }` (defaults use Web Audio, `navigator.vibrate`, and a flash event bus). `unlockAudio(): void` (call on Start tap). `FLASH_COLORS = { WORK:'#22c55e', REST:'#3b82f6', WARN:'#ffffff', END:'#ffffff' }`. `<FlashOverlay/>` listens to the bus and shows a full-screen fixed div with that color, opacity 0.85 → 0 over 300 ms, `pointer-events:none`. `useNow(active: boolean): number` re-renders ~10×/s while active. `useWakeLock(active: boolean)`.

- [ ] **Step 1: Failing tests** with fake deps: `fireCue('WORK', all on)` calls beep once, vibrate once, flash with `'#22c55e'`. All off → no calls. `WARN` beep is a short high tone (`ms ≤ 150`); `END` vibrate pattern has 3 pulses.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: chime, vibration and screen flash cues`.

### Task 6: Workout session model

**Files:** `src/workout/types.ts`, `src/workout/session.ts`, `tests/workout/session.test.ts`

**Interfaces:**
- Consumes: `Plan`, `Exercise` (Task 2).
- Produces: types `Workout`, `ExerciseLog`, `Template` exactly as spec, plus `Workout.timer?: { exerciseIndex: number; state: TimerState }` (Task 4) for resume. Pure functions, each returning a new `Workout`:
  `createWorkout(plan: Plan, planText: string, now: Date, id?: string): Workout` (title defaults to `YYYY-MM-DD`; strength `sets` prefilled from plan with `done:false`; holds prefilled);
  `toggleSet(w, exIdx, setIdx, now: Date)`; `editSet(w, exIdx, setIdx, patch: {weight?: number; reps?: number})`; `addSet(w, exIdx)` (copies last set); `toggleHold(w, exIdx, i)`; `setRoundsDone(w, exIdx, n)`; `setCardio(w, exIdx, {durationSec?, distance?})`; `setNotes(w, exIdx, text)`; `skipExercise(w, exIdx)`; `finish(w, now: Date, notes?: string)`;
  `exerciseStatus(log: ExerciseLog): 'done'|'partial'|'skipped'` (skipped if explicitly skipped or nothing recorded; done if all planned sets/rounds/duration met; else partial) — `finish` writes it onto every log.

- [ ] **Step 1: Failing tests:** create from spec example → 8 logs, Squat has 3 undone sets of 185×5. Toggle all 3 squat sets → `exerciseStatus` `done`; toggle 2 → `partial`; none → `skipped`. `editSet` weight 190 on set 0 then toggle → actual 190 kept, `planned` unchanged. `setRoundsDone(tabata, 6)` → partial. `finish` sets `finishedAt` and status on all. Inputs never mutated (freeze input in test).
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: workout session model`.

### Task 7: Stores

**Files:** `src/store/settings.ts`, `src/store/data.ts`, `tests/store/data.test.ts`

**Interfaces:**
- Produces:
  `useSettings`: `{ units: Units; sound: boolean; vibration: boolean; flash: boolean; set(patch) }`, persisted key `workout.settings`.
  `useData`: `{ workouts: Workout[]; templates: Template[]; active: Workout | null; aliases: Record<string,string>; lastExportAt: string | null; startWorkout(w); updateActive(fn: (w: Workout) => Workout); finishActive(notes?); discardActive(); deleteWorkout(id); upsertWorkout(w); saveTemplate(t); deleteTemplate(id); setAlias(from, to); removeAlias(from); markExported(at); importWorkouts(ws: Workout[], aliases) }`, persisted key `workout.data`, version 1.
  `exportDue(state, now: Date): boolean` (Global Constraints rule).
  On first write, call `navigator.storage?.persist?.()` once. Wrap storage `setItem` so a thrown quota error sets `useData.getState().storageError = true` instead of crashing.

- [ ] **Step 1: Failing tests** (vitest with an in-memory `localStorage` shim): `startWorkout` then `updateActive(toggleSet…)` → persisted JSON contains the toggled set (resume after kill). New store instance rehydrates `active` including `timer.state.startedAt`. `finishActive` moves active to front of `workouts`, `active` null. `exportDue`: never exported + 1 workout → true; exported 13 days ago with a newer workout → false; 14 days → true; exported 30 days ago, no newer workouts → false. `setItem` throwing → `storageError` true, no throw.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: persisted stores`.

### Task 8: Export and import

**Files:** `src/export/markdown.ts`, `src/export/importFile.ts`, `src/export/share.ts`, `tests/export/export.test.ts`, `tests/fixtures/workouts.ts`

**Interfaces:**
- Consumes: `Workout`, `formatDuration`.
- Produces: `toMarkdown(workouts: Workout[], aliases: Record<string,string>, units: Units, now: Date): string`; `exportFileName(now: Date): string`; `parseExport(text: string): { ok: true; workouts: Workout[]; aliases: Record<string,string> } | { ok: false; message: string }` (reads the last ```` ```json ```` block, requires `formatVersion === 1`); `mergeWorkouts(existing: Workout[], incoming: Workout[]): Workout[]` (by id; on clash keep later `finishedAt`; result sorted newest `startedAt` first); `shareOrDownload(name: string, text: string): Promise<'shared'|'downloaded'>` (uses `navigator.canShare({files})`, falls back to an `<a download>`).

- [ ] **Step 1: Failing tests** with a fixture of 2 workouts (the spec's 2026-11-07 Leg day example, plus one older):
  - header line `Exported 2026-11-09 · 2 workouts · <first date> to 2026-11-07 · units: lb`.
  - Squat lines exactly: `- Squat — planned 3x5 @ 185, rest 120s`, `  - done: 185x5 ✓, 185x5 ✓, 185x4 ✓`, `  - note: last rep slow`.
  - `- Tabata — planned 8 x 20s/10s — done 8/8 rounds`; `- Hip mobility — skipped`; `- Easy run — planned 20 min — done 22 min, 2.1 mi`.
  - newest workout section appears before older.
  - `exportFileName(new Date('2026-11-09T10:00'))` → `workout-log-2026-11-09.md`.
  - round trip: `parseExport(toMarkdown(ws,…))` → same workouts and aliases.
  - `parseExport('hello')` → `ok:false`; wrong `formatVersion` → `ok:false` with message mentioning the version.
  - **Duplicate import:** `mergeWorkouts(ws, ws)` length 2; `mergeWorkouts([a], [a'])` where a' has later `finishedAt` keeps a'.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: markdown export and backup import`.

### Task 9: Trend series

**Files:** `src/trends/series.ts`, `tests/trends/series.test.ts`

**Interfaces:**
- Consumes: `Workout`, aliases.
- Produces:
  `normalizeName(name: string, aliases: Record<string,string>): string` (lowercase, trim, collapse spaces, then follow alias chain, cycle-safe);
  `exerciseNames(ws, aliases): { key: string; display: string; kind: Exercise['kind']; sessions: number }[]` sorted by most recent use;
  `exerciseSeries(ws, key, aliases, units: Units): { kind; points: { date: string; workoutId: string; values: Record<string, number> }[] }` with value keys per kind: strength `topWeight`, `volume`; intervals/hold/circuit `done`, `planned`; cardio `distance`, `paceMinPer` (only when distance > 0), `minutes`; other `minutes`. Skipped logs excluded. Weights converted to `units` (1 kg = 2.20462 lb, rounded to 0.1).
  `weeklySeries(ws, now: Date, weeks = 12): { weekStart: string; workouts: number; minutes: number }[]` (weeks start Monday, local time; minutes from `finishedAt - startedAt`; empty weeks included as zeros).

- [ ] **Step 1: Failing tests:** `normalizeName(' Back  Squat ', {'back squat':'squat'})` → `squat`; alias cycle `{a:'b', b:'a'}` terminates. "Squat" and " squat " in two workouts → one key with 2 sessions. Strength sets 185×5,185×5,185×4 → topWeight 185, volume 2775. Workout in kg (100×5) viewed in lb → topWeight 220.5. Cardio 22 min, 2.1 mi → paceMinPer ≈ 10.48. `weeklySeries` with workouts on Sun 2026-11-08 and Mon 2026-11-09, now 2026-11-09 → last two buckets each have 1 workout, length 12.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: trend series`.

### Task 10: Chart components

Load the `dataviz` skill before writing this task.

**Files:** `src/charts/LineChart.tsx`, `src/charts/BarChart.tsx`, `src/charts/Sparkline.tsx`, `src/charts/scale.ts`, `tests/charts/scale.test.ts`

**Interfaces:**
- Produces: `linearScale(domain: [number,number], range: [number,number]): (v:number)=>number`; `niceTicks(min, max, count = 4): number[]`. `<LineChart series={{ label: string; color: string; points: {x: string; y: number}[] }[]} unit?: string height?: number />` (labeled y-axis ticks, first/last x date labels, tap a point → value tooltip; one point renders as a dot with its value). `<BarChart bars={{label:string; value:number}[]} unit?: string />`. `<Sparkline values={number[]} />` (no axes, 64×20).
- [ ] **Step 1: Failing tests:** `niceTicks(0, 187)` → `[0, 50, 100, 150, 200]`; `niceTicks(5,5)` returns a non-empty range around 5; `linearScale([0,10],[0,100])(5)` → 50.
- [ ] **Step 2:** FAIL. **Step 3:** Implement scale + components; colors from CSS variables defined for dark and light. **Step 4:** PASS; `npm run build` passes.
- [ ] **Step 5:** Commit `feat: svg charts`.

### Task 11: Start, Paste, Workout, Finish screens

**Files:** `src/screens/Start.tsx`, `src/screens/Paste.tsx`, `src/screens/Workout.tsx`, `src/screens/Finish.tsx`, `src/screens/exercise/{StrengthView,IntervalsView,HoldView,CircuitView,CardioView,OtherView,RestTimer}.tsx`, `src/App.tsx` (wire routes, mount `<FlashOverlay/>`)

**Interfaces:**
- Consumes: Tasks 3–9.

Behavior (spec "Screens" / "Workout screen"): Start shows Resume when `active`, export banner when `exportDue`, last 3 workouts, buttons Paste plan / Templates. Paste: textarea, Parse → errors list (line N: text — message) or parsed preview (exercise name + summary per row) with Start and Save as template. Start calls `unlockAudio()`, `createWorkout`, `startWorkout`, navigates `#/workout`. Workout: header (title, elapsed, N of M, Prev/Next), the kind's view, notes, Skip; `useWakeLock(true)`; one `useNow` loop drives `view()` and `crossedCues()` → `fireCue`; timer state saved into `active.timer` via `updateActive` on every start/pause/skip/+15s. Checking a strength set starts `restPhases(restSec)` if `restSec`. Steppers ±5 (lb) / ±2.5 (kg), ±1 rep. Finish: per-exercise summary, notes, Save → `finishActive`, navigate `#/history/:id`; Discard with confirm.

- [ ] **Step 1:** Build the screens. Tap targets ≥ 48px; timer digits ≥ 30vw.
- [ ] **Step 2:** `npm run build` passes; `npm test` still passes.
- [ ] **Step 3:** Manual check via `npm run dev` + Playwright screenshot at Pixel 7 viewport of Paste (with an error), Workout strength, Workout intervals.
- [ ] **Step 4:** Commit `feat: workout flow screens`.

### Task 12: History, Templates, Trends, Settings screens

**Files:** `src/screens/{History,WorkoutDetail,Templates,TemplateEditor,Trends,ExerciseTrend,Settings}.tsx`

**Interfaces:**
- Consumes: Tasks 3, 7, 8, 9, 10.

Behavior: History list (date · title · duration · ✓ count), newest first. Detail: per exercise result line (same wording as export) + `Sparkline` of that exercise's primary value (`topWeight` / `done` / `distance` or `minutes`); Edit opens fields for notes and set values via session reducers + `upsertWorkout`; Delete with confirm. Templates list with Start / Edit / Duplicate / Delete; editor is a textarea validated by `parsePlan` on save. Trends: `BarChart` of `weeklySeries` (workouts, toggle to minutes), list from `exerciseNames` each with Sparkline; tap → ExerciseTrend with `LineChart` (strength: topWeight + volume as two charts; others per spec table) and session list; "Merge into…" picker calls `setAlias`, existing aliases listed with Undo. Settings: units, sound, vibration, flash toggles; Export (`toMarkdown` → `shareOrDownload` → `markExported`); Copy plan instructions (clipboard, toast "Copied"); Import backup (file input → `parseExport` → `importWorkouts`, report count or error); storage error banner when `storageError`.

- [ ] **Step 1:** Build the screens.
- [ ] **Step 2:** `npm run build` and `npm test` pass.
- [ ] **Step 3:** Playwright screenshots at Pixel 7 of Trends (seeded with fixture data), ExerciseTrend, Settings.
- [ ] **Step 4:** Commit `feat: history, templates, trends, settings`.

### Task 13: End-to-end smoke test and README

**Files:** `e2e/smoke.spec.ts`, `playwright.config.ts`, `package.json` (script `e2e`), `README.md`

- [ ] **Step 1: Test** `e2e/smoke.spec.ts` against `vite preview` at Pixel 7: clock installed via `page.clock.install()`; paste the spec example; Parse; Start; check 3 Squat sets (asserts rest timer visible after first); advance to Tabata, Start, `page.clock.runFor(16*30*1000)` → shows done 8/8; Next through the rest, skipping Hip mobility; Finish → Save; History shows 1 workout; reload page → still there (persistence); Settings → Export with `canShare` stubbed false → captured download name matches `workout-log-\d{4}-\d{2}-\d{2}\.md` and content contains `- Squat — planned 3x5 @ 185, rest 120s` and `"formatVersion": 1`. Second test: reload in the middle of a rest timer → Workout screen shows the same exercise and a running rest timer.
- [ ] **Step 2:** `npm run build && npx playwright test --trace off` → PASS.
- [ ] **Step 3:** README: what it is, install on Android (Chrome → ⋮ → Install app), using with Claude (copy instructions, paste plans, export log), data lives on phone only, dev commands.
- [ ] **Step 4:** Commit `test: e2e smoke; docs: README`. Push `main`; confirm the Pages workflow run succeeds and `https://tatrogar.github.io/workout/` loads.
