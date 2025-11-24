import { useFrame } from "@react-three/fiber";

type TimeControllerProps = {
  readonly isPlaying: boolean;
  readonly acceleration: number;
  readonly duration: number;
  readonly onAdvance: (delta: number, acceleration: number, duration: number) => void;
};

export function TimeController({
  isPlaying,
  acceleration,
  duration,
  onAdvance,
}: TimeControllerProps) {
  useFrame((_, delta) => {
    if (isPlaying) {
      onAdvance(delta, acceleration, duration);
    }
  });

  return null;
}
