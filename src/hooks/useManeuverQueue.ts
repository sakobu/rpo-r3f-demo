import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { type RelativeState, type Vector3, trueAnomalyAtTime } from "rpo-suite";
import { type Waypoint, type ManeuverLeg, type ManeuverQueue } from "../types/waypoint";
import {
  calculateManeuverQueue,
  calculateLegManeuver,
  totalDeltaV,
} from "../utils/waypointManeuvers";
import { ORBITAL_PARAMS } from "../config/orbital";

export type LegTransitionResult = {
  type: "continue" | "complete";
  newState: {
    position: Vector3;
    velocity: Vector3;
  };
  nextTheta?: number;
};

export type UseManeuverQueueReturn = {
  // State
  queue: ManeuverQueue | null;
  executingWaypoints: Waypoint[];

  // Computed values for preview
  previewLegs: ManeuverLeg[];
  totalDeltaVValue: number;

  // Actions
  startExecution: (
    currentState: RelativeState,
    waypoints: Waypoint[],
    elapsedTime: number
  ) => { position: Vector3; velocity: Vector3 } | null;

  checkLegTransition: (
    newTime: number,
    currentState: RelativeState
  ) => LegTransitionResult | null;

  cancelExecution: () => void;

  // Preview calculation
  calculatePreview: (
    currentState: RelativeState,
    waypoints: Waypoint[],
    elapsedTime: number
  ) => void;
};

export function useManeuverQueue(): UseManeuverQueueReturn {
  const [queue, setQueue] = useState<ManeuverQueue | null>(null);
  const [previewLegs, setPreviewLegs] = useState<ManeuverLeg[]>([]);
  const [executingWaypoints, setExecutingWaypoints] = useState<Waypoint[]>([]);

  // Refs to avoid stale closures in callbacks
  const queueRef = useRef<ManeuverQueue | null>(null);
  const executingWaypointsRef = useRef<Waypoint[]>([]);

  // Keep refs in sync with state
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    executingWaypointsRef.current = executingWaypoints;
  }, [executingWaypoints]);

  const startExecution = useCallback((
    currentState: RelativeState,
    waypoints: Waypoint[],
    elapsedTime: number
  ): { position: Vector3; velocity: Vector3 } | null => {
    if (waypoints.length === 0) return null;

    const startTheta = trueAnomalyAtTime(
      ORBITAL_PARAMS.elements,
      0,
      elapsedTime
    );

    // Calculate first leg fresh at execution time
    const { leg: freshFirstLeg } = calculateLegManeuver(
      currentState,
      waypoints[0].position,
      startTheta
    );

    // Calculate all legs for the queue
    const allLegs = calculateManeuverQueue(currentState, waypoints, startTheta);
    allLegs[0] = freshFirstLeg;

    // Store waypoints for execution
    setExecutingWaypoints([...waypoints]);

    setQueue({
      legs: allLegs,
      currentLegIndex: 0,
      startTheta,
      currentTheta: startTheta,
    });

    // Return the new state after applying first departure burn
    return {
      position: currentState.position,
      velocity: [
        currentState.velocity[0] + freshFirstLeg.deltaV[0],
        currentState.velocity[1] + freshFirstLeg.deltaV[1],
        currentState.velocity[2] + freshFirstLeg.deltaV[2],
      ] as Vector3,
    };
  }, []);

  const checkLegTransition = useCallback((
    newTime: number,
    currentState: RelativeState
  ): LegTransitionResult | null => {
    const currentQueue = queueRef.current;
    if (!currentQueue) return null;

    const currentLeg = currentQueue.legs[currentQueue.currentLegIndex];
    if (newTime < currentLeg.transferTime) return null;

    const nextIndex = currentQueue.currentLegIndex + 1;

    // Calculate theta at end of current leg
    const nextTheta = trueAnomalyAtTime(
      ORBITAL_PARAMS.elements,
      currentQueue.currentTheta,
      currentLeg.transferTime
    );

    if (nextIndex < currentQueue.legs.length) {
      // More legs to execute
      const nextWaypoint = executingWaypointsRef.current[nextIndex];
      if (!nextWaypoint) {
        // Safety check - clear queue if waypoint missing
        setQueue(null);
        setExecutingWaypoints([]);
        return null;
      }

      // Arrival: stationary state at waypoint
      const stationaryState: RelativeState = {
        position: currentState.position,
        velocity: [0, 0, 0] as Vector3,
      };

      // Recalculate next leg's departure burn
      const { leg: freshNextLeg } = calculateLegManeuver(
        stationaryState,
        nextWaypoint.position,
        nextTheta
      );

      // Update queue with fresh leg data
      const updatedLegs = [...currentQueue.legs];
      updatedLegs[nextIndex] = freshNextLeg;

      setQueue({
        ...currentQueue,
        legs: updatedLegs,
        currentLegIndex: nextIndex,
        currentTheta: nextTheta,
      });

      return {
        type: "continue",
        newState: {
          position: currentState.position,
          velocity: freshNextLeg.deltaV,
        },
        nextTheta,
      };
    } else {
      // All legs complete - apply final arrival burn (null velocity)
      setQueue(null);
      setExecutingWaypoints([]);

      return {
        type: "complete",
        newState: {
          position: currentState.position,
          velocity: [0, 0, 0] as Vector3,
        },
        nextTheta,
      };
    }
  }, []);

  const cancelExecution = useCallback(() => {
    setQueue(null);
    setExecutingWaypoints([]);
    setPreviewLegs([]);
  }, []);

  const calculatePreview = useCallback((
    currentState: RelativeState,
    waypoints: Waypoint[],
    elapsedTime: number
  ) => {
    if (waypoints.length === 0) {
      setPreviewLegs([]);
      return;
    }

    const currentTheta = trueAnomalyAtTime(
      ORBITAL_PARAMS.elements,
      0,
      elapsedTime
    );

    const legs = calculateManeuverQueue(currentState, waypoints, currentTheta);
    setPreviewLegs(legs);
  }, []);

  // Computed values
  const totalDeltaVValue = useMemo(() => totalDeltaV(previewLegs), [previewLegs]);

  return {
    queue,
    executingWaypoints,
    previewLegs,
    totalDeltaVValue,
    startExecution,
    checkLegTransition,
    cancelExecution,
    calculatePreview,
  };
}
