import { describe, expect, it } from "vitest";
import { FLASH_COLORS, fireCue, type CueDeps } from "../../src/timer/cues";

function fake() {
  const calls = { beep: [] as [number, number][], vibrate: [] as number[][], flash: [] as string[] };
  const deps: CueDeps = {
    beep: (f, ms) => calls.beep.push([f, ms]),
    vibrate: (p) => calls.vibrate.push(p),
    flash: (c) => calls.flash.push(c),
  };
  return { calls, deps };
}
const ALL = { sound: true, vibration: true, flash: true };

describe("fireCue", () => {
  it("fires all three for WORK", () => {
    const { calls, deps } = fake();
    fireCue("WORK", ALL, deps);
    expect(calls.beep.length).toBeGreaterThan(0);
    expect(calls.vibrate).toHaveLength(1);
    expect(calls.flash).toEqual(["#22c55e"]);
  });
  it("respects settings", () => {
    const { calls, deps } = fake();
    fireCue("WORK", { sound: false, vibration: false, flash: false }, deps);
    expect(calls).toEqual({ beep: [], vibrate: [], flash: [] });
  });
  it("uses the spec colors", () => {
    expect(FLASH_COLORS).toEqual({ WORK: "#22c55e", REST: "#3b82f6", WARN: "#ffffff", END: "#ffffff" });
    const { calls, deps } = fake();
    fireCue("REST", ALL, deps);
    expect(calls.flash).toEqual(["#3b82f6"]);
  });
  it("WARN is one short high beep", () => {
    const { calls, deps } = fake();
    fireCue("WARN", ALL, deps);
    expect(calls.beep).toHaveLength(1);
    expect(calls.beep[0][1]).toBeLessThanOrEqual(150);
  });
  it("END vibrates three pulses", () => {
    const { calls, deps } = fake();
    fireCue("END", ALL, deps);
    expect(calls.vibrate[0].filter((_, i) => i % 2 === 0)).toHaveLength(3);
  });
});
