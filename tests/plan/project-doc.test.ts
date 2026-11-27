import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePlan, splitPlans } from "../../src/plan/parse";

const doc = readFileSync(new URL("../../docs/claude-project-instructions.md", import.meta.url), "utf8");

describe("docs/claude-project-instructions.md", () => {
  it("its single-workout example parses in the app", () => {
    const example = doc.split("Example:")[1].split("```")[1];
    const r = parsePlan(example, "lb");
    expect(r.ok ? r.plan.exercises.length : r.errors).toBe(6);
  });
  it("its week example pastes as three workouts that all parse", () => {
    const week = doc.split("Week example")[1].split("If I paste back an error")[0];
    const parts = splitPlans(week);
    expect(parts.map((p) => { const r = parsePlan(p, "lb"); return r.ok ? r.plan.title : r.errors; })).toEqual(["Mon · Legs", "Wed · Run", "Fri · Core"]);
  });
});
