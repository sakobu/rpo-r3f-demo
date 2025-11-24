import { type Vector3 } from "rpo-suite";

export type Waypoint = {
  id: string;
  position: Vector3; // [R, I, C] in meters
};

export type ManeuverLeg = {
  targetPosition: Vector3;
  transferTime: number; // seconds
  deltaV: Vector3; // [vR, vI, vC] in m/s - departure burn only
  arrivalDeltaV: Vector3; // [vR, vI, vC] in m/s - arrival burn to null velocity
};

export type ManeuverQueue = {
  legs: ManeuverLeg[];
  currentLegIndex: number;
  startTheta: number; // true anomaly at start of first leg
  currentTheta: number; // current true anomaly (updated at each leg transition)
};
