import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { Leva } from "leva";
import { type RelativeState } from "rpo-suite";

import { ORBITAL_PARAMS } from "./config/orbital";
import { createRelativeState } from "./utils/physics";
import { useRelativeMotionControls } from "./hooks/useRelativeMotionControls";
import { useManeuverControls } from "./hooks/useManeuverControls";
import { type ManeuverParams } from "./types/simulation";
import { calculateRendezvousBurn } from "./utils/maneuvers";
import { trueAnomalyAtTime } from "rpo-suite";

import { ChiefSpacecraft } from "./components/ChiefSpacecraft";
import { DeputySpacecraft } from "./components/DeputySpacecraft";
import { RICAxes } from "./components/RICAxes";
import { SimulationInfo } from "./components/SimulationInfo";
import { Stats } from "./components/Stats";
import { TimeController } from "./components/TimeController";
import { Trajectory } from "./components/Trajectory";

function App() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentState, setCurrentState] = useState<RelativeState | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [maneuverConfig, setManeuverConfig] = useState<ManeuverParams | null>(
    null
  );
  const [presetVersion, setPresetVersion] = useState(0);

  const playPauseRef = useRef<() => void>(() => {});
  const resetRef = useRef<() => void>(() => {});

  const controls = useRelativeMotionControls(
    () => playPauseRef.current(),
    () => resetRef.current(),
    () => {
      setManeuverConfig(null);
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

      setElapsedTime(0);
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
        />

        <TimeController
          key={controllerKey}
          acceleration={timeAcceleration}
          duration={simulationDuration}
          onPlayPauseRef={(fn) => (playPauseRef.current = fn)}
          onResetRef={(fn) => (resetRef.current = fn)}
          onPlayingChange={handlePlayingChange}
          onTimeChange={setElapsedTime}
        />

        <DeputySpacecraft
          initialState={initialRelativeState}
          elapsedTime={elapsedTime}
          onStateUpdate={handleStateUpdate}
          maneuverConfig={maneuverConfig}
        />

        <OrbitControls />
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
