import { useMemo } from "react";
import { Line } from "@react-three/drei";
import {
  type Vector3,
  type RelativeState,
  propagateYA,
  trueAnomalyAtTime,
} from "rpo-suite";
import { type Waypoint, type ManeuverLeg } from "../types/waypoint";
import { toThreeJS } from "../utils/coordinates";
import { ORBITAL_PARAMS } from "../config/orbital";

const POINTS_PER_LEG = 50;

type WaypointPreviewProps = {
  currentPosition: Vector3;
  currentVelocity: Vector3;
  waypoints: Waypoint[];
  legs: ManeuverLeg[];
  currentTheta: number;
};

export function WaypointPreview({
  currentPosition,
  currentVelocity,
  waypoints,
  legs,
  currentTheta,
}: WaypointPreviewProps) {
  const previewPoints = useMemo(() => {
    if (waypoints.length === 0 || legs.length === 0) return [];

    const points: Vector3[] = [];
    let state: RelativeState = {
      position: currentPosition,
      velocity: currentVelocity,
    };
    let theta = currentTheta;

    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];

      // Apply departure burn
      const postBurnState: RelativeState = {
        position: state.position,
        velocity: [
          state.velocity[0] + leg.deltaV[0],
          state.velocity[1] + leg.deltaV[1],
          state.velocity[2] + leg.deltaV[2],
        ] as Vector3,
      };

      // Generate points along this leg's trajectory
      for (let j = 0; j <= POINTS_PER_LEG; j++) {
        const t = (j / POINTS_PER_LEG) * leg.transferTime;
        const thetaT = trueAnomalyAtTime(ORBITAL_PARAMS.elements, theta, t);

        const propagatedState = propagateYA(
          postBurnState,
          ORBITAL_PARAMS.elements,
          theta,
          thetaT,
          t,
          "RIC"
        );

        points.push(toThreeJS(propagatedState.position));
      }

      // Update for next leg
      const nextTheta = trueAnomalyAtTime(
        ORBITAL_PARAMS.elements,
        theta,
        leg.transferTime
      );

      // After arrival burn, velocity is zero
      state = {
        position: leg.targetPosition,
        velocity: [0, 0, 0] as Vector3,
      };
      theta = nextTheta;
    }

    return points;
  }, [currentPosition, currentVelocity, waypoints, legs, currentTheta]);

  if (previewPoints.length < 2) return null;

  return (
    <Line
      points={previewPoints}
      color="#ffcc00"
      lineWidth={2}
      dashed
      dashSize={0.5}
      gapSize={0.3}
    />
  );
}
