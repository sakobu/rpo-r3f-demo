import { useMemo } from "react";
import { Line } from "@react-three/drei";
import { type Vector3 } from "rpo-suite";
import { type Waypoint, type ManeuverLeg } from "../types/waypoint";
import {
  computeLegPoints,
  applyBurn,
  stationaryState,
} from "../utils/propagation";

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

    const allPoints: Vector3[] = [];
    let state = { position: currentPosition, velocity: currentVelocity };
    let theta = currentTheta;

    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];

      // Apply departure burn
      const postBurnState = applyBurn(state, leg.deltaV);

      // Generate points along this leg's trajectory
      const { points, endTheta } = computeLegPoints(
        postBurnState,
        theta,
        leg.transferTime,
        POINTS_PER_LEG
      );
      allPoints.push(...points);

      // Update for next leg: after arrival burn, velocity is zero
      state = stationaryState(leg.targetPosition);
      theta = endTheta;
    }

    return allPoints;
  }, [currentPosition, currentVelocity, waypoints, legs, currentTheta]);

  if (previewPoints.length < 2) return null;

  return (
    <Line
      points={previewPoints}
      color="#ffcc00"
      lineWidth={1}
      dashed
      dashSize={0.5}
      gapSize={0.3}
    />
  );
}
