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
import { calculateFMCState } from "../utils/fmc";
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
    const trajectoryPoints: Vector3[] = [];
    const totalPoints = numOrbits * TRAJECTORY_POINTS_PER_ORBIT;

    for (let i = 0; i <= totalPoints; i++) {
      const deltaTime =
        (i / TRAJECTORY_POINTS_PER_ORBIT) * ORBITAL_PARAMS.period;

      // Check for Post-Maneuver Logic
      if (maneuverConfig && deltaTime >= maneuverConfig.transferTime) {
        const { fmc, targetPosition } = maneuverConfig;

        if (fmc) {
          const t_fmc = deltaTime - maneuverConfig.transferTime;
          const fmcState = calculateFMCState(
            targetPosition,
            t_fmc,
            ORBITAL_PARAMS.meanMotion
          );
          trajectoryPoints.push(toThreeJS(fmcState.position));
          continue;
        }
      }

      const theta0 = baseTheta;
      const thetaF = trueAnomalyAtTime(
        ORBITAL_PARAMS.elements,
        theta0,
        deltaTime
      );

      const state = propagateYA(
        initialState,
        ORBITAL_PARAMS.elements,
        theta0,
        thetaF,
        deltaTime,
        "RIC"
      );

      trajectoryPoints.push(toThreeJS(state.position));
    }

    return trajectoryPoints;
  }, [initialState, numOrbits, maneuverConfig, maneuverQueue, baseTheta]);

  return <Line points={points} color="#00ffff" lineWidth={1} />;
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
  const points: Vector3[] = [];
  let state = initialState;
  let theta = queue.currentTheta;
  let totalElapsedTime = 0;

  // Start from current leg index (skip completed legs)
  for (let i = queue.currentLegIndex; i < queue.legs.length; i++) {
    const leg = queue.legs[i];

    // For the first (current) leg, state already has departure burn applied
    // For subsequent legs, we need to apply the departure burn
    const legState: RelativeState =
      i === queue.currentLegIndex
        ? state
        : {
            position: state.position,
            velocity: [
              leg.deltaV[0], // From zero velocity (after arrival burn)
              leg.deltaV[1],
              leg.deltaV[2],
            ] as Vector3,
          };

    // Generate points along this leg's trajectory
    for (let j = 0; j <= POINTS_PER_LEG; j++) {
      const t = (j / POINTS_PER_LEG) * leg.transferTime;
      const thetaT = trueAnomalyAtTime(ORBITAL_PARAMS.elements, theta, t);

      const propagatedState = propagateYA(
        legState,
        ORBITAL_PARAMS.elements,
        theta,
        thetaT,
        t,
        "RIC"
      );

      points.push(toThreeJS(propagatedState.position));
    }

    // Update for next leg: advance theta and set state at waypoint with zero velocity
    const nextTheta = trueAnomalyAtTime(
      ORBITAL_PARAMS.elements,
      theta,
      leg.transferTime
    );

    totalElapsedTime += leg.transferTime;
    state = {
      position: leg.targetPosition,
      velocity: [0, 0, 0] as Vector3,
    };
    theta = nextTheta;
  }

  // Continue trajectory from final waypoint (zero velocity) for remaining orbit duration
  const totalDuration = numOrbits * ORBITAL_PARAMS.period;
  const remainingDuration = totalDuration - totalElapsedTime;

  if (remainingDuration > 0) {
    const remainingPoints = Math.floor(
      (remainingDuration / ORBITAL_PARAMS.period) * TRAJECTORY_POINTS_PER_ORBIT
    );

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

      points.push(toThreeJS(propagatedState.position));
    }
  }

  return points;
}
