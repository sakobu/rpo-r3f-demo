import { type RelativeState } from "rpo-suite";
import { orbitalElements, ORBITAL_PARAMS } from "../config/orbital";
import { type RelativeStateParams } from "../types/simulation";

export const naturalMotionInTrackVelocity = (radialOffset: number): number => {
  const {
    gravitationalParameter: mu,
    angularMomentum: h,
    eccentricity: e,
  } = orbitalElements;

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
