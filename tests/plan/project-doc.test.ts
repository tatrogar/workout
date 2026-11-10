import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePlan } from "../../src/plan/parse";

describe("docs/claude-project-instructions.md", () => {
  it("its example plan parses in the app", () => {
    const doc = readFileSync(new URL("../../docs/claude-project-instructions.md", import.meta.url), "utf8");
    const example = doc.split("Example:")[1].split("```")[1];
    const r = parsePlan(example, "lb");
    expect(r.ok ? r.plan.exercises.length : r.errors).toBe(6);
  });
});
