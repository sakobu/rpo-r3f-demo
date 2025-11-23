import { type RelativeState } from "rpo-suite";
import { ORBITAL_ELEMENTS, ORBITAL_PARAMS } from "../config/orbital";
import { type RelativeStateParams } from "../types/simulation";

/**
 * Calculate the in-track velocity required for a deputy at a given radial offset
 * to maintain zero secular drift relative to the chief spacecraft.
 *
 * Uses the vis-viva equation to ensure the deputy has the same orbital energy
 * (and thus same period) as the chief, preventing along-track drift over time.
 *
 * @param radialOffset Radial separation from chief in meters (positive = higher altitude)
 * @returns Required relative in-track velocity in m/s
 */
export const naturalMotionInTrackVelocity = (radialOffset: number): number => {
  const {
    gravitationalParameter: mu,
    angularMomentum: h,
    eccentricity: e,
  } = ORBITAL_ELEMENTS;

  // Chief state at perigee (theta = 0)
  const r_c = (h * h) / (mu * (1 + e)); // Radius at perigee
  const v_c = h / r_c; // Velocity at perigee (purely tangential)

  // Deputy state
  const r_d = r_c + radialOffset; // Deputy radius

  // Required semi-major axis for deputy (equal to chief's for no drift)
  const a = ORBITAL_PARAMS.semiMajorAxis;

  // Vis-viva equation: v^2 = mu * (2/r - 1/a)
  const v_d_mag = Math.sqrt(mu * (2 / r_d - 1 / a));

  const v_rel = v_d_mag - v_c * (r_d / r_c);

  return -v_rel;
};

/**
 * Create a RelativeState object from individual position/velocity components.
 *
 * @param params Position and velocity components in RIC frame (meters, m/s)
 * @returns RelativeState with position and velocity vectors
 */
export const createRelativeState = ({
  radialOffset,
  inTrackOffset,
  crossTrackOffset,
  radialVelocity,
  inTrackVelocity,
  crossTrackVelocity,
}: RelativeStateParams): RelativeState => {
  const state = {
    position: [radialOffset, inTrackOffset, crossTrackOffset] as const,
    velocity: [radialVelocity, inTrackVelocity, crossTrackVelocity] as const,
  };
  return state;
};
