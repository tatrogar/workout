import { describe, expect, it } from "vitest";
import { parsePlan, planToText } from "../../src/plan/parse";
import { CLAUDE_INSTRUCTIONS } from "../../src/plan/instructions";
import { SPEC_EXAMPLE } from "./example";

function ok(text: string, units: "lb" | "kg" = "lb") {
  const r = parsePlan(text, units);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.plan;
}
function errs(text: string) {
  const r = parsePlan(text, "lb");
  if (r.ok) throw new Error("expected errors");
  return r.errors;
}

describe("parsePlan", () => {
  it("parses the spec example", () => {
    const p = ok(SPEC_EXAMPLE);
    expect(p.title).toBe("Leg day");
    expect(p.units).toBe("lb");
    expect(p.exercises.map((e) => e.kind)).toEqual([
      "strength", "strength", "strength", "intervals", "hold", "circuit", "cardio", "other",
    ]);
    expect(p.exercises[0]).toEqual({
      kind: "strength", name: "Squat", restSec: 120, note: "pause at the bottom",
      sets: [{ weight: 185, reps: 5 }, { weight: 185, reps: 5 }, { weight: 185, reps: 5 }],
    });
    expect(p.exercises[1]).toEqual({
      kind: "strength", name: "Bench press", restSec: 90,
      sets: [{ weight: 135, reps: 8 }, { weight: 155, reps: 6 }, { weight: 175, reps: 4 }],
    });
    expect(p.exercises[2]).toEqual({
      kind: "strength", name: "Pull-ups", restSec: 90, sets: [{ reps: 8 }, { reps: 8 }, { reps: 8 }],
    });
    expect(p.exercises[3]).toEqual({ kind: "intervals", name: "Tabata", rounds: 8, workSec: 20, restSec: 10 });
    expect(p.exercises[4]).toEqual({ kind: "hold", name: "Plank", sets: 3, holdSec: 45, restSec: 30 });
    expect(p.exercises[5]).toEqual({
      kind: "circuit", name: "Core circuit", rounds: 3, restSec: 60,
      moves: [{ name: "Plank", sec: 45 }, { name: "Dead bug", reps: 10 }, { name: "Side plank", sec: 30 }],
    });
    expect(p.exercises[6]).toEqual({ kind: "cardio", name: "Easy run", durationSec: 1200, distance: 2, distanceUnit: "mi" });
    expect(p.exercises[7]).toEqual({ kind: "other", name: "Hip mobility", durationSec: 600 });
  });

  it("title is optional", () => {
    expect(ok("## Squat\nstrength: 3x5 @ 185").title).toBeUndefined();
  });

  it("uses the unit of the first explicit weight", () => {
    const p = ok("## Squat\nstrength: 3x5 @ 80 kg", "lb");
    expect(p.units).toBe("kg");
    expect(p.exercises[0]).toMatchObject({ sets: [{ weight: 80 }, { weight: 80 }, { weight: 80 }] });
  });

  it("rejects mixed units", () => {
    const e = errs("## Squat\nstrength: 3x5 @ 80 kg\n## Bench\nstrength: 3x5 @ 185 lb");
    expect(e[0].line).toBe(4);
    expect(e[0].message).toContain("use one unit per plan");
  });

  it("accepts a code fence, × and capital X", () => {
    const p = ok("```text\n## Squat\nstrength: 3×5 @ 185 lb, rest 120s\n```");
    const q = ok("## Squat\nstrength: 3X5 @ 185 lb, rest 120s");
    expect(p.exercises).toEqual(ok("## Squat\nstrength: 3x5 @ 185 lb, rest 120s").exercises);
    expect(q.exercises).toEqual(p.exercises);
  });

  it("accepts curly quotes and extra spaces in names", () => {
    const p = ok("## Farmer’s   walk\nother: 2 min");
    expect(p.exercises[0].name).toBe("Farmer's walk");
  });

  it("reports a bad line with its number and an example", () => {
    const e = errs("## Squat\nstrength: 3 by 5");
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ line: 2, text: "strength: 3 by 5" });
    expect(e[0].message).toContain("3x5 @ 185 lb");
  });

  it("keeps original line numbers when a fence is stripped", () => {
    const e = errs("```\n## Squat\nstrength: 3 by 5\n```");
    expect(e[0].line).toBe(3);
  });

  it("errors on an exercise without a type line", () => {
    const e = errs("## Squat\n## Bench\nstrength: 3x5");
    expect(e[0].line).toBe(1);
    expect(e[0].message).toContain('expected a line like "strength: 3x5 @ 185 lb"');
  });

  it("errors on a circuit with no moves", () => {
    expect(errs("## Core\ncircuit: 3 rounds")[0].line).toBe(2);
  });

  it("errors on a move line outside a circuit", () => {
    expect(errs("## Squat\nstrength: 3x5\n- Plank 45s")[0].line).toBe(3);
  });

  it("errors on text before the first exercise", () => {
    expect(errs("do this first\n## Squat\nstrength: 3x5")[0].line).toBe(1);
  });

  it("errors on an empty plan", () => {
    expect(errs("   \n")[0].message).toContain("no exercises");
  });

  it("round-trips through planToText", () => {
    const p = ok(SPEC_EXAMPLE);
    expect(ok(planToText(p))).toEqual(p);
  });
});

describe("CLAUDE_INSTRUCTIONS", () => {
  it("contains the format example and the name rule", () => {
    expect(CLAUDE_INSTRUCTIONS).toContain("strength: 3x5 @ 185 lb");
    expect(CLAUDE_INSTRUCTIONS).toContain("reuse exact exercise names");
  });
});
