import { type Vector3 } from "rpo-suite";
import { SCALE } from "../config/constants";

/**
 * Convert RIC (Radial, In-track, Cross-track) coordinates to Three.js coordinates.
 *
 * RIC Frame (spacecraft-centered):
 * - R (Radial): Points from Earth center through spacecraft, outward
 * - I (In-track): Points in velocity direction (along-track)
 * - C (Cross-track): Completes right-hand system (normal to orbital plane)
 *
 * Three.js mapping (for visualization):
 * - X ← I (In-track) — horizontal screen axis
 * - Y ← R (Radial) — vertical screen axis
 * - Z ← C (Cross-track) — depth axis
 *
 * @param ricPosition Position in RIC frame [R, I, C] in meters
 * @returns Position in Three.js frame [X, Y, Z] scaled for visualization
 */
export const toThreeJS = (ricPosition: Vector3): Vector3 =>
  [
    ricPosition[1] * SCALE, // I (In-track) -> X
    ricPosition[0] * SCALE, // R (Radial) -> Y
    ricPosition[2] * SCALE, // C (Cross-track) -> Z
  ] as const;
