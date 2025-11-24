import { useEffect, useRef } from "react";
import { useControls, button, monitor } from "leva";
import { type ManeuverLeg } from "../types/waypoint";
import { type WaypointValidationError } from "../utils/waypointManeuvers";
import { MAX_WAYPOINTS } from "../config/constants";

type UseWaypointControlsParams = {
  waypointCount: number;
  legs: ManeuverLeg[];
  totalDeltaV: number;
  validationErrors: WaypointValidationError[];
  onAddWaypoint: () => void;
  onClearWaypoints: () => void;
  onExecute: () => void;
  canExecute: boolean;
};

export function useWaypointControls({
  waypointCount,
  legs,
  totalDeltaV,
  validationErrors,
  onAddWaypoint,
  onClearWaypoints,
  onExecute,
  canExecute,
}: UseWaypointControlsParams) {
  // Refs for callbacks to avoid recreating schema
  const onAddRef = useRef(onAddWaypoint);
  const onClearRef = useRef(onClearWaypoints);
  const onExecuteRef = useRef(onExecute);
  const canExecuteRef = useRef(canExecute);
  const hasErrorsRef = useRef(false);

  useEffect(() => {
    onAddRef.current = onAddWaypoint;
    onClearRef.current = onClearWaypoints;
    onExecuteRef.current = onExecute;
    canExecuteRef.current = canExecute;
    hasErrorsRef.current = validationErrors.length > 0;
  }, [onAddWaypoint, onClearWaypoints, onExecute, canExecute, validationErrors]);

  // Refs for monitor values
  const waypointsRef = useRef(`0 / ${MAX_WAYPOINTS}`);
  const totalDvRef = useRef("0.000 m/s");
  const legsRef = useRef("None");
  const errorsRef = useRef("");

  // Static schema - no dependencies array
  useControls(
    "Waypoint Planner",
    () => ({
      Waypoints: monitor(() => waypointsRef.current, { graph: false }),
      "Total Δv": monitor(() => totalDvRef.current, { graph: false }),
      Legs: monitor(() => legsRef.current, { graph: false }),
      Errors: monitor(() => errorsRef.current, { graph: false }),
      "Add Waypoint": button(() => onAddRef.current()),
      "Clear All": button(() => onClearRef.current()),
      "Execute Maneuver": button(() => {
        if (canExecuteRef.current && !hasErrorsRef.current) {
          onExecuteRef.current();
        }
      }),
    }),
    { collapsed: true }
  );

  // Update display values when props change
  useEffect(() => {
    waypointsRef.current = `${waypointCount} / ${MAX_WAYPOINTS}`;
    totalDvRef.current = `${totalDeltaV.toFixed(3)} m/s`;
    legsRef.current =
      legs.length > 0
        ? legs
            .map((leg, i) => {
              const departureDv = Math.sqrt(
                leg.deltaV[0] ** 2 + leg.deltaV[1] ** 2 + leg.deltaV[2] ** 2
              );
              const arrivalDv = Math.sqrt(
                leg.arrivalDeltaV[0] ** 2 +
                  leg.arrivalDeltaV[1] ** 2 +
                  leg.arrivalDeltaV[2] ** 2
              );
              return `${i + 1}: ${leg.transferTime.toFixed(0)}s, ${(departureDv + arrivalDv).toFixed(2)} m/s`;
            })
            .join(" | ")
        : "None";
    errorsRef.current =
      validationErrors.length > 0
        ? `⚠ ${validationErrors.map((e) => e.message).join("; ")}`
        : "";
  }, [waypointCount, legs, totalDeltaV, validationErrors]);
}

