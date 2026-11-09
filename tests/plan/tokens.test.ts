import { describe, expect, it } from "vitest";
import { formatDuration, formatMinutes, parseDuration, parseWeight } from "../../src/plan/tokens";

describe("parseDuration", () => {
  it.each([
    ["45s", 45], ["90 s", 90], ["2 min", 120], ["2min", 120], ["1:30", 90],
    ["20 minutes", 1200], ["30 sec", 30], ["1.5 min", 90],
  ])("%s → %i", (s, n) => expect(parseDuration(s)).toBe(n));
  it("rejects junk", () => {
    expect(parseDuration("abc")).toBeNull();
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("45")).toBeNull();
  });
});

describe("formatDuration", () => {
  it("formats", () => {
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(120)).toBe("2:00");
    expect(formatDuration(3723)).toBe("1:02:03");
  });
});

describe("formatMinutes", () => {
  it("formats whole and fractional minutes", () => {
    expect(formatMinutes(1200)).toBe("20 min");
    expect(formatMinutes(1320)).toBe("22 min");
    expect(formatMinutes(45)).toBe("45s");
    expect(formatMinutes(90)).toBe("1.5 min");
  });
});

describe("parseWeight", () => {
  it("parses with and without units", () => {
    expect(parseWeight("185 lb", "lb")).toEqual({ value: 185, units: "lb" });
    expect(parseWeight("80kg", "lb")).toEqual({ value: 80, units: "kg" });
    expect(parseWeight("135", "kg")).toEqual({ value: 135, units: "kg" });
    expect(parseWeight("135 lbs", "kg")).toEqual({ value: 135, units: "lb" });
    expect(parseWeight("heavy", "lb")).toBeNull();
  });
});
