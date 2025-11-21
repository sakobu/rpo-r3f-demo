import { useEffect, useRef } from "react";
import { useControls, button, folder } from "leva";
import {
  type RelativeMotionControls,
  type RelativeMotionParams,
} from "../types/simulation";
import { PRESET_CONFIGS, defaultPresetConfig } from "../config/presets";

export const useRelativeMotionControls = (
  onPlayPause: () => void,
  onReset: () => void,
  onPresetSelect: () => void
): RelativeMotionControls => {
  const setControlsRef = useRef<
    ((values: Partial<RelativeMotionParams>) => void) | null
  >(null);

  const [controls, setControls] = useControls(() => ({
    Presets: folder(
      {
        "R-bar Approach": button(() => {
          setControlsRef.current?.(PRESET_CONFIGS["R-bar Approach"]);
          onPresetSelect();
        }),
        "V-bar Approach": button(() => {
          setControlsRef.current?.(PRESET_CONFIGS["V-bar Approach"]);
          onPresetSelect();
        }),
        "NMC (2:1 Ellipse)": button(() => {
          setControlsRef.current?.(PRESET_CONFIGS["NMC (2:1 Ellipse)"]);
          onPresetSelect();
        }),
      },
      { collapsed: false }
    ),
    "Initial State": folder(
      {
        radialOffset: {
          label: "Radial Offset (m)",
          value: defaultPresetConfig.radialOffset,
          min: -4000,
          max: 4000,
          step: 1,
        },
        inTrackOffset: {
          label: "In-track Offset (m)",
          value: defaultPresetConfig.inTrackOffset,
          min: -6000,
          max: 6000,
          step: 1,
        },
        crossTrackOffset: {
          label: "Cross-track Offset (m)",
          value: defaultPresetConfig.crossTrackOffset,
          min: -2000,
          max: 2000,
          step: 1,
        },
        radialVelocity: {
          label: "Radial Velocity (m/s)",
          value: defaultPresetConfig.radialVelocity,
          min: -5,
          max: 5,
          step: 0.01,
        },
        inTrackVelocity: {
          label: "In-track Velocity (m/s)",
          value: defaultPresetConfig.inTrackVelocity,
          min: -5,
          max: 5,
          step: 0.01,
        },
        crossTrackVelocity: {
          label: "Cross-track Velocity (m/s)",
          value: defaultPresetConfig.crossTrackVelocity,
          min: -5,
          max: 5,
          step: 0.01,
        },
      },
      { collapsed: true }
    ),
    "Simulation Settings": folder(
      {
        numOrbits: {
          label: "Orbit Count",
          value: defaultPresetConfig.numOrbits,
          min: 1,
          max: 20,
          step: 1,
        },
        timeAcceleration: {
          label: "Time Scale",
          value: defaultPresetConfig.timeAcceleration,
          min: 1,
          max: 150,
          step: 1,
        },
      },
      { collapsed: true }
    ),
    "Play / Pause": button(onPlayPause),
    Reset: button(() => {
      onReset();
      onPresetSelect();
    }),
  }));

  useEffect(() => {
    setControlsRef.current = setControls;
  }, [setControls]);

  return {
    ...controls,
    setControls: (values: Partial<RelativeMotionParams>) => setControls(values),
  } as RelativeMotionControls & {
    setControls: (values: Partial<RelativeMotionParams>) => void;
  };
};
