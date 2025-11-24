import {
  type PresetName,
  type RelativeMotionParams,
} from "../types/simulation";
import { naturalMotionInTrackVelocity } from "../utils/physics";

// Preset configurations
const NMC_R0 = 1000;
const NMC_I0 = -2000;
const NMC_C0 = 0;

const RBAR_R0 = 1500;
const RBAR_I0 = 0;
const RBAR_C0 = 0;
const RBAR_RDOT = -0.05;

const VBAR_R0 = 0;
const VBAR_I0 = -1500;
const VBAR_C0 = 0;
const VBAR_IDOT_OFFSET = -0.14;

export const PRESET_CONFIGS: Record<PresetName, RelativeMotionParams> = {
  "R-bar Approach": {
    radialOffset: RBAR_R0,
    inTrackOffset: RBAR_I0,
    crossTrackOffset: RBAR_C0,
    radialVelocity: RBAR_RDOT,
    inTrackVelocity: naturalMotionInTrackVelocity(RBAR_R0),
    crossTrackVelocity: 0,
    numOrbits: 1,
    timeAcceleration: 40,
  },
  "V-bar Approach": {
    radialOffset: VBAR_R0,
    inTrackOffset: VBAR_I0,
    crossTrackOffset: VBAR_C0,
    radialVelocity: 0,
    inTrackVelocity: naturalMotionInTrackVelocity(VBAR_R0) + VBAR_IDOT_OFFSET,
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
    numOrbits: 1,
    timeAcceleration: 50,
  },
};

export const DEFAULT_PRESET: PresetName = "NMC (2:1 Ellipse)";

export const getPresetConfig = (preset: PresetName) => PRESET_CONFIGS[preset];
export const defaultPresetConfig = getPresetConfig(DEFAULT_PRESET);
