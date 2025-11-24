import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { Leva } from "leva";
import { type RelativeState, type Vector3 } from "rpo-suite";

import { ORBITAL_PARAMS } from "./config/orbital";
import { createRelativeState } from "./utils/physics";
import { useRelativeMotionControls } from "./hooks/useRelativeMotionControls";
import { useManeuverControls } from "./hooks/useManeuverControls";
import { useWaypointControls } from "./hooks/useWaypointControls";
import { useManeuverQueue } from "./hooks/useManeuverQueue";
import { useSimulationTime } from "./hooks/useSimulationTime";
import { type ManeuverParams } from "./types/simulation";
import { type Waypoint } from "./types/waypoint";
import { calculateRendezvousBurn } from "./utils/maneuvers";
import { validateWaypoints } from "./utils/waypointManeuvers";

import { ChiefSpacecraft } from "./components/ChiefSpacecraft";
import { DeputySpacecraft } from "./components/DeputySpacecraft";
import { RICAxes } from "./components/RICAxes";
import { SimulationInfo } from "./components/SimulationInfo";
import { Stats } from "./components/Stats";
import { TimeController } from "./components/TimeController";
import { Trajectory } from "./components/Trajectory";
import { WaypointManager } from "./components/WaypointManager";
import { WaypointPreview } from "./components/WaypointPreview";

