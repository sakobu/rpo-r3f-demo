import type { TimeAdvanceResult } from "../types/simulation";

/**
 * Advance simulation time with acceleration and bounds checking.
 *
 * @param current Current elapsed time in seconds
 * @param deltaSeconds Real-world time step (typically from requestAnimationFrame)
 * @param acceleration Time acceleration multiplier (e.g., 100x means 1 real second = 100 sim seconds)
 * @param duration Maximum simulation duration in seconds
 * @returns New time and whether simulation has completed
 */
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
