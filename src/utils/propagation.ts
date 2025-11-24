import {
  propagateYA,
  trueAnomalyAtTime,
  type RelativeState,
  type Vector3,
} from "rpo-suite";
import { ORBITAL_PARAMS } from "../config/orbital";
import { calculateFMCState } from "./fmc";
import { toThreeJS } from "./coordinates";
import { type ManeuverParams } from "../types/simulation";

/**
 * Propagate state to a specific time, handling FMC if configured.
 * This is the core propagation logic used by DeputySpacecraft.
 */
export function propagateToTime(
  initialState: RelativeState,
  elapsedTime: number,
  baseTheta: number,
  maneuverConfig: ManeuverParams | null
): RelativeState {
  // Check for FMC post-maneuver mode
  if (maneuverConfig && elapsedTime >= maneuverConfig.transferTime) {
    const { fmc, targetPosition } = maneuverConfig;

    if (fmc) {
      const t_fmc = elapsedTime - maneuverConfig.transferTime;
      return calculateFMCState(
        targetPosition,
        t_fmc,
        ORBITAL_PARAMS.meanMotion
      );
    }
  }

  // Standard YA propagation
  const thetaF = trueAnomalyAtTime(
    ORBITAL_PARAMS.elements,
    baseTheta,
    elapsedTime
  );

  return propagateYA(
    initialState,
    ORBITAL_PARAMS.elements,
    baseTheta,
    thetaF,
    elapsedTime,
    "RIC"
  );
}

/**
 * Generate trajectory points for a single leg (from current state to target).
 * Used by both Trajectory and WaypointPreview for multi-leg rendering.
 */
export function computeLegPoints(
  state: RelativeState,
  startTheta: number,
  transferTime: number,
  numPoints: number
): { points: Vector3[]; endTheta: number } {
  const points: Vector3[] = [];

  for (let j = 0; j <= numPoints; j++) {
    const t = (j / numPoints) * transferTime;
    const thetaT = trueAnomalyAtTime(ORBITAL_PARAMS.elements, startTheta, t);

    const propagatedState = propagateYA(
      state,
      ORBITAL_PARAMS.elements,
      startTheta,
      thetaT,
      t,
      "RIC"
    );

    points.push(toThreeJS(propagatedState.position));
  }

  const endTheta = trueAnomalyAtTime(
    ORBITAL_PARAMS.elements,
    startTheta,
    transferTime
  );

  return { points, endTheta };
}

/**
 * Generate trajectory points for free flight (no maneuver).
 * Used for standard trajectory visualization.
 */
export function computeFreeFlightPoints(
  initialState: RelativeState,
  baseTheta: number,
  numPoints: number,
  pointsPerOrbit: number,
  maneuverConfig: ManeuverParams | null
): Vector3[] {
  const points: Vector3[] = [];

  for (let i = 0; i <= numPoints; i++) {
    const deltaTime = (i / pointsPerOrbit) * ORBITAL_PARAMS.period;

    // Check for FMC post-maneuver
    if (maneuverConfig && deltaTime >= maneuverConfig.transferTime) {
      const { fmc, targetPosition } = maneuverConfig;

      if (fmc) {
        const t_fmc = deltaTime - maneuverConfig.transferTime;
        const fmcState = calculateFMCState(
          targetPosition,
          t_fmc,
          ORBITAL_PARAMS.meanMotion
        );
        points.push(toThreeJS(fmcState.position));
        continue;
      }
    }

    const thetaF = trueAnomalyAtTime(
      ORBITAL_PARAMS.elements,
      baseTheta,
      deltaTime
    );

    const state = propagateYA(
      initialState,
      ORBITAL_PARAMS.elements,
      baseTheta,
      thetaF,
      deltaTime,
      "RIC"
    );

    points.push(toThreeJS(state.position));
  }

  return points;
}

/**
 * Apply a delta-v burn to a state (modifies velocity only).
 */
export function applyBurn(state: RelativeState, deltaV: Vector3): RelativeState {
  return {
    position: state.position,
    velocity: [
      state.velocity[0] + deltaV[0],
      state.velocity[1] + deltaV[1],
      state.velocity[2] + deltaV[2],
    ] as Vector3,
  };
}

/**
 * Create a stationary state at a position (zero velocity).
 */
export function stationaryState(position: Vector3): RelativeState {
  return {
    position,
    velocity: [0, 0, 0] as Vector3,
  };
}
