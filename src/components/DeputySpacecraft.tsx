import { useMemo, useEffect } from "react";
import { Text } from "@react-three/drei";
import { propagateYA, trueAnomalyAtTime, type RelativeState } from "rpo-suite";
import { ORBITAL_PARAMS } from "../config/orbital";
import { toThreeJS } from "../utils/coordinates";
import { calculateFMCState } from "../utils/fmc";
import { type ManeuverParams } from "../types/simulation";

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
        const t_fmc = elapsedTime - maneuverConfig.transferTime;
        return calculateFMCState(
          targetPosition,
          t_fmc,
          ORBITAL_PARAMS.meanMotion
        );
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
