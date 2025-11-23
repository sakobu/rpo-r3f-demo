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
