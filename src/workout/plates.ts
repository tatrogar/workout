import type { Units } from "../plan/types";

const BAR: Record<Units, number> = { lb: 45, kg: 20 };
const PLATES: Record<Units, number[]> = { lb: [45, 35, 25, 10, 5, 2.5, 1.25], kg: [25, 20, 15, 10, 5, 2.5, 1.25] };

/** Plates for ONE side of a standard barbell (45 lb / 20 kg), heaviest first.
 *  null when the weight is under the bar or can't be made with standard plates. */
export function plates(weight: number, units: Units): number[] | null {
  let side = (weight - BAR[units]) / 2;
  if (side < 0) return null;
  const out: number[] = [];
  for (const p of PLATES[units]) {
    while (side >= p - 1e-9) { out.push(p); side -= p; }
  }
  return side > 1e-9 ? null : out;
}
