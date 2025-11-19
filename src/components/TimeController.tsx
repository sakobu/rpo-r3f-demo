import { useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { advanceSimulationTime } from "../utils/time";

type TimeControllerProps = {
  readonly acceleration: number;
  readonly duration: number;
  readonly onPlayPauseRef: (fn: () => void) => void;
  readonly onResetRef: (fn: () => void) => void;
  readonly onPlayingChange: (isPlaying: boolean) => void;
  readonly onTimeChange: (elapsedTime: number) => void;
};

export function TimeController({
  acceleration,
  duration,
  onPlayPauseRef,
  onResetRef,
  onPlayingChange,
  onTimeChange,
}: TimeControllerProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);

  useFrame((_, delta) => {
    if (isPlaying) {
      setElapsedTime((current) => {
        const { time, completed } = advanceSimulationTime(
          current,
          delta,
          acceleration,
          duration
        );

        if (completed) {
          setIsPlaying(false);
        }

        return time;
      });
    }
  });

  useEffect(() => {
    onPlayingChange(isPlaying);
  }, [isPlaying, onPlayingChange]);

  useEffect(() => {
    onTimeChange(elapsedTime);
  }, [elapsedTime, onTimeChange]);

  useEffect(() => {
    onPlayPauseRef(() => setIsPlaying((p) => !p));
    onResetRef(() => {
      setElapsedTime(0);
      setIsPlaying(true);
    });
  }, [onPlayPauseRef, onResetRef]);

  return null;
}
