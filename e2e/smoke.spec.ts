import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const PLAN = readFileSync(new URL("../tests/plan/example.ts", import.meta.url), "utf8").split("`")[1];

async function startPlan(page: Page) {
  await page.goto("#/paste");
  await page.locator("textarea").fill(PLAN);
  await page.getByRole("button", { name: "Check plan" }).click();
  await page.getByRole("button", { name: "Start workout" }).click();
  await expect(page).toHaveURL(/#\/workout/);
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
  await page.getByRole("button", { name: "Export log" }).click();
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
