import type { TimerState } from "../../timer/engine";
import type { Workout } from "../../workout/types";

export type ExerciseProps = {
  w: Workout;
  idx: number;
  now: number;
  /** This exercise's timer, if one exists. */
  timer: TimerState | null;
  update(fn: (w: Workout) => Workout): void;
  setTimer(state: TimerState | null): void;
};
