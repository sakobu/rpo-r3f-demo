import {
  type PresetName,
  type RelativeMotionParams,
} from "../types/simulation";
import { naturalMotionInTrackVelocity } from "../utils/physics";

// Preset configurations
const NMC_R0 = 1000;
const NMC_I0 = -2000;
const NMC_C0 = 0;

const FMC_R0 = 200;
const FMC_I0 = -600;
const FMC_C0 = 400;

export const PRESET_CONFIGS: Record<PresetName, RelativeMotionParams> = {
  "R-bar Approach": {
    radialOffset: 1500,
    inTrackOffset: 0,
    crossTrackOffset: 0,
    radialVelocity: -0.05,
    inTrackVelocity: naturalMotionInTrackVelocity(1500),
    crossTrackVelocity: 0,
    numOrbits: 2,
    timeAcceleration: 40,
  },
  "V-bar Approach": {
    radialOffset: 0,
    inTrackOffset: -1500,
    crossTrackOffset: 0,
    radialVelocity: 0,
    inTrackVelocity: naturalMotionInTrackVelocity(0) - 0.14,
    crossTrackVelocity: 0,
    numOrbits: 2,
    timeAcceleration: 40,
  },
  "NMC (2:1 Ellipse)": {
    radialOffset: NMC_R0,
    inTrackOffset: NMC_I0,
    crossTrackOffset: NMC_C0,
    radialVelocity: 0,
    inTrackVelocity: naturalMotionInTrackVelocity(NMC_R0),
    crossTrackVelocity: 0,
    numOrbits: 10,
    timeAcceleration: 50,
  },
  "FMC (Flyaround)": {
    radialOffset: FMC_R0,
    inTrackOffset: FMC_I0,
    crossTrackOffset: FMC_C0,
    radialVelocity: 0,
    inTrackVelocity: naturalMotionInTrackVelocity(FMC_R0),
    crossTrackVelocity: -0.04,
    numOrbits: 6,
    timeAcceleration: 35,
  },
};

export const DEFAULT_PRESET: PresetName = "NMC (2:1 Ellipse)";

export const getPresetConfig = (preset: PresetName) => PRESET_CONFIGS[preset];
export const defaultPresetConfig = getPresetConfig(DEFAULT_PRESET);
