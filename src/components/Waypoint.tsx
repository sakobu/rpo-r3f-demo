import { useRef, useEffect, useState, useMemo } from "react";
import { TransformControls, Text } from "@react-three/drei";
import { type Vector3 } from "rpo-suite";
import * as THREE from "three";
import { toThreeJS, fromThreeJS } from "../utils/coordinates";

type WaypointProps = {
  id: string;
  position: Vector3; // RIC coordinates
  index: number;
  onPositionChange: (id: string, position: Vector3) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
};

export function Waypoint({
  id,
  position,
  index,
  onPositionChange,
  onDragStart,
  onDragEnd,
}: WaypointProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [target, setTarget] = useState<THREE.Group | null>(null);

  // Extract position values to satisfy linter
  const posR = position[0];
  const posI = position[1];
  const posC = position[2];

  // Memoize the Three.js position based on actual values, not array reference
  const threePosition = useMemo(
    () => toThreeJS([posR, posI, posC] as const),
    [posR, posI, posC]
  );

  // Capture the ref after mount
  useEffect(() => {
    setTarget(groupRef.current);
  }, []);

  // Update position when prop changes (not from dragging)
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(
        threePosition[0],
        threePosition[1],
        threePosition[2]
      );
    }
  }, [threePosition]);

  const handleChange = () => {
    if (!groupRef.current) return;
    const pos = groupRef.current.position;
    const ricPosition = fromThreeJS([pos.x, pos.y, pos.z]);
    onPositionChange(id, ricPosition);
  };

  return (
    <>
      <group ref={groupRef} position={threePosition}>
        <mesh>
          <octahedronGeometry args={[0.4]} />
          <meshStandardMaterial color="#ffcc00" />
        </mesh>
        <Text position={[0, 1, 0]} fontSize={0.4} color="#ffcc00">
          WP{index + 1}
        </Text>
      </group>
      {target && (
        <TransformControls
          object={target}
          mode="translate"
          onMouseDown={onDragStart}
          onMouseUp={onDragEnd}
          onChange={handleChange}
        />
      )}
    </>
  );
}
