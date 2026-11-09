# Workout app — design

Date: 2026-11-09
Status: draft for review

## Purpose

A phone app for doing workouts: interval and rest timers, a checkbox for every
set, and a history that exports as one file to hand to Claude for planning and
feedback. Claude lives in a normal chat; the app has no AI in it.

**What the owner said**

- Plan workouts with Claude, do them in the app, review them with Claude.
- Built-in interval timers and checkboxes.
- Mostly a phone (Android), sometimes a computer. Must work with no signal.
- No server. No TickTick or other sync. Data goes to Claude as an exported file.
- Plans mostly come from Claude by paste; editing in the app is a secondary path.
- Log strength, intervals, circuits/holds, cardio, and other (mobility, sport, class).
- No effort/RPE for now, but keep room for it.
- Pounds by default.

**Assumptions (not stated, chosen as defaults)**

- One user, one phone. No accounts, no sharing.
- Durability is the owner's job via export; the app nudges.
- Public GitHub repo, deployed to GitHub Pages like the Classroom app.

**Success looks like**

- At the gym with no signal: paste or pick a plan, run it start to finish with
  timers and checkboxes, save it.
- Export produces a file Claude can read and give specific feedback from
  (planned vs. done, trends over weeks).
- A plan Claude writes from the instruction text pastes in without errors most
  of the time, and when it doesn't, the app says which line and why.

## Screens

Routes are hash-based (`#/...`) so GitHub Pages needs no rewrite rules.

| Route | Screen |
|---|---|
| `#/` | **Start.** Paste a plan, pick a template, or resume an unfinished workout. Last few workouts listed. Export reminder banner when due. |
| `#/paste` | **Paste plan.** Text box, Parse button, parse errors shown inline by line number. On success, shows the parsed workout to review/edit, then Start or Save as template. |
| `#/workout` | **Workout.** The active workout, one exercise at a time. |
| `#/finish` | **Finish.** Summary, whole-workout notes, Save. |
| `#/history` | **History.** Past workouts, newest first. Tap to view; edit or delete from there. |
| `#/history/:id` | **Workout detail.** Read-only view with Edit and Delete. |
| `#/templates` | **Templates.** Saved plans; create, edit, duplicate, delete, start. |
| `#/templates/:id` | **Template editor.** Edit as plan text (same format as paste) — one editor, one parser, no separate form UI. |
| `#/settings` | **Settings.** Units (lb/kg), sound on/off, vibration on/off, Export, Copy plan instructions for Claude, Import a backup. |

### Workout screen

Large type, big tap targets, usable with sweaty hands. Screen Wake Lock is held
while this screen is open.

Top: workout title, elapsed time, exercise N of M, Prev / Next.
Every exercise: a notes field, Skip, and (where it makes sense) Add set.

- **Strength** — one row per set: checkbox, weight, reps. Weight and reps are
  prefilled from the plan and tappable to change (stepper ±5 lb / ±1 rep, or
  type). Checking a set records actual weight/reps and starts the rest timer.
  Rest timer shows over the bottom of the screen with +15s and Skip.
- **Intervals** — big countdown, WORK / REST label with distinct colors, round
  N of M, Start/Pause, Skip round. Beep + vibrate at each switch, short beeps at
  3-2-1. Records rounds completed.
- **Circuit** — steps through moves in order, round after round. Timed moves
  count down; rep moves show a Done button. Rest between rounds if set. Records
  rounds completed and per-move actuals.
- **Hold** — countdown per set with rest between, checkbox per set.
- **Cardio** — stopwatch (Start/Pause/Stop) or type the duration; optional
  distance. Records duration and distance.
- **Other** — target duration shown, a Done checkbox, optional actual duration.

Leaving the workout screen does not end the workout; Start shows Resume.

## Plan format

Plain text Claude writes and the owner pastes. Lines are trimmed; blank lines
ignored; keywords are case-insensitive.