function App() {
  const [currentState, setCurrentState] = useState<RelativeState | null>(null);
  const [maneuverConfig, setManeuverConfig] = useState<ManeuverParams | null>(
    null
  );
  const [presetVersion, setPresetVersion] = useState(0);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [postExecutionState, setPostExecutionState] =
    useState<RelativeState | null>(null);

  const orbitControlsRef = useRef<OrbitControlsImpl>(null);
  const currentStateRef = useRef<RelativeState | null>(null);

  // Simulation time hook
  const {
    elapsedTime,
    isPlaying,
    currentTheta,
    setIsPlaying,
    toggle: togglePlaying,
    advance: advanceTime,
    reset: resetTime,
    setElapsedTime,
    setBaseTheta,
  } = useSimulationTime();

  // Maneuver queue hook
  const {
    queue: maneuverQueue,
    previewLegs: waypointLegs,
    totalDeltaVValue,
    startExecution,
    checkLegTransition,
    cancelExecution,
    calculatePreview,
  } = useManeuverQueue();

  const controls = useRelativeMotionControls(
    togglePlaying,
    resetTime,
    () => {
      setManeuverConfig(null);
      cancelExecution();
      setWaypoints([]);
      setPostExecutionState(null);
      setPresetVersion((version) => version + 1);
    }
  );

  const {
    radialOffset,
    inTrackOffset,
    crossTrackOffset,
    radialVelocity,
    inTrackVelocity,
    crossTrackVelocity,
    numOrbits,
    timeAcceleration,
    setControls,
  } = controls;

  const handleExecuteBurn = useCallback(
    ({ targetPosition, transferTime, fmc }: ManeuverParams) => {
      if (!currentState) return;

      const deltaV = calculateRendezvousBurn(
        currentState,
        targetPosition,
        transferTime,
        ORBITAL_PARAMS.elements,
        currentTheta
      );

      const newVelocity = [
        currentState.velocity[0] + deltaV[0],
        currentState.velocity[1] + deltaV[1],
        currentState.velocity[2] + deltaV[2],
      ] as const;

      setControls({
        radialOffset: currentState.position[0],
        inTrackOffset: currentState.position[1],
        crossTrackOffset: currentState.position[2],
        radialVelocity: newVelocity[0],
        inTrackVelocity: newVelocity[1],
        crossTrackVelocity: newVelocity[2],
      });

      setManeuverConfig({ targetPosition, transferTime, fmc });
      setIsPlaying(true);
    },
    [currentState, currentTheta, setControls, setIsPlaying]
  );

  const { setValues: setManeuverControls } =
    useManeuverControls(handleExecuteBurn);

  useEffect(() => {
    if (presetVersion === 0) return;
    setManeuverControls({ fmc: false });
  }, [presetVersion, setManeuverControls]);

  // Waypoint handlers
  const handleAddWaypoint = useCallback(() => {
    if (waypoints.length >= 3) return;
    const defaultPosition: Vector3 = [
      0,
      (currentState?.position[1] ?? 0) - 500 * (waypoints.length + 1),
      0,
    ];
    setWaypoints((prev) => [
      ...prev,
      { id: crypto.randomUUID(), position: defaultPosition },
    ]);
  }, [waypoints.length, currentState]);

  const handleWaypointChange = useCallback((id: string, position: Vector3) => {
    setWaypoints((prev) =>
      prev.map((wp) => (wp.id === id ? { ...wp, position } : wp))
    );
  }, []);

  const handleClearWaypoints = useCallback(() => {
    setWaypoints([]);
  }, []);

  // Calculate preview when waypoints or state changes
  useEffect(() => {
    if (currentState && waypoints.length > 0) {
      calculatePreview(currentState, waypoints, elapsedTime);
    }
  }, [currentState, waypoints, elapsedTime, calculatePreview]);

  // Validate waypoints
  const validationErrors = useMemo(() => {
    if (!currentState || waypoints.length === 0) return [];
    return validateWaypoints(currentState.position, waypoints, waypointLegs);
  }, [currentState, waypoints, waypointLegs]);

  const handleExecuteWaypointManeuver = useCallback(() => {
    if (!currentState || waypoints.length === 0 || waypointLegs.length === 0)
      return;

    const newState = startExecution(currentState, waypoints, elapsedTime);
    if (!newState) return;

    // Apply first departure burn
    setControls({
      radialOffset: newState.position[0],
      inTrackOffset: newState.position[1],
      crossTrackOffset: newState.position[2],
      radialVelocity: newState.velocity[0],
      inTrackVelocity: newState.velocity[1],
      crossTrackVelocity: newState.velocity[2],
    });

    setWaypoints([]); // Clear waypoints after execution
    setManeuverConfig(null); // Clear any single-point maneuver
    setIsPlaying(true);
  }, [currentState, waypoints, waypointLegs.length, elapsedTime, setControls, startExecution, setIsPlaying]);

  // Waypoint controls
  useWaypointControls({
    waypointCount: waypoints.length,
    legs: waypointLegs,
    totalDeltaV: totalDeltaVValue,
    validationErrors,
    onAddWaypoint: handleAddWaypoint,
    onClearWaypoints: handleClearWaypoints,
    onExecute: handleExecuteWaypointManeuver,
    canExecute: currentState !== null && waypoints.length > 0,
  });

  useEffect(() => {
    currentStateRef.current = currentState;
  }, [currentState]);

  // Check for leg transitions when time changes
  useEffect(() => {
    const state = currentStateRef.current;
    if (!state) return;

    const result = checkLegTransition(elapsedTime, state);
    if (!result) return;

    // Apply the state update from the transition
    setControls({
      radialOffset: result.newState.position[0],
      inTrackOffset: result.newState.position[1],
      crossTrackOffset: result.newState.position[2],
      radialVelocity: result.newState.velocity[0],
      inTrackVelocity: result.newState.velocity[1],
      crossTrackVelocity: result.newState.velocity[2],
    });

    // Reset time for next leg or for free-flight after completion
    if (result.type === "continue" || result.type === "complete") {
      setElapsedTime(0);
    }

    // Update state for free-flight after waypoint completion
    if (result.type === "complete") {
      if (result.nextTheta !== undefined) {
        setBaseTheta(result.nextTheta);
      }
      // Store post-execution state in React state (bypasses Leva batching issue)
      setPostExecutionState({
        position: result.newState.position,
        velocity: result.newState.velocity,
      });
    }
  }, [elapsedTime, checkLegTransition, setControls, setElapsedTime, setBaseTheta]);

  // Disable OrbitControls while dragging waypoints
  const handleWaypointDragStart = useCallback(() => {
    if (orbitControlsRef.current) {
      orbitControlsRef.current.enabled = false;
    }
  }, []);

  const handleWaypointDragEnd = useCallback(() => {
    if (orbitControlsRef.current) {
      orbitControlsRef.current.enabled = true;
    }
  }, []);

  const initialRelativeState = useMemo(
    () =>
      createRelativeState({
        radialOffset,
        inTrackOffset,
        crossTrackOffset,
        radialVelocity,
        inTrackVelocity,
        crossTrackVelocity,
      }),
    [
      radialOffset,
      inTrackOffset,
      crossTrackOffset,
      radialVelocity,
      inTrackVelocity,
      crossTrackVelocity,
    ]
  );

  const initialStateKey = useMemo(
    () =>
      [
        radialOffset,
        inTrackOffset,
        crossTrackOffset,
        radialVelocity,
        inTrackVelocity,
        crossTrackVelocity,
      ].join("-"),
    [
      radialOffset,
      inTrackOffset,
      crossTrackOffset,
      radialVelocity,
      inTrackVelocity,
      crossTrackVelocity,
    ]
  );

  const controllerKey = `${initialStateKey}-${numOrbits}`;
  const simulationDuration = numOrbits * ORBITAL_PARAMS.period;

  const statsData = useMemo(() => {
    if (!currentState) {
      return { distance: 0, speed: 0 };
    }

    const distance = Math.sqrt(
      currentState.position[0] ** 2 +
        currentState.position[1] ** 2 +
        currentState.position[2] ** 2
    );

    const speed = Math.sqrt(
      currentState.velocity[0] ** 2 +
        currentState.velocity[1] ** 2 +
        currentState.velocity[2] ** 2
    );

    return { distance, speed };
  }, [currentState]);

  const handleStateUpdate = (state: RelativeState) => {
    setCurrentState(state);
  };

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Canvas camera={{ position: [10, 15, 100], fov: 40 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={1} />

        <RICAxes />
        <ChiefSpacecraft />
        <Trajectory
          initialState={postExecutionState ?? initialRelativeState}
          numOrbits={numOrbits}
          maneuverConfig={maneuverConfig}
          maneuverQueue={maneuverQueue}
          baseTheta={maneuverQueue?.currentTheta ?? currentTheta}
        />

        <TimeController
          key={controllerKey}
          isPlaying={isPlaying}
          acceleration={timeAcceleration}
          duration={simulationDuration}
          onAdvance={advanceTime}
        />

        <DeputySpacecraft
          initialState={postExecutionState ?? initialRelativeState}
          elapsedTime={elapsedTime}
          onStateUpdate={handleStateUpdate}
          maneuverConfig={maneuverConfig}
          baseTheta={maneuverQueue?.currentTheta ?? currentTheta}
        />

        <WaypointManager
          waypoints={waypoints}
          onWaypointChange={handleWaypointChange}
          onDragStart={handleWaypointDragStart}
          onDragEnd={handleWaypointDragEnd}
        />

        {currentState && waypoints.length > 0 && waypointLegs.length > 0 && (
          <WaypointPreview
            currentPosition={currentState.position}
            currentVelocity={currentState.velocity}
            waypoints={waypoints}
            legs={waypointLegs}
            currentTheta={currentTheta}
          />
        )}

        <OrbitControls ref={orbitControlsRef} />
      </Canvas>
      {currentState && (
        <Stats
          distance={statsData.distance}
          speed={statsData.speed}
          elapsedTime={elapsedTime}
          isPlaying={isPlaying}
        />
      )}
      <SimulationInfo />
      <Leva
        theme={{
          sizes: {
            rootWidth: "400px",
            controlWidth: "160px",
            numberInputMinWidth: "80px",
            rowHeight: "32px",
          },
          fontSizes: {
            root: "12px",
          },
        }}
      />
    </div>
  );
}

export default App;
