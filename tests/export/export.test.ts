import { describe, expect, it } from "vitest";
import { exportFileName, toMarkdown } from "../../src/export/markdown";
import { mergeWorkouts, parseExport } from "../../src/export/importFile";
import { legDay, olderBench } from "../fixtures/workouts";

const NOW = new Date("2026-11-09T10:00:00");
const WS = [legDay(), olderBench()];

describe("toMarkdown", () => {
  const md = toMarkdown(WS, { "back squat": "squat" }, "lb", NOW);
  it("has a header", () => {
    expect(md).toContain("# Workout log\nExported 2026-11-09 · 2 workouts · 2026-11-03 to 2026-11-07 · units: lb");
  });
  it("writes the leg day like the spec", () => {
    expect(md).toContain("## 2026-11-07 · Leg day · 52 min\nNotes: Slept badly.");
    expect(md).toContain("- Squat — planned 3x5 @ 185, rest 120s\n  - done: 185x5 ✓, 185x5 ✓, 185x4 ✓\n  - note: last rep slow");
    expect(md).toContain("- Tabata — planned 8 x 20s/10s — done 8/8 rounds");
    expect(md).toContain("- Core circuit — planned 3 rounds — done 3/3");
    expect(md).toContain("- Easy run — planned 20 min — done 22 min, 2.1 mi");
    expect(md).toContain("- Hip mobility — skipped");
  });
  it("shows unchecked sets and varied plans", () => {
    expect(md).toContain("- Bench press — planned 135x8, 155x6, 175x4, rest 90s\n  - done: 135x8 ✓, 155x6 ✓, 175x4 ✗");
  });
  it("puts the newest workout first", () => {
    expect(md.indexOf("2026-11-07 · Leg day")).toBeLessThan(md.indexOf("2026-11-03 · Push"));
  });
  it("skips unfinished workouts", () => {
    const { finishedAt: _f, ...open } = olderBench();
    expect(toMarkdown([{ ...open, id: "x" }], {}, "lb", NOW)).toContain("0 workouts");
  });
});

describe("exportFileName", () => {
  it("uses the local date", () => expect(exportFileName(NOW)).toBe("workout-log-2026-11-09.md"));
});

describe("parseExport", () => {
  it("round-trips", () => {
    const r = parseExport(toMarkdown(WS, { "back squat": "squat" }, "lb", NOW));
    expect(r).toEqual({ ok: true, workouts: WS, aliases: { "back squat": "squat" }, skipped: 0 });
  });
  it("rejects files without data", () => {
    expect(parseExport("hello").ok).toBe(false);
  });
  it("rejects other format versions", () => {
    const r = parseExport('```json\n{"formatVersion":2,"workouts":[]}\n```');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("version 2");
  });
});

describe("mergeWorkouts", () => {
  it("does not duplicate on re-import", () => {
    expect(mergeWorkouts(WS, WS)).toHaveLength(2);
  });
  it("keeps the later-finished copy", () => {
    const a = legDay();
    const b = { ...legDay(), finishedAt: "2026-11-08T00:00:00.000Z", notes: "edited" };
    expect(mergeWorkouts([a], [b])[0].notes).toBe("edited");
    expect(mergeWorkouts([b], [a])[0].notes).toBe("edited");
  });
  it("sorts newest first", () => {
    expect(mergeWorkouts([olderBench()], [legDay()]).map((w) => w.id)).toEqual(["leg-1107", "push-1103"]);
  });
});
