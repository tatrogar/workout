# Workout

An offline workout app for Android. You plan workouts with Claude, run them here
with timers and checkboxes, then export the log and give it back to Claude for
feedback. There's no server and no account. Everything stays on your phone until
you export it.

Live at **https://tatrogar.github.io/workout/** once deployed.

## Install on your phone

1. Open the link above in **Chrome** while you have signal.
2. Tap **⋮ → Install app** (or *Add to Home screen*).
3. Open it from the home screen. From then on it works with no signal.

## Using it with Claude

1. **Settings → Copy plan instructions for Claude.** Paste the instructions into
   a Claude chat once, or keep them in a Claude Project so they're always there.
2. Ask Claude for a workout. It replies with a plan in a code block.
3. Copy the plan, then in the app go to **Start → Paste plan → Check plan → Start
   workout**. If a line can't be read, the app tells you which line and what it
   expected.
4. Do the workout:
   - **Strength:** check off each set. Tap the numbers to change weight or reps.
     Checking a set starts the rest timer.
   - **Intervals, holds, circuits:** tap Start. Each phase change gives a chime,
     a vibration, and a screen flash (each can be turned off in Settings).
   - **Cardio:** use the stopwatch, or type in the minutes and distance.
5. Tap **Finish**, add a note, and save.
6. **Settings → Export log** shares one Markdown file, `workout-log-YYYY-MM-DD.md`.
   Send it to the Claude app and ask how things are going.

The Trends tab graphs each exercise over time, plus workouts and minutes per
week. If the same exercise was logged under two names ("Squat" and "Back
squat"), open one of them in Trends and merge it into the other.

### Plan format

```
# Leg day

## Squat
strength: 3x5 @ 185 lb, rest 120s
note: pause at the bottom

## Bench press
sets: 135x8, 155x6, 175x4, rest 90s

## Tabata
intervals: 8 x 20s work / 10s rest

## Plank
hold: 3 x 45s, rest 30s

## Core circuit
circuit: 3 rounds, rest 60s
- Plank 45s
- Dead bug 10 reps

## Easy run
cardio: 20 min, 2 mi

## Hip mobility
other: 10 min
```

## Your data

- Workouts are saved in the browser on your phone. **Clearing Chrome's site data
  or losing the phone deletes anything you haven't exported.** The Start screen
  reminds you to export after two weeks.
- **Settings → Import a backup** reads an exported file back in, for example on
  a new phone. Importing the same file twice doesn't create duplicates.

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # unit tests (Vitest)
npm run build      # production build into dist/
npm run e2e        # end-to-end test on a phone-sized browser (Playwright)
```

Every push to `main` deploys to GitHub Pages through
`.github/workflows/deploy.yml`. The design is in `docs/superpowers/specs/` and
the build plan is in `docs/superpowers/plans/`.
