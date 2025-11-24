import { useState, useCallback, useMemo } from "react";
import { trueAnomalyAtTime } from "rpo-suite";
import { advanceSimulationTime } from "../utils/time";
import { ORBITAL_PARAMS } from "../config/orbital";

export type UseSimulationTimeReturn = {
  // State
  elapsedTime: number;
  isPlaying: boolean;
  currentTheta: number;

  // Actions
  setIsPlaying: (playing: boolean) => void;
  toggle: () => void;
  advance: (delta: number, acceleration: number, duration: number) => void;
  reset: () => void;
  setElapsedTime: (time: number) => void;
};

export function useSimulationTime(): UseSimulationTimeReturn {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const currentTheta = useMemo(
    () => trueAnomalyAtTime(ORBITAL_PARAMS.elements, 0, elapsedTime),
    [elapsedTime]
  );

  const advance = useCallback(
    (delta: number, acceleration: number, duration: number) => {
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
    },
    []
  );

  const toggle = useCallback(() => {
    setIsPlaying((playing) => !playing);
  }, []);

  const reset = useCallback(() => {
    setElapsedTime(0);
    setIsPlaying(false);
  }, []);

  return {
    elapsedTime,
    isPlaying,
    currentTheta,
    setIsPlaying,
    toggle,
    advance,
    reset,
    setElapsedTime,
  };
}
