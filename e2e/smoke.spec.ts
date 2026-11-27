import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const PLAN = readFileSync(new URL("../tests/plan/example.ts", import.meta.url), "utf8").split("`")[1];

async function startPlan(page: Page) {
  await page.goto("#/paste");
  await page.locator("textarea").fill(PLAN);
  await page.getByRole("button", { name: "Check plan" }).click();
  await page.getByRole("button", { name: "Start workout" }).click();
  await expect(page).toHaveURL(/#\/workout/);
  await page.getByRole("button", { name: "Start session" }).click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, "canShare", { value: undefined }); });
  await page.clock.install({ time: new Date("2026-11-07T12:00:00") });
});

test("a whole workout, saved and exported", async ({ page }) => {
  await startPlan(page);
  await expect(page.getByRole("heading", { name: "Squat" })).toBeVisible();

  await page.getByRole("checkbox", { name: "Set 1 done" }).click();
  await expect(page.getByTestId("rest-timer")).toBeVisible();
  await page.getByRole("checkbox", { name: "Set 2 done" }).click();
  await page.getByRole("checkbox", { name: "Set 3 done" }).click();

  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Next ›" }).click();
  await expect(page.getByRole("heading", { name: "Tabata" })).toBeVisible();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.clock.runFor(240_000);
  await expect(page.getByText("Rounds done: 8 / 8")).toBeVisible();

  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Next ›" }).click();
  await expect(page.getByRole("heading", { name: "Hip mobility" })).toBeVisible();
  await page.getByRole("button", { name: "Skip exercise" }).click();
  await page.getByRole("button", { name: "Finish" }).last().click();

  await page.getByRole("button", { name: "Save workout" }).click();
  await expect(page).toHaveURL(/#\/history\/.+/);
  await expect(page.getByText("done 8/8 rounds")).toBeVisible();

  await page.goto("#/history");
  await expect(page.getByRole("link", { name: /Leg day/ })).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole("link", { name: /Leg day/ })).toHaveCount(1);

  await page.goto("#/settings");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export everything (backup)" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^workout-log-\d{4}-\d{2}-\d{2}\.md$/);
  const text = readFileSync((await file.path())!, "utf8");
  expect(text).toContain("- Squat — planned 3x5 @ 185, rest 120s");
  expect(text).toContain("- Tabata — planned 8 x 20s/10s — done 8/8 rounds");
  expect(text).toContain("- Hip mobility — skipped");
  expect(text).toContain('"formatVersion":1');
});

test("reloading mid-rest resumes the same exercise and timer", async ({ page }) => {
  await startPlan(page);
  await page.getByRole("checkbox", { name: "Set 1 done" }).click();
  await page.clock.runFor(30_000);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Squat" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Set 1 done" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("rest-timer")).toContainText(/1:(1\d|2\d|30)/);
});

test("a hold you untick stays unticked when you come back", async ({ page }) => {
  await startPlan(page);
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Next ›" }).click();
  await expect(page.getByRole("heading", { name: "Plank" })).toBeVisible();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.clock.runFor(56_000);
  await expect(page.getByRole("checkbox", { name: "Hold 1 done" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("checkbox", { name: "Hold 1 done" }).click();
  await page.getByRole("button", { name: "‹ Prev" }).click();
  await page.getByRole("button", { name: "Next ›" }).click();
  await expect(page.getByRole("checkbox", { name: "Hold 1 done" })).toHaveAttribute("aria-checked", "false");
});

test("starting a timer while another runs asks first", async ({ page }) => {
  await startPlan(page);
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Next ›" }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "Next ›" }).click();
  let asked = "";
  page.once("dialog", (d) => { asked = d.message(); void d.dismiss(); });
  await page.getByRole("button", { name: "Start", exact: true }).click();
  expect(asked).toContain("Tabata");
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
});

test("a corrupted saved workout shows a way out, not a blank page", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("workout.data", JSON.stringify({ version: 1, state: {
      workouts: [{ id: "bad", title: "Bad", startedAt: "2026-11-01T12:00:00Z", finishedAt: "2026-11-01T13:00:00Z", units: "lb", planText: "", exercises: [{ status: "done" }] }],
      templates: [], active: null, aliases: {}, lastExportAt: null } }));
  });
  await page.goto("#/history/bad");
  await expect(page.getByRole("heading", { name: "This screen hit a problem" })).toBeVisible();
  await page.getByRole("link", { name: "Back to Start" }).click();
  await expect(page.getByRole("heading", { name: "Workout" })).toBeVisible();
});

