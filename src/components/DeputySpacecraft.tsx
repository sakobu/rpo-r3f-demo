import { useMemo, useEffect } from "react";
import { Text } from "@react-three/drei";
import { type RelativeState } from "rpo-suite";
import { toThreeJS } from "../utils/coordinates";
import { propagateToTime } from "../utils/propagation";
import { type ManeuverParams } from "../types/simulation";

type DeputyProps = {
  readonly initialState: RelativeState;
  readonly elapsedTime: number;
  readonly onStateUpdate: (state: RelativeState) => void;
  readonly maneuverConfig: ManeuverParams | null;
  readonly baseTheta?: number;
};

export function DeputySpacecraft({
  initialState,
  elapsedTime,
  onStateUpdate,
  maneuverConfig,
  baseTheta = 0,
}: DeputyProps) {
  const state = useMemo(
    () => propagateToTime(initialState, elapsedTime, baseTheta, maneuverConfig),
    [elapsedTime, initialState, maneuverConfig, baseTheta]
  );

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
