import type { Exercise, Seconds, Units } from "../plan/types";
import type { TimerState } from "../timer/engine";

export type LoggedSet = { weight?: number; reps: number; done: boolean; at?: string };
export type ExerciseStatus = "done" | "partial" | "skipped";

export type ExerciseLog = {
  planned: Exercise;
  status: ExerciseStatus;
  skipped?: boolean;          // explicitly skipped by the owner
  notes?: string;
  sets?: LoggedSet[];         // strength
  holds?: { sec: Seconds; done: boolean }[]; // hold
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
  currentIndex?: number;
  timer?: { exerciseIndex: number; state: TimerState };
};

export type Template = { id: string; name: string; planText: string; updatedAt: string };
