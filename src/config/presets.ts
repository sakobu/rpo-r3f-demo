import {
  type PresetName,
  type RelativeMotionParams,
} from "../types/simulation";
import { naturalMotionInTrackVelocity } from "../utils/physics";

// Preset configurations
const NMC_R0 = 1000;
const NMC_I0 = -2000;
const NMC_C0 = 0;

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
};

export const DEFAULT_PRESET: PresetName = "NMC (2:1 Ellipse)";

export const getPresetConfig = (preset: PresetName) => PRESET_CONFIGS[preset];
export const defaultPresetConfig = getPresetConfig(DEFAULT_PRESET);
