import { useMemo, useEffect } from "react";
import { Text } from "@react-three/drei";
import { propagateYA, trueAnomalyAtTime, type RelativeState } from "rpo-suite";
import { ORBITAL_PARAMS } from "../config/orbital";
import { toThreeJS } from "../utils/coordinates";

type DeputyProps = {
  readonly initialState: RelativeState;
  readonly elapsedTime: number;
  readonly onStateUpdate: (state: RelativeState) => void;
};

export function DeputySpacecraft({
  initialState,
  elapsedTime,
  onStateUpdate,
}: DeputyProps) {
  const state = useMemo(() => {
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
  }, [elapsedTime, initialState]);

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
