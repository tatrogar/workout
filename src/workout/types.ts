import type { Exercise, Seconds, Units } from "../plan/types";

export type SideSet = { reps: number; done: boolean };
import type { TimerState } from "../timer/engine";

/** For a per-side set, `sides` holds each side; `done` means both sides are done. */
export type LoggedSet = { weight?: number; reps: number; done: boolean; at?: string; sides?: { left: SideSet; right: SideSet } };
/** Seconds held (timed) or reps (rep moves) on each side. */
export type SidePair = { left?: number; right?: number };
export type ExerciseStatus = "done" | "partial" | "skipped";

export type ExerciseLog = {
  planned: Exercise;
  status: ExerciseStatus;
  skipped?: boolean;          // explicitly skipped by the owner
  notes?: string;
  effort?: number;            // optional 1–10 rating
  sets?: LoggedSet[];         // strength
  holds?: { sec: Seconds; done: boolean; sides?: SidePair }[]; // hold
  /** circuit: per-side moves, one entry per move per round */
  sideLog?: ({ round: number; moveIndex: number } & SidePair)[];
  roundsDone?: number;        // intervals, circuit
  durationSec?: Seconds;      // cardio, other
  distance?: number;          // cardio
};

export type Workout = {
  id: string;
  title: string;
  startedAt: string;
  finishedAt?: string;
  units: Units;
  notes?: string;
  exercises: ExerciseLog[];
  planText: string;
  /** Waiting for the owner to tap Start session. Absent = started. */
  pending?: boolean;
  currentIndex?: number;
  timer?: { exerciseIndex: number; state: TimerState };
};

export type Template = { id: string; name: string; planText: string; updatedAt: string };
