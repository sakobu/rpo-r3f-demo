import { useMemo, useEffect } from "react";
import { Text } from "@react-three/drei";
import { propagateYA, trueAnomalyAtTime, type RelativeState } from "rpo-suite";
import { ORBITAL_PARAMS } from "../config/orbital";
import { toThreeJS } from "../utils/coordinates";
import { type ManeuverParams } from "../hooks/useManeuverControls";

type DeputyProps = {
  readonly initialState: RelativeState;
  readonly elapsedTime: number;
  readonly onStateUpdate: (state: RelativeState) => void;
  readonly maneuverConfig: ManeuverParams | null;
};

export function DeputySpacecraft({
  initialState,
  elapsedTime,
  onStateUpdate,
  maneuverConfig,
}: DeputyProps) {
  const state = useMemo(() => {
    if (
      maneuverConfig &&
      elapsedTime >= maneuverConfig.transferTime
    ) {
      const { fmc, targetPosition } = maneuverConfig;

      if (fmc) {
        const R = Math.sqrt(
          targetPosition[0] * targetPosition[0] +
            targetPosition[1] * targetPosition[1]
        );
        
        if (R < 1e-3) {
             return {
                position: targetPosition,
                velocity: [0, 0, 0] as const,
              };
        }


        const alpha = Math.atan2(targetPosition[1], targetPosition[0]);

        const t_fmc = elapsedTime - maneuverConfig.transferTime;
        const n = ORBITAL_PARAMS.meanMotion;
        const theta = n * t_fmc + alpha;

        const x = R * Math.cos(theta);
        const y = R * Math.sin(theta);

        const vx = -R * n * Math.sin(theta);
        const vy = R * n * Math.cos(theta);

        return {
          position: [x, y, targetPosition[2]] as const,
          velocity: [vx, vy, 0] as const,
        };
      }
    }

    const theta0 = 0;
    const thetaF = trueAnomalyAtTime(
      ORBITAL_PARAMS.elements,
      theta0,
      elapsedTime
    );

    return propagateYA(
      initialState,
      ORBITAL_PARAMS.elements,
      theta0,
      thetaF,
      elapsedTime,
      "RIC"
    );
  }, [elapsedTime, initialState, maneuverConfig]);

  const position = useMemo(() => toThreeJS(state.position), [state]);

  useEffect(() => {
    onStateUpdate(state);
  }, [state, onStateUpdate]);

  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color="#ff6600" />
      </mesh>
      <Text position={[0, 1, 0]} fontSize={0.4} color="#ff6600">
        Deputy
      </Text>
    </group>
  );
}