const WARMUP = "# Short\n\n## Warm-up\nother: 5 min\n\n## Easy run\ncardio: 2 min\n\n## Squat\nstrength: 2x5 @ 185 lb\n";

async function pastePlan(page: Page, text: string) {
  await page.goto("#/paste");
  await page.locator("textarea").fill(text);
  await page.getByRole("button", { name: "Check plan" }).click();
}

test("nothing works until Start session, then the session clock runs", async ({ page }) => {
  await pastePlan(page, WARMUP);
  await page.getByRole("button", { name: "Start workout" }).click();
  await expect(page.getByRole("button", { name: "Start session" })).toBeVisible();
  await expect(page.getByTestId("session-clock")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Next ›" })).toHaveCount(0);
  await page.clock.runFor(60_000);
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page.getByTestId("session-clock")).toHaveText(/^[0-3]s$/);
  await page.clock.runFor(125_000);
  await expect(page.getByTestId("session-clock")).toHaveText(/^2:0\d$/);
});

test("a warm-up counts down and checks itself off; cardio keeps counting past zero", async ({ page }) => {
  await pastePlan(page, WARMUP);
  await page.getByRole("button", { name: "Start workout" }).click();
  await page.getByRole("button", { name: "Start session" }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.clock.runFor(100_000);
  await expect(page.getByTestId("timer")).toHaveText(/^3:[12]\d$/);
  await page.clock.runFor(205_000);
  await expect(page.getByRole("checkbox", { name: "Done" })).toHaveAttribute("aria-checked", "true");

  await page.getByRole("button", { name: "Next ›" }).click();
  await page.getByRole("button", { name: "Start countdown" }).click();
  await page.clock.runFor(150_000);
  await expect(page.getByTestId("timer")).toHaveText(/^\+(2\d|3\d)s$/);
  await page.getByRole("button", { name: "Next ›" }).click();
  await page.getByRole("button", { name: "‹ Prev" }).click();
  await expect(page.getByRole("textbox", { name: "Minutes" })).toHaveValue("2.5");
});

test("prose pasted from a chat gets one clear message", async ({ page }) => {
  await pastePlan(page, "Week 1 · Run + Bodyweight B\n\nWarm-up: bike 3 min, squats x10\nJog 1 min / walk 2 min x8\nStretch");
  await expect(page.getByRole("heading", { name: "This isn't in the workout-app format" })).toBeVisible();
  await expect(page.getByTestId("parse-errors")).toHaveCount(0);
});

test("effort, plates and last time", async ({ page }) => {
  for (const day of [1, 2]) {
    await pastePlan(page, "# Lift\n\n## Squat\nstrength: 1x5 @ " + (day === 1 ? 185 : 190) + " lb\n");
    await page.getByRole("button", { name: "Start workout" }).click();
    await page.getByRole("button", { name: "Start session" }).click();
    if (day === 2) await expect(page.getByTestId("last-time")).toContainText("185x5 ✓");
    await page.getByRole("checkbox", { name: "Set 1 done" }).click();
    await page.getByRole("radio", { name: "Effort 7" }).click();
    await page.getByRole("button", { name: "Plates" }).click();
    await expect(page.getByTestId("plates")).toContainText(day === 1 ? "45 + 25 per side" : "45 + 25 + 2.5 per side");
    await page.getByRole("button", { name: "Finish" }).last().click();
    if (day === 2) await expect(page.getByTestId("bests")).toContainText("Squat: 190 lb, up from 185");
    await expect(page.getByText("effort: 7/10")).toBeVisible();
    await page.getByRole("button", { name: "Save workout" }).click();
    await page.clock.runFor(3_600_000);
  }
});

test("exercise list: jump, add, move, remove", async ({ page }) => {
  await pastePlan(page, WARMUP);
  await page.getByRole("button", { name: "Start workout" }).click();
  await page.getByRole("button", { name: "Start session" }).click();
  await page.getByRole("button", { name: "Exercise list" }).click();
  await page.getByRole("textbox", { name: "New exercise" }).fill("## Leg press\nstrength: 3x10 @ 200 lb");
  await page.getByRole("button", { name: "Add after current" }).click();
  await page.getByRole("button", { name: "Move Leg press down" }).click();
  await page.getByRole("button", { name: "Remove Easy run" }).click();
  await page.getByRole("button", { name: "Go to Leg press" }).click();
  await expect(page.getByRole("heading", { name: "Leg press" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Exercise list" })).toContainText("Exercise 2 of 3");
});

test("default rest applies when the plan has none, and Settings can turn things off", async ({ page }) => {
  await pastePlan(page, "## Squat\nstrength: 2x5 @ 185 lb");
  await page.getByRole("button", { name: "Start workout" }).click();
  await page.getByRole("button", { name: "Start session" }).click();
  await page.getByRole("checkbox", { name: "Set 1 done" }).click();
  await expect(page.getByTestId("rest-timer")).toContainText(/1:(30|2\d)/);
  await expect(page.getByRole("radiogroup", { name: "Effort" })).toBeVisible();

  await page.goto("#/settings");
  await page.getByLabel("Default rest after a set").uncheck();
  await page.getByLabel("Effort rating").uncheck();
  await page.getByLabel("Plates button").uncheck();
  await page.goto("#/workout");
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.getByRole("checkbox", { name: "Set 2 done" }).click();
  await expect(page.getByTestId("rest-timer")).toHaveCount(0);
  await expect(page.getByRole("radiogroup", { name: "Effort" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Plates" })).toHaveCount(0);
});

test("copy for Claude and continue a finished workout", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await pastePlan(page, "# Lift\n## Squat\nstrength: 2x5 @ 185 lb, rest 60s");
  await page.getByRole("button", { name: "Start workout" }).click();
  await page.getByRole("button", { name: "Start session" }).click();
  await page.getByRole("checkbox", { name: "Set 1 done" }).click();
  await page.clock.runFor(10 * 60_000);
  await page.getByRole("button", { name: "Finish" }).first().click();
  await page.getByRole("button", { name: "Save workout" }).click();
  await page.getByRole("button", { name: "Copy for Claude" }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("- Squat — planned 2x5 @ 185, rest 60s");
  expect(copied).toContain("185x5 ✓, 185x5 ✗");
  expect(copied).not.toContain("json");

  await page.clock.runFor(60 * 60_000);
  await page.getByRole("button", { name: "Continue this workout" }).click();
  await expect(page.getByTestId("session-clock")).toHaveText(/^10:0\d$/);
  await expect(page.getByRole("checkbox", { name: "Set 1 done" })).toHaveAttribute("aria-checked", "true");
});


test("quick timer runs without a workout", async ({ page }) => {
  await page.goto("#/timer");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.clock.runFor(6_000);
  await expect(page.getByText("WORK")).toBeVisible();
  await page.clock.runFor(8 * 30_000);
  await expect(page.getByRole("button", { name: "Reset" })).toBeVisible();
  await page.goto("#/history");
  await expect(page.getByText("Finished workouts show up here.")).toBeVisible();
});

const SIDE_PLAN = "# Sides\n\n## Core\ncircuit: 1 round\n- Side plank 20s/side\n- Lunges 6 reps/side\n\n## Side hold\nhold: 1 x 20s/side\n\n## Split squat\nstrength: 1x10/side @ 25 lb, rest 60s\n";

test("per-side: hands-free side plank, short sides logged, export shows both", async ({ page }) => {
  await pastePlan(page, SIDE_PLAN);
  await page.getByRole("button", { name: "Start workout" }).click();
  await page.getByRole("button", { name: "Start session" }).click();

  // Circuit: Left 20s → Switch 5s → Right 20s with no taps, then the rep move.
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.clock.runFor(10_000);
  await expect(page.getByText("LEFT", { exact: true })).toBeVisible();
  await page.clock.runFor(12_000);
  await expect(page.getByText("SWITCH SIDES", { exact: true })).toBeVisible();
  await page.clock.runFor(8_000);
  await expect(page.getByText("RIGHT", { exact: true })).toBeVisible();
  await page.clock.runFor(20_000);
  await expect(page.getByTestId("rep-sides")).toBeVisible();
  await page.getByRole("button", { name: "Right reps minus 1" }).click();
  await page.getByRole("button", { name: "Done ✓" }).click();
  await expect(page.getByText("Circuit done")).toBeVisible();

  // Hold: Left full, Right stopped early at ~12s.
  await page.getByRole("button", { name: "Next ›" }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.clock.runFor(5_000 + 20_000 + 5_000 + 12_000);
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(page.getByTestId("hold-1-sides")).toHaveText(/L 20 · R 1[12]/);

  // Strength: Left 10, Right 8; rest starts only after both.
  await page.getByRole("button", { name: "Next ›" }).click();
  await page.getByRole("checkbox", { name: "Set 1 left done" }).click();
  await expect(page.getByTestId("rest-timer")).toHaveCount(0);
  await page.getByRole("button", { name: "Set 1 right reps minus 1" }).click();
  await page.getByRole("button", { name: "Set 1 right reps minus 1" }).click();
  await page.getByRole("checkbox", { name: "Set 1 right done" }).click();
  await expect(page.getByTestId("rest-timer")).toBeVisible();

  await page.getByRole("button", { name: "Finish" }).first().click();
  await page.getByRole("button", { name: "Save workout" }).click();
  await page.goto("#/settings");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export everything (backup)" }).click();
  const text = readFileSync((await (await download).path())!, "utf8");
  expect(text).toContain("  - moves: Side plank 20s/side, Lunges 6 reps/side");
  expect(text).toContain("  - Side plank round 1: L 20s, R 20s");
  expect(text).toContain("  - Lunges round 1: L 6, R 5");
  expect(text).toMatch(/- Side hold — planned 1 x 20s\/side — done L 20s R 1[12]s/);
  expect(text).toContain("- Split squat — planned 1x10/side @ 25, rest 60s");
  expect(text).toContain("  - done: 25x L10 R8 ✓");
});

test("plans without /side run exactly as before", async ({ page }) => {
  await pastePlan(page, "## Core\ncircuit: 1 round\n- Plank 20s\n## Hold\nhold: 1 x 20s");
  await page.getByRole("button", { name: "Start workout" }).click();
  await page.getByRole("button", { name: "Start session" }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.clock.runFor(10_000);
  await expect(page.getByText("GO", { exact: true })).toBeVisible();
  await expect(page.getByText("SWITCH SIDES")).toHaveCount(0);
  await page.clock.runFor(12_000);
  await expect(page.getByText("Circuit done")).toBeVisible();
});

const VID = "dQw4w9WgXcQ";

test("videos: add a link, watch it in a workout, offline message, backup", async ({ page, context }) => {
  // Block the real player so the test never touches YouTube.
  await context.route("**/*youtube-nocookie.com/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<p>player</p>" }));
  await pastePlan(page, "# Day\n## Squat\nstrength: 1x5 @ 185 lb\n## Core\ncircuit: 1 round\n- Side plank 20s/side\n- Plank 30s");

  await expect(page.getByRole("button", { name: "Start workout" })).toBeVisible();
  await page.getByRole("link", { name: "Exercises" }).click();
  // The pasted plan isn't saved yet, so add the name by hand.
  await page.getByRole("textbox", { name: "New exercise name" }).fill("Squat");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("textbox", { name: "YouTube link for Squat" }).fill("https://vimeo.com/1");
  await expect(page.getByText("That isn't a YouTube video link.")).toBeVisible();
  await page.getByRole("textbox", { name: "YouTube link for Squat" }).fill(`https://youtu.be/${VID}?t=1m35s`);
  await expect(page.getByText("starts at 1:35")).toBeVisible();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Edit video for Squat" })).toContainText("▶ video");

  await page.getByRole("textbox", { name: "New exercise name" }).fill("side  PLANK");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("textbox", { name: /YouTube link for/ }).fill(`https://www.youtube.com/watch?v=${VID}`);
  await page.getByRole("button", { name: "Save" }).click();

  await page.goto("#/paste");
  await page.getByRole("button", { name: "Check plan" }).click();
  await page.getByRole("button", { name: "Start workout" }).click();
  await page.getByRole("button", { name: "Start session" }).click();
  await page.getByRole("button", { name: "Show video for Squat" }).click();
  const frame = page.getByTestId("video-player").locator("iframe");
  await expect(frame).toHaveAttribute("src", `https://www.youtube-nocookie.com/embed/${VID}?start=95&playsinline=1&rel=0`);
  await page.getByRole("button", { name: "Hide video for Squat" }).click();
  await expect(page.getByTestId("video-player")).toHaveCount(0);

  await page.getByRole("button", { name: "Next ›" }).click();
  await expect(page.getByRole("button", { name: "Show video for Side plank" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show video for Plank" })).toHaveCount(0);

  await context.setOffline(true);
  await page.getByRole("button", { name: "Show video for Side plank" }).click();
  await expect(page.getByTestId("video-offline")).toBeVisible();
  await context.setOffline(false);

  await page.getByRole("button", { name: "Finish" }).first().click();
  await page.getByRole("button", { name: "Save workout" }).click();
  await page.goto("#/settings");
  let download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export everything (backup)" }).click();
  const backup = readFileSync((await (await download).path())!, "utf8");
  expect(backup).toContain(`"videos":{"squat":{"id":"${VID}","start":95},"side plank":{"id":"${VID}"}}`);
  download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export last 4 weeks (for Claude)" }).click();
  expect(readFileSync((await (await download).path())!, "utf8")).not.toContain('"videos"');

  // Restore on a "new phone": wipe storage, import the backup.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId("import-file").setInputFiles({ name: "backup.md", mimeType: "text/markdown", buffer: Buffer.from(backup) });
  await expect(page.getByRole("status")).toContainText("Imported");
  await page.goto("#/exercises");
  await expect(page.getByRole("button", { name: "Edit video for Squat" })).toContainText("▶ video");
});

test("exercises can be taken off the list, stay off, and come back", async ({ page }) => {
  await pastePlan(page, "# Day\n## Squat\nstrength: 1x5\n## Cooldown\nother: 5 min");
  page.once("dialog", (d) => void d.accept("Day"));
  await page.getByRole("button", { name: "Save as template" }).click();
  await expect(page.getByRole("button", { name: "Saved ✓" })).toBeVisible();
  await page.goto("#/exercises");
  await expect(page.getByRole("button", { name: "Edit video for Cooldown" })).toBeVisible();
  await page.getByRole("button", { name: "Remove Cooldown from the list" }).click();
  await expect(page.getByRole("button", { name: "Edit video for Cooldown" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit video for Squat" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Edit video for Cooldown" })).toHaveCount(0);
  await page.getByText("Hidden (1)").click();
  await page.getByRole("button", { name: "Bring back Cooldown" }).click();
  await expect(page.getByRole("button", { name: "Edit video for Cooldown" })).toBeVisible();
});

test("checking a pasted plan puts its exercises on the Exercises list", async ({ page }) => {
  await pastePlan(page, "# New\n## Romanian deadlift\nstrength: 3x8 @ 135 lb\n## Core\ncircuit: 1 round\n- Bird dog 8 reps/side\n## Cooldown\nother: 5 min");
  await expect(page.getByRole("button", { name: "Start workout" })).toBeVisible();
  await page.goto("#/exercises");
  for (const n of ["Romanian deadlift", "Core", "Bird dog", "Cooldown"]) await expect(page.getByRole("button", { name: `Edit video for ${n}` })).toBeVisible();
  await page.getByRole("button", { name: "Remove Cooldown from the list" }).click();
  await pastePlan(page, "## Cooldown\nother: 5 min");
  await page.goto("#/exercises");
  await expect(page.getByRole("button", { name: "Edit video for Cooldown" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Edit video for Bird dog" })).toBeVisible();
});


const SAMPLE = `# Mon · Upper
## Warm-up
other: 5 min
# Tue · Intervals
## Bike intervals
intervals: 6 x 1 min work / 2 min rest
# Wed · Home mobility
## Cat-cow
strength: 1x8`;

// The clock is fixed at Sat 2026-11-07 (see beforeEach).
const day = (page: Page, label: string) => page.getByRole("button", { name: new RegExp(`^${label}(:|,|$)`) });

test("calendar: the sample week lands on Mon/Tue/Wed with a preview, then move, copy, delete", async ({ page }) => {
  await page.goto("#/calendar");
  await expect(page.getByTestId("calendar-heading")).toHaveText("November 2026");
  await day(page, "Mon Nov 9").click();
  await page.getByRole("textbox", { name: "Plan to schedule" }).fill(SAMPLE);
  await page.getByRole("button", { name: "Check plan" }).click();
  await expect(page.getByTestId("schedule-preview")).toHaveText(/Mon Nov 9 — Mon · Upper.*Tue Nov 10 — Tue · Intervals.*Wed Nov 11 — Wed · Home mobility/);
  await page.getByRole("button", { name: "Save to calendar" }).click();
  await expect(day(page, "Mon Nov 9: Mon · Upper")).toBeVisible();
  await expect(day(page, "Tue Nov 10: Tue · Intervals")).toContainText("Intervals");
  await expect(day(page, "Wed Nov 11: Wed · Home mobility")).toBeVisible();

  await page.getByRole("button", { name: "Week" }).click();
  await page.getByRole("button", { name: "Next week" }).click();
  await expect(page.getByTestId("calendar-heading")).toHaveText("Week of Mon Nov 9");
  await expect(page.getByRole("button", { name: "Tue Nov 10" })).toContainText("Tue · Intervals");

  await page.getByRole("button", { name: "Tue Nov 10" }).click();
  await page.getByRole("button", { name: "Open Tue · Intervals" }).click();
  await page.getByRole("button", { name: "Copy to…" }).click();
  await page.getByLabel("Copy to date").fill("2026-11-14");
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Copied to Sat Nov 14.");
  await page.getByRole("button", { name: "Move to…" }).click();
  await page.getByLabel("Move to date").fill("2026-11-12");
  await page.getByRole("button", { name: "Move", exact: true }).click();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("button", { name: "Tue Nov 10" })).toContainText("Nothing scheduled");
  await expect(page.getByRole("button", { name: "Thu Nov 12" })).toContainText("Tue · Intervals");
  await expect(page.getByRole("button", { name: "Sat Nov 14" })).toContainText("Tue · Intervals");

  await page.getByRole("button", { name: "Wed Nov 11" }).click();
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Open Wed · Home mobility" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("scheduled-item")).toHaveCount(0);
});

test("calendar: tapping today with the sample puts it on the next Mon/Tue/Wed; a taken date asks replace or add", async ({ page }) => {
  await page.goto("#/calendar");
  await day(page, "Sat Nov 7").click();
  await page.getByRole("textbox", { name: "Plan to schedule" }).fill(SAMPLE);
  await page.getByRole("button", { name: "Check plan" }).click();
  await expect(page.getByTestId("schedule-preview")).toContainText("Mon Nov 9 — Mon · Upper");
  await page.getByRole("button", { name: "Save to calendar" }).click();

  await day(page, "Mon Nov 9: Mon · Upper").click();
  await page.getByRole("button", { name: "+ Paste a workout onto this day" }).click();
  await page.getByRole("textbox", { name: "Plan to schedule" }).fill("# Extra\n## Plank\nhold: 2 x 30s");
  await page.getByRole("button", { name: "Check plan" }).click();
  await expect(page.getByRole("radiogroup", { name: "Mon Nov 9 already has a workout" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose above first" })).toBeDisabled();
  await page.getByRole("radio", { name: "Add a second" }).click();
  await page.getByRole("button", { name: "Save to calendar" }).click();
  await expect(page.getByTestId("scheduled-item")).toHaveCount(2);

  await page.getByRole("button", { name: "+ Paste a workout onto this day" }).click();
  await page.getByRole("textbox", { name: "Plan to schedule" }).fill("# Only\n## Run\ncardio: 20 min");
  await page.getByRole("button", { name: "Check plan" }).click();
  await page.getByRole("radio", { name: "Replace it" }).click();
  await page.getByRole("button", { name: "Save to calendar" }).click();
  await expect(page.getByTestId("scheduled-item")).toHaveCount(1);
  await expect(page.getByTestId("scheduled-item")).toContainText("Only");
});

test("calendar: bad lines get the normal error messages", async ({ page }) => {
  await page.goto("#/calendar");
  await day(page, "Mon Nov 9").click();
  await page.getByRole("textbox", { name: "Plan to schedule" }).fill("# Mon\n## Squat\nstrength: 3 by 5\n# Tue\n## Run\ncardio: 20 min");
  await page.getByRole("button", { name: "Check plan" }).click();
  await expect(page.getByTestId("schedule-errors")).toContainText("Workout 1, Line 3:");
  await expect(page.getByTestId("schedule-errors")).toContainText("3x5 @ 185 lb");
});

test("today's workout is on the home screen; doing it ticks the calendar; past ones show missed", async ({ page }) => {
  await page.goto("#/calendar");
  await day(page, "Sat Nov 7").click();
  await page.getByRole("textbox", { name: "Plan to schedule" }).fill("# Today legs\n## Squat\nstrength: 1x5 @ 185 lb");
  await page.getByRole("button", { name: "Check plan" }).click();
  await page.getByRole("button", { name: "Save to calendar" }).click();
  await day(page, "Thu Nov 5").click();
  await page.getByRole("textbox", { name: "Plan to schedule" }).fill("# Skipped run\n## Run\ncardio: 20 min");
  await page.getByRole("button", { name: "Check plan" }).click();
  await page.getByRole("button", { name: "Save to calendar" }).click();

  await page.goto("#/");
  await expect(page.getByTestId("today")).toContainText("Today legs");
  await page.getByRole("button", { name: "Start Today legs" }).click();
  await page.getByRole("button", { name: "Start session" }).click();
  await page.getByRole("checkbox", { name: "Set 1 done" }).click();
  await page.getByRole("button", { name: "Finish" }).first().click();
  await page.getByRole("button", { name: "Save workout" }).click();

  await page.goto("#/");
  await expect(page.getByTestId("today")).toContainText("✓ Today legs");
  await page.goto("#/calendar");
  await expect(day(page, "Sat Nov 7: Today legs, done")).toContainText("✓");
  await page.getByRole("button", { name: "Week" }).click();
  await expect(page.getByRole("button", { name: "Thu Nov 5" })).toContainText("Skipped run (missed)");
  await day(page, "Sat Nov 7").click();
  await expect(page.getByTestId("scheduled-item")).toContainText("✓ done");
});

test("Paste plan → Put on calendar opens the calendar with the plan ready", async ({ page }) => {
  await pastePlan(page, SAMPLE);
  await page.getByRole("button", { name: "Put all 3 on the calendar" }).click();
  await expect(page.getByRole("textbox", { name: "Plan to schedule" })).toHaveValue(SAMPLE);
  await page.getByRole("button", { name: "Check plan" }).click();
  await expect(page.getByTestId("schedule-preview")).toContainText("Wed Nov 11 — Wed · Home mobility");
  await page.getByRole("button", { name: "Save to calendar" }).click();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(day(page, "Wed Nov 11: Wed · Home mobility")).toBeVisible();
});

test("old Up next items show as Unscheduled on the calendar", async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("seeded")) return;
    localStorage.setItem("seeded", "1");
    localStorage.setItem("workout.data", JSON.stringify({ version: 1, state: {
      workouts: [], templates: [], active: null, aliases: {}, lastExportAt: null,
      upNext: [{ id: "u1", title: "Old legs", planText: "# Old legs\n## Squat\nstrength: 3x5" }] } }));
  });
  await page.goto("#/calendar");
  await expect(page.getByTestId("unscheduled")).toContainText("Old legs");
  await page.getByLabel("Date for Old legs").fill("2026-11-10");
  await page.getByRole("button", { name: "Schedule" }).click();
  await expect(page.getByTestId("unscheduled")).toHaveCount(0);
  await expect(day(page, "Tue Nov 10: Old legs")).toBeVisible();
});

test("Settings: week can start on Sunday; the calendar follows", async ({ page }) => {
  await page.goto("#/calendar");
  await expect(page.getByRole("grid", { name: "Month" }).getByRole("button").first()).toHaveAccessibleName(/^Mon Oct 26/);
  await page.goto("#/settings");
  await page.getByRole("radio", { name: "Sunday" }).click();
  await page.goto("#/calendar");
  await expect(page.getByRole("grid", { name: "Month" }).getByRole("button").first()).toHaveAccessibleName(/^Sun Nov 1/);
  await page.getByRole("button", { name: "Week" }).click();
  await expect(page.getByTestId("calendar-heading")).toHaveText("Week of Sun Nov 1");
  await page.reload();
  await expect(page.getByTestId("calendar-heading")).toHaveText("Week of Sun Nov 1");
});
