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