```
# Leg day                                  ← optional title (default: date)

## Squat                                   ← starts an exercise
strength: 3x5 @ 185 lb, rest 120s
note: pause at the bottom                  ← optional, any exercise

## Bench press
sets: 135x8, 155x6, 175x4, rest 90s

## Pull-ups
strength: 3x8, rest 90s                    ← no @ means bodyweight

## Tabata
intervals: 8 x 20s work / 10s rest

## Plank
hold: 3 x 45s, rest 30s

## Core circuit
circuit: 3 rounds, rest 60s
- Plank 45s
- Dead bug 10 reps
- Side plank 30s

## Easy run
cardio: 20 min, 2 mi                       ← distance optional

## Hip mobility
other: 10 min
```

**Grammar**

- Durations: `45s`, `90 s`, `2 min`, `2min`, `1:30`.
- Weight: number, optional `lb` or `kg` (default: the units setting).
- `strength: <sets>x<reps> [@ <weight>] [, rest <duration>]`
- `sets: <weight>x<reps>, <weight>x<reps>, ... [, rest <duration>]`
- `intervals: <rounds> x <duration> work / <duration> rest`
- `hold: <sets> x <duration> [, rest <duration>]`
- `circuit: <rounds> rounds [, rest <duration>]` followed by one or more
  `- <move name> <duration | N reps>` lines.
- `cardio: <duration> [, <distance> mi|km]`
- `other: <duration>`
- `note: <text>`

**Errors.** Parsing never guesses. Any line that doesn't match produces an error
naming the line number, the line, and what was expected (e.g.
`Line 7: "strength: 3 by 5" — expected like "3x5 @ 185 lb"`). Nothing starts
until the plan parses cleanly.

**Instructions for Claude.** Settings → *Copy plan instructions for Claude*
copies a short text: what the app is, the format above with the example, and
"reply with only the plan in a code block." The owner pastes it into a chat
once, or keeps it in a Claude Project.

## Export file

Settings → Export creates `workout-log-YYYY-MM-DD.md` and opens the Android
share sheet (Web Share API with a file), so it can go to Files, Drive, or the
Claude app directly. Fallback where sharing isn't supported: a normal download.

Contents, newest workout first:

````
# Workout log
Exported 2026-11-09 · 14 workouts · 2026-10-01 to 2026-11-07 · units: lb

## 2026-11-07 · Leg day · 52 min
Notes: Slept badly.

- Squat — planned 3x5 @ 185, rest 120s
  - done: 185x5 ✓, 185x5 ✓, 185x4 ✓
  - note: last rep slow
- Tabata — planned 8 x 20s/10s — done 8/8 rounds
- Core circuit — planned 3 rounds — done 3/3
- Easy run — planned 20 min — done 22 min, 2.1 mi
- Hip mobility — skipped

## 2026-11-05 · ...

---

Raw data (format version 1):

```json
{ "formatVersion": 1, "exportedAt": "...", "units": "lb", "workouts": [ ... ] }
```
````

- The readable part is for skimming; the JSON block is the same data exactly,
  for Claude to compute from.
- Every exercise carries both `planned` and `actual`, because planned-vs-done is
  where feedback comes from.
- `formatVersion` lets later fields (e.g. `rpe` on a set) be added without
  breaking old exports.
- **Import a backup** (Settings) reads an exported file's JSON block and merges
  by workout id. This is the restore path for a new phone or cleared data.

**Export reminder.** If there are workouts newer than the last export and the
last export was 14+ days ago (or never), Start shows a banner with an Export
button.

## Data model

