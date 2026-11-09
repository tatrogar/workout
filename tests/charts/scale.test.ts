import { describe, expect, it } from "vitest";
import { linearScale, niceTicks } from "../../src/charts/scale";

describe("niceTicks", () => {
  it("rounds to friendly steps from zero", () => expect(niceTicks(0, 187)).toEqual([0, 50, 100, 150, 200]));
  it("handles a flat series", () => {
    const t = niceTicks(5, 5);
    expect(t.length).toBeGreaterThan(1);
    expect(t[0]).toBeLessThanOrEqual(5);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(5);
  });
  it("handles decimals", () => expect(niceTicks(9.2, 10.8)).toEqual([9, 9.5, 10, 10.5, 11]));
});

describe("linearScale", () => {
  it("maps", () => expect(linearScale([0, 10], [0, 100])(5)).toBe(50));
  it("inverts ranges", () => expect(linearScale([0, 10], [100, 0])(10)).toBe(0));
  it("survives a zero-width domain", () => expect(Number.isFinite(linearScale([3, 3], [0, 100])(3))).toBe(true));
});
