import {
  type RelativeState,
  type Vector3,
  propagateYA,
  trueAnomalyAtTime,
} from "rpo-suite";
import { type Waypoint, type ManeuverLeg } from "../types/waypoint";
import { calculateRendezvousBurn } from "./maneuvers";
import { applyBurn, stationaryState } from "./propagation";
import { ORBITAL_PARAMS } from "../config/orbital";
import {
  DEFAULT_APPROACH_RATE,
  MIN_TRANSFER_TIME,
  MIN_WAYPOINT_DISTANCE,
  MAX_LEG_DELTA_V,
} from "../config/constants";

/**
 * Calculate distance between two positions.
 */
function distance(from: Vector3, to: Vector3): number {
  return Math.sqrt(
    (to[0] - from[0]) ** 2 + (to[1] - from[1]) ** 2 + (to[2] - from[2]) ** 2
  );
}

/**
 * Calculate transfer time based on distance and approach rate.
 */
export function calculateTransferTime(
  fromPosition: Vector3,
  toPosition: Vector3,
  approachRate = DEFAULT_APPROACH_RATE
): number {
  const dist = distance(fromPosition, toPosition);
  const time = dist / approachRate;
  return Math.max(time, MIN_TRANSFER_TIME);
}

/**
 * Calculate a single leg's maneuver parameters.
 * Returns both departure and arrival burns.
 */
export function calculateLegManeuver(
  state: RelativeState,
  targetPosition: Vector3,
  theta: number
): { leg: ManeuverLeg; arrivalState: RelativeState; nextTheta: number } {
  const transferTime = calculateTransferTime(state.position, targetPosition);

  const deltaV = calculateRendezvousBurn(
    state,
    targetPosition,
    transferTime,
    ORBITAL_PARAMS.elements,
    theta
  );

  // Apply departure burn and propagate to find arrival state
  const postBurnState = applyBurn(state, deltaV);

  const nextTheta = trueAnomalyAtTime(
    ORBITAL_PARAMS.elements,
    theta,
    transferTime
  );

  const arrivalState = propagateYA(
    postBurnState,
    ORBITAL_PARAMS.elements,
    theta,
    nextTheta,
    transferTime,
    "RIC"
  );

  // Arrival burn nulls the velocity at the waypoint
  const arrivalDeltaV: Vector3 = [
    -arrivalState.velocity[0],
    -arrivalState.velocity[1],
    -arrivalState.velocity[2],
  ];

  return {
    leg: {
      targetPosition,
      transferTime,
      deltaV,
      arrivalDeltaV,
    },
    arrivalState,
    nextTheta,
  };
}

/**
 * Calculate the full maneuver queue for a sequence of waypoints.
 * Propagates state through each leg to compute accurate delta-vs.
 * Includes both departure and arrival burns for each leg.
 */
export function calculateManeuverQueue(
  initialState: RelativeState,
  waypoints: Waypoint[],
  currentTheta: number
): ManeuverLeg[] {
  const legs: ManeuverLeg[] = [];
  let state = initialState;
  let theta = currentTheta;

  for (const waypoint of waypoints) {
    const { leg, arrivalState, nextTheta } = calculateLegManeuver(
      state,
      waypoint.position,
      theta
    );

    legs.push(leg);

    // For next leg, start from stopped state at waypoint
    // (arrival burn has nulled the velocity)
    state = stationaryState(arrivalState.position);
    theta = nextTheta;
  }

  return legs;
}

/**
 * Calculate total delta-v magnitude for display.
 * Includes both departure and arrival burns.
 */
export function totalDeltaV(legs: ManeuverLeg[]): number {
  return legs.reduce((sum, leg) => {
    const departureMag = Math.sqrt(
      leg.deltaV[0] ** 2 + leg.deltaV[1] ** 2 + leg.deltaV[2] ** 2
    );
    const arrivalMag = Math.sqrt(
      leg.arrivalDeltaV[0] ** 2 +
        leg.arrivalDeltaV[1] ** 2 +
        leg.arrivalDeltaV[2] ** 2
    );
    return sum + departureMag + arrivalMag;
  }, 0);
}

/**
 * Calculate delta-v magnitude for a single leg.
 */
export function legDeltaV(leg: ManeuverLeg): number {
  const departureMag = Math.sqrt(
    leg.deltaV[0] ** 2 + leg.deltaV[1] ** 2 + leg.deltaV[2] ** 2
  );
  const arrivalMag = Math.sqrt(
    leg.arrivalDeltaV[0] ** 2 +
      leg.arrivalDeltaV[1] ** 2 +
      leg.arrivalDeltaV[2] ** 2
  );
  return departureMag + arrivalMag;
}

export type WaypointValidationError = {
  type: "too_close" | "high_delta_v" | "overlapping";
  waypointIndex: number;
  message: string;
};

/**
 * Validate waypoints for potential issues.
 * Returns an array of validation errors (empty if all valid).
 */
export function validateWaypoints(
  currentPosition: Vector3,
  waypoints: Waypoint[],
  legs: ManeuverLeg[]
): WaypointValidationError[] {
  const errors: WaypointValidationError[] = [];

  // Check each waypoint
  for (let i = 0; i < waypoints.length; i++) {
    const waypoint = waypoints[i];
    const prevPosition = i === 0 ? currentPosition : waypoints[i - 1].position;

    // Check distance from previous position
    const dist = distance(prevPosition, waypoint.position);
    if (dist < MIN_WAYPOINT_DISTANCE) {
      errors.push({
        type: "too_close",
        waypointIndex: i,
        message: `Waypoint ${i + 1} is too close (${dist.toFixed(1)}m < ${MIN_WAYPOINT_DISTANCE}m minimum)`,
      });
    }

    // Check for overlapping waypoints
    for (let j = i + 1; j < waypoints.length; j++) {
      const otherDist = distance(waypoint.position, waypoints[j].position);
      if (otherDist < MIN_WAYPOINT_DISTANCE) {
        errors.push({
          type: "overlapping",
          waypointIndex: j,
          message: `Waypoints ${i + 1} and ${j + 1} are too close (${otherDist.toFixed(1)}m apart)`,
        });
      }
    }

    // Check delta-v if we have legs
    if (legs[i]) {
      const dv = legDeltaV(legs[i]);
      if (dv > MAX_LEG_DELTA_V) {
        errors.push({
          type: "high_delta_v",
          waypointIndex: i,
          message: `Leg ${i + 1} requires high Δv (${dv.toFixed(2)} m/s > ${MAX_LEG_DELTA_V} m/s limit)`,
        });
      }
    }
  }

  return errors;
}
