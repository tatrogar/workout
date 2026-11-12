export type Units = "lb" | "kg";
export type Seconds = number;

export type StrengthSet = { weight?: number; reps: number };
/** perSide: done on each side. Timed per-side moves run side 1, a switch prep, then side 2. */
export type CircuitMove = { name: string; sec?: Seconds; reps?: number; perSide?: boolean };

export type Exercise =
  | { kind: "strength"; name: string; note?: string; restSec?: Seconds; sets: StrengthSet[]; perSide?: boolean }
  | { kind: "intervals"; name: string; note?: string; rounds: number; workSec: Seconds; restSec: Seconds }
  | { kind: "hold"; name: string; note?: string; restSec?: Seconds; sets: number; holdSec: Seconds; perSide?: boolean }
  | { kind: "circuit"; name: string; note?: string; restSec?: Seconds; moveRestSec?: Seconds; rounds: number; moves: CircuitMove[] }
  | { kind: "cardio"; name: string; note?: string; durationSec: Seconds; distance?: number; distanceUnit?: "mi" | "km" }
  | { kind: "other"; name: string; note?: string; durationSec: Seconds };

export type Side = "L" | "R";

export type ExerciseKind = Exercise["kind"];

export type Plan = { title?: string; units: Units; exercises: Exercise[] };
