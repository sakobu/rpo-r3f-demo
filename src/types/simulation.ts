import { type Vector3 } from "rpo-suite";

export type TimeAdvanceResult = {
  readonly time: number;
  readonly completed: boolean;
};

export type PresetName =
  | "R-bar Approach"
  | "V-bar Approach"
  | "NMC (2:1 Ellipse)";

export type RelativeStateParams = {
  radialOffset: number;
  inTrackOffset: number;
  crossTrackOffset: number;
  radialVelocity: number;
  inTrackVelocity: number;
  crossTrackVelocity: number;
};

export type RelativeMotionParams = RelativeStateParams & {
  numOrbits: number;
  timeAcceleration: number;
};

export type RelativeMotionControls = RelativeMotionParams & {
  setControls: (values: Partial<RelativeMotionParams>) => void;
};

export type ManeuverParams = {
  targetPosition: Vector3;
  transferTime: number;
  fmc: boolean;
};
