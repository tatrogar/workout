import { describe, expect, it } from "vitest";
import {
  addDays, dayStatus, mondayOf, monthGrid, placePlans, shortTitle, weekdayOf,
} from "../src/calendar/schedule";
import { splitPlans, parsePlan } from "../src/plan/parse";
import { createDataStore, type KV } from "../src/store/data";
import { toMarkdown } from "../src/export/markdown";
import { parseExport } from "../src/export/importFile";
import { createWorkout, startSession } from "../src/workout/session";
import { allExerciseNames } from "../src/videos/library";

function memory(): KV & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

const SAMPLE = `# Mon · Upper
## Warm-up
other: 5 min
# Tue · Intervals
## Bike intervals
intervals: 6 x 1 min work / 2 min rest
# Wed · Home mobility
## Cat-cow
strength: 1x8`;

const plans = (text: string) => splitPlans(text).map((p) => {
  const r = parsePlan(p, "lb");
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return { title: r.plan.title ?? "Workout", planText: p };
});

describe("dates", () => {
  it("adds days across months and years", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("weeks start on Monday", () => {
    expect(mondayOf("2026-11-26")).toBe("2026-11-23"); // Thu → Mon
    expect(mondayOf("2026-11-29")).toBe("2026-11-23"); // Sun → Mon of the same week
    expect(mondayOf("2026-11-30")).toBe("2026-11-30");
  });
  it("month grid is whole Monday-to-Sunday weeks covering the month", () => {
    const g = monthGrid(2026, 10); // November 2026
    expect(g[0][0]).toBe("2026-10-26");
    expect(g[g.length - 1][6]).toBe("2026-12-06");
    expect(g.every((w) => w.length === 7)).toBe(true);
    expect(g.flat()).toContain("2026-11-01");
    expect(g.flat()).toContain("2026-11-30");
  });
});

describe("weekday titles", () => {
  it.each([
    ["Mon · Upper", 0], ["Monday: legs", 0], ["Tue · Intervals", 1], ["Tues run", 1], ["wed - mobility", 2],
    ["Thu", 3], ["Thurs core", 3], ["Fri · Full body", 4], ["Sat long run", 5], ["Sunday", 6],
  ])("%s", (t, d) => expect(weekdayOf(t)).toBe(d));
  it.each(["Upper body", "Monster sets", "Leg day", "Satisfying", "Sunrise run"])("%s has none", (t) => {
    expect(weekdayOf(t)).toBeNull();
  });
});

describe("placing a pasted week (the sample)", () => {
  it("tapping Monday puts Mon/Tue/Wed on that Monday, Tuesday and Wednesday", () => {
    expect(placePlans(plans(SAMPLE), "2026-11-30").map((p) => [p.date, p.title])).toEqual([
      ["2026-11-30", "Mon · Upper"], ["2026-12-01", "Tue · Intervals"], ["2026-12-02", "Wed · Home mobility"],
    ]);
  });
  it("tapping Thursday puts them on the next Mon/Tue/Wed, never in the past", () => {
    expect(placePlans(plans(SAMPLE), "2026-11-26").map((p) => p.date)).toEqual(["2026-11-30", "2026-12-01", "2026-12-02"]);
  });
  it("tapping Tuesday: Tue and Wed this week, Mon next week", () => {
    expect(placePlans(plans(SAMPLE), "2026-12-01").map((p) => p.date)).toEqual(["2026-12-07", "2026-12-01", "2026-12-02"]);
  });
  it("titles without weekdays go on consecutive days from the tapped date", () => {
    const p = plans("# Upper\n## A\nother: 5 min\n# Lower\n## B\nother: 5 min\n# Core\n## C\nother: 5 min");
    expect(placePlans(p, "2026-11-30").map((x) => x.date)).toEqual(["2026-11-30", "2026-12-01", "2026-12-02"]);
  });
  it("a mix of weekday and plain titles all go consecutively", () => {
    const p = plans("# Mon · Upper\n## A\nother: 5 min\n# Lower\n## B\nother: 5 min");
    expect(placePlans(p, "2026-11-26").map((x) => x.date)).toEqual(["2026-11-26", "2026-11-27"]);
  });
  it("one workout goes on the tapped date even if its title names another day", () => {
    expect(placePlans(plans("# Fri · Legs\n## A\nother: 5 min"), "2026-11-30").map((x) => x.date)).toEqual(["2026-11-30"]);
  });
});

describe("labels and status", () => {
  it("short title drops a leading weekday and trims long names", () => {
    expect(shortTitle("Mon · Upper")).toBe("Upper");
    expect(shortTitle("Tue - Intervals")).toBe("Intervals");
    expect(shortTitle("Wednesday: Home mobility and stretching", 12)).toBe("Home mobili…");
    expect(shortTitle("Mon")).toBe("Mon");
  });
  it("done, missed, planned", () => {
    const today = "2026-11-27";
    const finished = [{ id: "w1", startedAt: "2026-11-25T18:00:00.000Z", finishedAt: "2026-11-25T19:00:00.000Z" }];
    expect(dayStatus({ id: "s", date: "2026-11-25", title: "", planText: "", workoutId: "w1" }, finished, today)).toBe("done");
    expect(dayStatus({ id: "s", date: "2026-11-25", title: "", planText: "" }, finished, today)).toBe("missed");
    expect(dayStatus({ id: "s", date: "2026-11-27", title: "", planText: "" }, finished, today)).toBe("planned");
    expect(dayStatus({ id: "s", date: "2026-11-30", title: "", planText: "" }, finished, today)).toBe("planned");
    expect(dayStatus({ id: "s", date: "2026-11-25", title: "", planText: "", workoutId: "gone" }, finished, today)).toBe("missed");
  });
});

describe("the schedule in the store", () => {
  const item = (id: string, date: string, title = id) => ({ id, date, title, planText: `# ${title}\n## A\nother: 5 min` });
  it("adds, replaces a date, moves, copies, edits and deletes", () => {
    const s = createDataStore(memory());
    s.getState().schedule([item("a", "2026-11-30"), item("b", "2026-12-01")], []);
    s.getState().schedule([item("c", "2026-11-30"), item("d", "2026-12-01")], ["2026-12-01"]);
    expect(s.getState().scheduled.map((x) => `${x.id}@${x.date}`)).toEqual(["a@2026-11-30", "c@2026-11-30", "d@2026-12-01"]);
    s.getState().moveScheduled("a", "2026-12-05");
    const copyId = s.getState().copyScheduled("c", "2026-12-06");
    expect(s.getState().scheduled.find((x) => x.id === copyId)).toMatchObject({ date: "2026-12-06", title: "c" });
    s.getState().editScheduled("d", "# New name\n## B\nother: 10 min", "New name");
    expect(s.getState().scheduled.find((x) => x.id === "d")).toMatchObject({ title: "New name", planText: "# New name\n## B\nother: 10 min" });
    s.getState().deleteScheduled("a");
    expect(s.getState().scheduled.some((x) => x.id === "a")).toBe(false);
  });
  it("finishing a workout started from the calendar marks it done", () => {
    const s = createDataStore(memory());
    s.getState().schedule([item("a", "2026-11-27", "Legs")], []);
    const r = parsePlan(s.getState().scheduled[0].planText, "lb");
    if (!r.ok) throw new Error();
    s.getState().startWorkout({ ...startSession(createWorkout(r.plan, "", new Date(), "w9"), new Date()), scheduledId: "a" });
    s.getState().finishActive(new Date());
    expect(s.getState().scheduled[0].workoutId).toBe("w9");
  });
  it("old Up next items become unscheduled calendar items", () => {
    const kv = memory();
    kv.setItem("workout.data", JSON.stringify({ version: 1, state: { workouts: [], templates: [], active: null, aliases: {}, lastExportAt: null, upNext: [{ id: "u1", title: "Mon legs", planText: "# Mon legs\n## A\nother: 5 min" }] } }));
    const s = createDataStore(kv);
    expect(s.getState().scheduled).toEqual([{ id: "u1", date: null, title: "Mon legs", planText: "# Mon legs\n## A\nother: 5 min" }]);
    expect(s.getState().upNext).toEqual([]);
  });
  it("full backups carry the schedule and import merges it by id", () => {
    const md = toMarkdown([], {}, "lb", new Date(), {}, [], [], [item("a", "2026-11-30")]);
    const r = parseExport(md);
    expect(r.ok && r.scheduled).toEqual([item("a", "2026-11-30")]);
    const s = createDataStore(memory());
    s.getState().schedule([item("a", "2026-12-09")], []);
    s.getState().mergeScheduled([item("a", "2026-11-30"), item("b", "2026-12-01")]);
    expect(s.getState().scheduled.map((x) => `${x.id}@${x.date}`)).toEqual(["a@2026-12-09", "b@2026-12-01"]);
  });
  it("scheduled exercise names show up on the Exercises list", () => {
    const names = allExerciseNames({ workouts: [], active: null, templates: [], upNext: [], videos: {}, scheduled: [{ planText: SAMPLE.split("# Tue")[0] }] }, {});
    expect(names.map((n) => n.display)).toEqual(["Warm-up"]);
  });
});

import { startOfWeek } from "../src/calendar/schedule";
import { weeklySeries } from "../src/trends/series";
import { DEFAULT_SETTINGS } from "../src/store/settings";
import { legDay } from "./fixtures/workouts";

describe("week start setting", () => {
  it("defaults to Monday", () => expect(DEFAULT_SETTINGS.weekStart).toBe("mon"));
  it("start of week for Monday and Sunday", () => {
    expect(startOfWeek("2026-11-26", "mon")).toBe("2026-11-23"); // Thu
    expect(startOfWeek("2026-11-26", "sun")).toBe("2026-11-22");
    expect(startOfWeek("2026-11-29", "mon")).toBe("2026-11-23"); // Sun belongs to the week before when weeks start Monday
    expect(startOfWeek("2026-11-29", "sun")).toBe("2026-11-29");
  });
  it("month grid starts on Sunday when chosen", () => {
    const g = monthGrid(2026, 10, "sun"); // Nov 2026 starts on a Sunday
    expect(g[0][0]).toBe("2026-11-01");
    expect(g[g.length - 1][6]).toBe("2026-12-05");
    expect(monthGrid(2026, 10)[0][0]).toBe("2026-10-26");
  });
  it("Trends weekly bars follow the setting", () => {
    // legDay is Sat 2026-11-07; viewed on Sun 2026-11-08
    const mon = weeklySeries([legDay()], new Date("2026-11-08T12:00:00"), 2, "mon");
    expect(mon.map((w) => [w.weekStart, w.workouts])).toEqual([["2026-10-26", 0], ["2026-11-02", 1]]);
    const sun = weeklySeries([legDay()], new Date("2026-11-08T12:00:00"), 2, "sun");
    expect(sun.map((w) => [w.weekStart, w.workouts])).toEqual([["2026-11-01", 1], ["2026-11-08", 0]]);
  });
  it("weekday titles still go on the next matching day, whatever the week start", () => {
    // unaffected by the setting: placement is 'on or after the tapped date'
    expect(placePlans(plans(SAMPLE), "2026-11-29").map((p) => p.date)).toEqual(["2026-11-30", "2026-12-01", "2026-12-02"]);
  });
});
