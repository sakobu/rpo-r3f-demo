export const SCALE = 0.01;
export const TRAJECTORY_POINTS_PER_ORBIT = 2000;
export const EARTH_RADIUS = 6_371_000; // meters

// Numerical tolerances
export const MATRIX_SINGULARITY_TOLERANCE = 1e-10;
export const FMC_STATIONARY_THRESHOLD = 1e-3; // meters - below this, target is at origin

// Waypoint maneuver planning
export const MAX_WAYPOINTS = 3;
export const DEFAULT_APPROACH_RATE = 0.5; // m/s
export const MIN_TRANSFER_TIME = 60; // seconds - floor for very close waypoints

// Waypoint validation
export const MIN_WAYPOINT_DISTANCE = 10; // meters - minimum distance from current position
export const MAX_LEG_DELTA_V = 10; // m/s - maximum delta-v per leg (departure + arrival)
