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
import { type ManeuverParams } from "./types/simulation";
import { type Waypoint, type ManeuverQueue } from "./types/waypoint";
import { calculateRendezvousBurn } from "./utils/maneuvers";
import {
  calculateManeuverQueue,
  calculateLegManeuver,
  totalDeltaV,
  validateWaypoints,
} from "./utils/waypointManeuvers";
import { trueAnomalyAtTime } from "rpo-suite";

import { ChiefSpacecraft } from "./components/ChiefSpacecraft";
import { DeputySpacecraft } from "./components/DeputySpacecraft";
import { RICAxes } from "./components/RICAxes";
import { SimulationInfo } from "./components/SimulationInfo";
import { Stats } from "./components/Stats";
import {
  TimeController,
  type TimeControllerHandle,
} from "./components/TimeController";
import { Trajectory } from "./components/Trajectory";
import { WaypointManager } from "./components/WaypointManager";
import { WaypointPreview } from "./components/WaypointPreview";

function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentState, setCurrentState] = useState<RelativeState | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [maneuverConfig, setManeuverConfig] = useState<ManeuverParams | null>(
    null
  );
  const [presetVersion, setPresetVersion] = useState(0);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [maneuverQueue, setManeuverQueue] = useState<ManeuverQueue | null>(
    null
  );

  const timeControllerRef = useRef<TimeControllerHandle>(null);
  const orbitControlsRef = useRef<OrbitControlsImpl>(null);
  const maneuverQueueRef = useRef<ManeuverQueue | null>(null);
  const currentStateRef = useRef<RelativeState | null>(null);
  const executingWaypointsRef = useRef<Waypoint[]>([]); // Waypoints during execution

  const controls = useRelativeMotionControls(
    () => timeControllerRef.current?.toggle(),
    () => timeControllerRef.current?.reset(),
    () => {
      setManeuverConfig(null);
      setManeuverQueue(null); // Clear waypoint queue on reset
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

      const currentTheta = trueAnomalyAtTime(
        ORBITAL_PARAMS.elements,
        0,
        elapsedTime
      );

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
    [currentState, elapsedTime, setControls]
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

  // Calculate legs for preview (when waypoints change)
  const waypointLegs = useMemo(() => {
    if (!currentState || waypoints.length === 0) return [];
    const currentTheta = trueAnomalyAtTime(
      ORBITAL_PARAMS.elements,
      0,
      elapsedTime
    );
    return calculateManeuverQueue(currentState, waypoints, currentTheta);
  }, [currentState, waypoints, elapsedTime]);

  // Validate waypoints
  const validationErrors = useMemo(() => {
    if (!currentState || waypoints.length === 0) return [];
    return validateWaypoints(currentState.position, waypoints, waypointLegs);
  }, [currentState, waypoints, waypointLegs]);

  const handleExecuteWaypointManeuver = useCallback(() => {
    if (!currentState || waypoints.length === 0 || waypointLegs.length === 0)
      return;

    // Calculate current theta at execution time
    const startTheta = trueAnomalyAtTime(
      ORBITAL_PARAMS.elements,
      0,
      elapsedTime
    );

    // Recalculate first leg fresh at execution time
    const { leg: freshFirstLeg } = calculateLegManeuver(
      currentState,
      waypoints[0].position,
      startTheta
    );

    // Apply first departure burn
    setControls({
      radialOffset: currentState.position[0],
      inTrackOffset: currentState.position[1],
      crossTrackOffset: currentState.position[2],
      radialVelocity: currentState.velocity[0] + freshFirstLeg.deltaV[0],
      inTrackVelocity: currentState.velocity[1] + freshFirstLeg.deltaV[1],
      crossTrackVelocity: currentState.velocity[2] + freshFirstLeg.deltaV[2],
    });

    // Store legs with updated first leg (rest are for preview only, will be recalculated)
    const updatedLegs = [...waypointLegs];
    updatedLegs[0] = freshFirstLeg;

    // Store waypoints for execution (before clearing)
    executingWaypointsRef.current = [...waypoints];

    setManeuverQueue({
      legs: updatedLegs,
      currentLegIndex: 0,
      startTheta,
      currentTheta: startTheta,
    });

    setWaypoints([]); // Clear waypoints after execution
    setManeuverConfig(null); // Clear any single-point maneuver
    setIsPlaying(true);
  }, [currentState, waypoints, waypointLegs, elapsedTime, setControls]);

  // Waypoint controls
  useWaypointControls({
    waypointCount: waypoints.length,
    legs: waypointLegs,
    totalDeltaV: totalDeltaV(waypointLegs),
    validationErrors,
    onAddWaypoint: handleAddWaypoint,
    onClearWaypoints: handleClearWaypoints,
    onExecute: handleExecuteWaypointManeuver,
    canExecute: currentState !== null && waypoints.length > 0,
  });

  useEffect(() => {
    maneuverQueueRef.current = maneuverQueue;
  }, [maneuverQueue]);

  useEffect(() => {
    currentStateRef.current = currentState;
  }, [currentState]);

  // Handle time changes and leg transitions
  const handleTimeChange = useCallback(
    (newTime: number) => {
      setElapsedTime(newTime);

      // Check for leg transitions during queue execution
      const queue = maneuverQueueRef.current;
      const state = currentStateRef.current;
      if (!queue || !state) return;

      const currentLeg = queue.legs[queue.currentLegIndex];
      if (newTime < currentLeg.transferTime) return;

      const nextIndex = queue.currentLegIndex + 1;

      // Calculate the theta at end of current leg
      const nextTheta = trueAnomalyAtTime(
        ORBITAL_PARAMS.elements,
        queue.currentTheta,
        currentLeg.transferTime
      );

      if (nextIndex < queue.legs.length) {
        // More legs to execute
        const nextWaypoint = executingWaypointsRef.current[nextIndex];
        if (!nextWaypoint) {
          // Safety check - shouldn't happen but clear queue if it does
          setManeuverQueue(null);
          executingWaypointsRef.current = [];
          return;
        }

        // Arrival: Set state at waypoint with zero velocity (arrival burn applied)
        const stationaryState = {
          position: state.position,
          velocity: [0, 0, 0] as const,
        };

        // Recalculate next leg's departure burn fresh using actual current state
        const { leg: freshNextLeg } = calculateLegManeuver(
          stationaryState,
          nextWaypoint.position,
          nextTheta
        );

        // Apply next departure burn (from zero velocity)
        setControls({
          radialOffset: state.position[0],
          inTrackOffset: state.position[1],
          crossTrackOffset: state.position[2],
          radialVelocity: freshNextLeg.deltaV[0],
          inTrackVelocity: freshNextLeg.deltaV[1],
          crossTrackVelocity: freshNextLeg.deltaV[2],
        });

        // Update queue with fresh leg data and new theta
        setManeuverQueue((prev) => {
          if (!prev) return null;
          const updatedLegs = [...prev.legs];
          updatedLegs[nextIndex] = freshNextLeg;
          return {
            ...prev,
            legs: updatedLegs,
            currentLegIndex: nextIndex,
            currentTheta: nextTheta,
          };
        });
        setElapsedTime(0);
      } else {
        // All legs complete
        // Apply final arrival burn: null the velocity at final waypoint
        setControls({
          radialOffset: state.position[0],
          inTrackOffset: state.position[1],
          crossTrackOffset: state.position[2],
          radialVelocity: 0,
          inTrackVelocity: 0,
          crossTrackVelocity: 0,
        });
        setManeuverQueue(null);
        executingWaypointsRef.current = [];
      }
    },
    [setControls]
  );

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

  const handlePlayingChange = (playing: boolean) => {
    setIsPlaying(playing);
  };

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Canvas camera={{ position: [10, 15, 100], fov: 40 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={1} />

        <RICAxes />
        <ChiefSpacecraft />
        <Trajectory
          initialState={initialRelativeState}
          numOrbits={numOrbits}
          maneuverConfig={maneuverConfig}
          maneuverQueue={maneuverQueue}
          baseTheta={maneuverQueue?.currentTheta ?? 0}
        />

        <TimeController
          key={controllerKey}
          ref={timeControllerRef}
          acceleration={timeAcceleration}
          duration={simulationDuration}
          isPlaying={isPlaying}
          onPlayingChange={handlePlayingChange}
          onTimeChange={handleTimeChange}
        />

        <DeputySpacecraft
          initialState={initialRelativeState}
          elapsedTime={elapsedTime}
          onStateUpdate={handleStateUpdate}
          maneuverConfig={maneuverConfig}
          baseTheta={maneuverQueue?.currentTheta ?? 0}
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
            currentTheta={trueAnomalyAtTime(
              ORBITAL_PARAMS.elements,
              0,
              elapsedTime
            )}
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
