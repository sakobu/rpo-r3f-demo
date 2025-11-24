import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { useFrame } from "@react-three/fiber";
import { advanceSimulationTime } from "../utils/time";

export type TimeControllerHandle = {
  toggle: () => void;
  reset: () => void;
};

type TimeControllerProps = {
  readonly acceleration: number;
  readonly duration: number;
  readonly isPlaying: boolean;
  readonly onPlayingChange: (isPlaying: boolean) => void;
  readonly onTimeChange: (elapsedTime: number) => void;
};

export const TimeController = forwardRef<TimeControllerHandle, TimeControllerProps>(
  function TimeController({ acceleration, duration, isPlaying, onPlayingChange, onTimeChange }, ref) {
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
          onPlayingChange(false);
        }

        return time;
      });
    }
  });

  useEffect(() => {
    onTimeChange(elapsedTime);
  }, [elapsedTime, onTimeChange]);

  useImperativeHandle(ref, () => ({
    toggle: () => onPlayingChange(!isPlaying),
    reset: () => {
      setElapsedTime(0);
      onPlayingChange(true);
    },
  }));

  return null;
});
