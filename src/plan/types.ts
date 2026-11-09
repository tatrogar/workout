export type Units = "lb" | "kg";
export type Seconds = number;

export type StrengthSet = { weight?: number; reps: number };
export type CircuitMove = { name: string; sec?: Seconds; reps?: number };

export type Exercise =
  | { kind: "strength"; name: string; note?: string; restSec?: Seconds; sets: StrengthSet[] }
  | { kind: "intervals"; name: string; note?: string; rounds: number; workSec: Seconds; restSec: Seconds }
  | { kind: "hold"; name: string; note?: string; restSec?: Seconds; sets: number; holdSec: Seconds }
  | { kind: "circuit"; name: string; note?: string; restSec?: Seconds; rounds: number; moves: CircuitMove[] }
  | { kind: "cardio"; name: string; note?: string; durationSec: Seconds; distance?: number; distanceUnit?: "mi" | "km" }
  | { kind: "other"; name: string; note?: string; durationSec: Seconds };

export type ExerciseKind = Exercise["kind"];

export type Plan = { title?: string; units: Units; exercises: Exercise[] };