```ts
type Units = 'lb' | 'kg';
type Seconds = number;

type Exercise =
  | { kind: 'strength'; name: string; note?: string; restSec?: Seconds;
      sets: { weight?: number; reps: number }[] }            // planned sets
  | { kind: 'intervals'; name: string; note?: string;
      rounds: number; workSec: Seconds; restSec: Seconds }
  | { kind: 'hold'; name: string; note?: string; restSec?: Seconds;
      sets: number; holdSec: Seconds }
  | { kind: 'circuit'; name: string; note?: string; restSec?: Seconds;
      rounds: number;
      moves: { name: string; sec?: Seconds; reps?: number }[] }
  | { kind: 'cardio'; name: string; note?: string;
      durationSec: Seconds; distance?: number; distanceUnit?: 'mi' | 'km' }
  | { kind: 'other'; name: string; note?: string; durationSec: Seconds };

type Plan = { title?: string; units: Units; exercises: Exercise[] };

type ExerciseLog = {
  planned: Exercise;
  status: 'done' | 'partial' | 'skipped';
  notes?: string;
  // one of, matching planned.kind:
  sets?: { weight?: number; reps: number; done: boolean; at?: string }[];
  holds?: { sec: Seconds; done: boolean }[];
  roundsDone?: number;
  durationSec?: Seconds;
  distance?: number;
};

type Workout = {
  id: string;            // random uuid
  title: string;
  startedAt: string;     // ISO
  finishedAt?: string;   // absent = in progress
  units: Units;
  notes?: string;
  exercises: ExerciseLog[];
  planText: string;      // the original pasted text, kept for reference
};

type Template = { id: string; name: string; planText: string; updatedAt: string };
```

Templates store plan text, not parsed objects, so the one parser is the only
way plans become workouts.

## Architecture

Same stack as the Classroom app: React 18, Vite, TypeScript, Tailwind, zustand,
vite-plugin-pwa, Vitest. Static build deployed to GitHub Pages by a GitHub
Actions workflow on push to `main` (copied from the Classroom app's
`deploy.yml`). Vite `base` set to `/workout/`.

Units, each testable alone:

| Unit | Does | Depends on |
|---|---|---|
| `plan/parse.ts` | Plan text → `Plan` or a list of line errors. Pure. | nothing |
| `plan/instructions.ts` | The "instructions for Claude" text. | nothing |
| `timer/engine.ts` | Countdown/stopwatch/interval sequences computed from stored start/end timestamps and pause offsets. Pure: given state and `now`, returns phase, remaining, round. | nothing |
| `timer/cues.ts` | Beep (Web Audio) and vibrate (Vibration API), respecting settings. | browser |
| `store/` | zustand stores with `persist` to localStorage: workouts, templates, active workout, settings, lastExportAt. Requests `navigator.storage.persist()` on first save. | zustand |
| `export/markdown.ts` | `Workout[]` → export file text. Pure. | nothing |
| `export/import.ts` | Export file text → `Workout[]` (reads the JSON block). Pure. | nothing |
| `screens/` | The routes above. | all of the above |

**Timers survive locking and app switches** because nothing counts ticks: the
engine stores when a phase started and recomputes from the clock. On return to
the app, the display jumps to the right place; any cues missed while hidden are
not replayed.

**Active workout saves on every change**, so a killed tab resumes mid-set.

**Offline**: the service worker precaches the whole app; after one install
with signal, it runs with none.

## Platform notes (Android, Chrome)

- Vibration API and Screen Wake Lock both work in installed Chrome PWAs.
- Audio needs one user tap before it can play; Start counts as that tap.
- With the screen off, timers stay correct but beeps/vibration may not fire.
  Wake Lock keeps the screen on during a workout to avoid this (costs battery).
- Clearing Chrome site data or losing the phone deletes everything not exported.

## Error handling

- Parse errors: listed by line, nothing starts until clean.
- Import errors: file has no readable JSON block or wrong `formatVersion` →
  message, nothing changed.
- Storage write failure (quota): visible error banner telling the owner to
  export now.
- Share sheet unavailable: falls back to download.

## Testing

- Vitest unit tests: parser (every line type, every duration form, bad input
  and error messages), timer engine (phase/round/remaining at given times,
  pause/resume), exporter (fixture workouts → expected Markdown), import
  (round-trip export → import gives the same workouts).
- Playwright smoke test at a phone viewport against the built app: paste the
  example plan, check strength sets, run a short interval to completion with a
  mocked clock, finish, export, confirm the file content.
- Real check: the owner at the gym on their phone.

## Out of scope for v1

Effort/RPE (format leaves room), charts, sync between devices, GPS, accounts,
any AI in the app, exercise library/autocomplete, plate calculator.
