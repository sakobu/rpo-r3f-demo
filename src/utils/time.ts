import type { TimeAdvanceResult } from "../types/simulation";

export const advanceSimulationTime = (
  current: number,
  deltaSeconds: number,
  acceleration: number,
  duration: number
): TimeAdvanceResult => {
  const nextTime = current + deltaSeconds * acceleration;

  if (nextTime >= duration) {
    return { time: duration, completed: true };
  }

  return { time: nextTime, completed: false };
};
