import { useMemo } from "react";
import { Line } from "@react-three/drei";
import {
  propagateYA,
  trueAnomalyAtTime,
  type RelativeState,
  type Vector3,
} from "rpo-suite";
import { ORBITAL_PARAMS } from "../config/orbital";
import { TRAJECTORY_POINTS_PER_ORBIT } from "../config/constants";
import { toThreeJS } from "../utils/coordinates";
import {
  computeFreeFlightPoints,
  computeLegPoints,
  stationaryState,
} from "../utils/propagation";
import { type ManeuverParams } from "../types/simulation";
import { type ManeuverQueue } from "../types/waypoint";

type TrajectoryProps = {
  readonly initialState: RelativeState;
  readonly numOrbits: number;
  readonly maneuverConfig: ManeuverParams | null;
  readonly maneuverQueue: ManeuverQueue | null;
  readonly baseTheta?: number;
};

const POINTS_PER_LEG = TRAJECTORY_POINTS_PER_ORBIT / 2;

export function Trajectory({
  initialState,
  numOrbits,
  maneuverConfig,
  maneuverQueue,
  baseTheta = 0,
}: TrajectoryProps) {
  const points = useMemo(() => {
    // When executing waypoint queue, render multi-segment trajectory
    if (maneuverQueue && maneuverQueue.legs.length > 0) {
      return computeWaypointTrajectory(initialState, maneuverQueue, numOrbits);
    }

    // Standard trajectory rendering (single-point maneuver or free flight)
    const totalPoints = numOrbits * TRAJECTORY_POINTS_PER_ORBIT;
    return computeFreeFlightPoints(
      initialState,
      baseTheta,
      totalPoints,
      TRAJECTORY_POINTS_PER_ORBIT,
      maneuverConfig
    );
  }, [initialState, numOrbits, maneuverConfig, maneuverQueue, baseTheta]);

  const isFreeFlightOnly =
    !maneuverConfig && (!maneuverQueue || maneuverQueue.legs.length === 0);

  return (
    <Line
      points={points}
      color={isFreeFlightOnly ? "#4a9999" : "#00ffff"}
      lineWidth={1}
      dashed={isFreeFlightOnly}
      dashSize={0.5}
      gapSize={0.3}
    />
  );
}

/**
 * Compute trajectory for active waypoint queue execution.
 * Renders from current leg through all remaining legs with burns at transitions,
 * then continues with free-flight from final waypoint for remaining orbit duration.
 */
function computeWaypointTrajectory(
  initialState: RelativeState,
  queue: ManeuverQueue,
  numOrbits: number
): Vector3[] {
  const allPoints: Vector3[] = [];
  let state = initialState;
  let theta = queue.currentTheta;
  let totalElapsedTime = 0;

  // Start from current leg index (skip completed legs)
  for (let i = queue.currentLegIndex; i < queue.legs.length; i++) {
    const leg = queue.legs[i];

    // For the first (current) leg, state already has departure burn applied
    // For subsequent legs, we need to apply the departure burn from zero velocity
    const legState: RelativeState =
      i === queue.currentLegIndex
        ? state
        : {
            position: state.position,
            velocity: leg.deltaV,
          };

    // Generate points along this leg's trajectory
    const { points, endTheta } = computeLegPoints(
      legState,
      theta,
      leg.transferTime,
      POINTS_PER_LEG
    );
    allPoints.push(...points);

    // Update for next leg: advance theta and set state at waypoint with zero velocity
    totalElapsedTime += leg.transferTime;
    state = stationaryState(leg.targetPosition);
    theta = endTheta;
  }

  // Continue trajectory from final waypoint (zero velocity) for remaining orbit duration
  const totalDuration = numOrbits * ORBITAL_PARAMS.period;
  const remainingDuration = totalDuration - totalElapsedTime;

  if (remainingDuration > 0) {
    const remainingPoints = Math.floor(
      (remainingDuration / ORBITAL_PARAMS.period) * TRAJECTORY_POINTS_PER_ORBIT
    );

    // Generate remaining free-flight points
    for (let i = 1; i <= remainingPoints; i++) {
      const t = (i / TRAJECTORY_POINTS_PER_ORBIT) * ORBITAL_PARAMS.period;
      const thetaT = trueAnomalyAtTime(ORBITAL_PARAMS.elements, theta, t);

      const propagatedState = propagateYA(
        state,
        ORBITAL_PARAMS.elements,
        theta,
        thetaT,
        t,
        "RIC"
      );

      allPoints.push(toThreeJS(propagatedState.position));
    }
  }

  return allPoints;
}
