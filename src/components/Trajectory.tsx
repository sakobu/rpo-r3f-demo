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
import { type ManeuverParams } from "../hooks/useManeuverControls";

type TrajectoryProps = {
  readonly initialState: RelativeState;
  readonly numOrbits: number;
  readonly maneuverConfig: ManeuverParams | null;
};

export function Trajectory({
  initialState,
  numOrbits,
  maneuverConfig,
}: TrajectoryProps) {
  const points = useMemo(() => {
    const trajectoryPoints: Vector3[] = [];
    const totalPoints = numOrbits * TRAJECTORY_POINTS_PER_ORBIT;

    for (let i = 0; i <= totalPoints; i++) {
      const deltaTime =
        (i / TRAJECTORY_POINTS_PER_ORBIT) * ORBITAL_PARAMS.period;

      // Check for Post-Maneuver Logic
      if (maneuverConfig && deltaTime >= maneuverConfig.transferTime) {
        const { fmc, targetPosition } = maneuverConfig;

        if (fmc) {
          const R = Math.sqrt(
            targetPosition[0] * targetPosition[0] +
              targetPosition[1] * targetPosition[1]
          );

          if (R < 1e-3) {
            trajectoryPoints.push(toThreeJS(targetPosition));
            continue;
          }

          const alpha = Math.atan2(targetPosition[1], targetPosition[0]);
          const t_fmc = deltaTime - maneuverConfig.transferTime;
          const n = ORBITAL_PARAMS.meanMotion;
          const theta = n * t_fmc + alpha;

          const x = R * Math.cos(theta);
          const y = R * Math.sin(theta);

          trajectoryPoints.push(toThreeJS([x, y, targetPosition[2]]));
          continue;
        }
      }

      const theta0 = 0;
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
  }, [initialState, numOrbits, maneuverConfig]);

  return <Line points={points} color="#00ffff" lineWidth={1} />;
}
