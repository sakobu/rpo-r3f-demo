import { type Vector3 } from "rpo-suite";
import { SCALE } from "../config/constants";

// Coordinate conversion: RIC to Three.js
// NOTE: This transformation reorders axes but preserves the right-handed orientation.
// Mapping: RIC [R, I, C] -> Three.js [I, R, C] -> [X, Y, Z]
// This maps the orbital plane (R-I) to the screen plane (X-Y)
export const toThreeJS = (ricPosition: Vector3): Vector3 =>
  [
    ricPosition[1] * SCALE, // I (In-track) -> X
    ricPosition[0] * SCALE, // R (Radial) -> Y
    ricPosition[2] * SCALE, // C (Cross-track) -> Z
  ] as const;
