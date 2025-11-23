import { type Vector3 } from "rpo-suite";
import { FMC_STATIONARY_THRESHOLD } from "../config/constants";

export type FMCState = {
  readonly position: Vector3;
  readonly velocity: Vector3;
};

/**
 * Calculates the state (position and velocity) for Forced Motion Circumnavigation.
 * The deputy maintains a circular relative motion around the target position
 * in the R-I (Radial-InTrack) plane.
 *
 * @param targetPosition - The target position [R, I, C] in meters
 * @param elapsedTimeSinceFMC - Time elapsed since FMC began (seconds)
 * @param meanMotion - Orbital mean motion (rad/s)
 * @returns Position and velocity in RIC frame
 */
export function calculateFMCState(
  targetPosition: Vector3,
  elapsedTimeSinceFMC: number,
  meanMotion: number
): FMCState {
  const [r, i, c] = targetPosition;

  // Radius in R-I plane
  const R = Math.sqrt(r * r + i * i);

  // Stationary case: target is at origin of R-I plane
  if (R < FMC_STATIONARY_THRESHOLD) {
    return {
      position: targetPosition,
      velocity: [0, 0, 0],
    };
  }

  // Initial phase angle in R-I plane
  const alpha = Math.atan2(i, r);

  // Current phase angle
  const theta = meanMotion * elapsedTimeSinceFMC + alpha;

  // Position: circular motion in R-I plane
  const x = R * Math.cos(theta);
  const y = R * Math.sin(theta);

  // Velocity: derivative of position
  const vx = -R * meanMotion * Math.sin(theta);
  const vy = R * meanMotion * Math.cos(theta);

  return {
    position: [x, y, c],
    velocity: [vx, vy, 0],
  };
}
