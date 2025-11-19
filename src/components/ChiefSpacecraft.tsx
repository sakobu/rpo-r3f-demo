import { Text } from "@react-three/drei";

export function ChiefSpacecraft() {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#00ff00" />
      </mesh>
      <Text position={[0, 1.5, 0]} fontSize={0.5} color="#00ff00">
        Chief
      </Text>
    </group>
  );
}
