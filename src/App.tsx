import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Line } from "@react-three/drei";
import { useEffect, useMemo, useState, useRef } from "react";
import { Leva, useControls, button } from "leva";
import {
  propagateYA,
  trueAnomalyAtTime,
  orbitalPeriod,
  type OrbitalElements,
  type RelativeState,
  type Vector3,
} from "rpo-suite";
import * as THREE from "three";
import "./App.css";

const SCALE = 0.01;

// Orbital elements for a low Earth orbit
const orbitalElements: OrbitalElements = {
  eccentricity: 0.001,
  gravitationalParameter: 3.986004418e14, // Earth's mu (m^3/s^2)
  angularMomentum: 5.194e10, // for ~400km orbit (h = sqrt(mu*a), a = 6771km)
};

// Calculate orbital parameters
const ORBITAL_PARAMS = (() => {
  const {
    gravitationalParameter: mu,
    angularMomentum: h,
    eccentricity: e,
  } = orbitalElements;
  const a = (h * h) / (mu * (1 - e * e)); // semi-major axis
  const n = Math.sqrt(mu / (a * a * a)); // mean motion
  const period = orbitalPeriod(orbitalElements);

  return { elements: orbitalElements, period, meanMotion: n } as const;
})();

const TRAJECTORY_POINTS_PER_ORBIT = 120;

// Coordinate conversion: RIC to Three.js
// NOTE: This transformation reorders axes but preserves the right-handed orientation.
// Mapping: RIC [R, I, C] -> Three.js [I, R, C] -> [X, Y, Z]
// This maps the orbital plane (R-I) to the screen plane (X-Y), which is intuitive for RPO.
const toThreeJS = (ricPosition: Vector3): Vector3 =>
  [
    ricPosition[1] * SCALE, // I (In-track) -> X
    ricPosition[0] * SCALE, // R (Radial) -> Y
    ricPosition[2] * SCALE, // C (Cross-track) -> Z
  ] as const;

const naturalMotionInTrackVelocity = (radialOffset: number): number => {
  const {
    gravitationalParameter: mu,
    angularMomentum: h,
    eccentricity: e,
  } = orbitalElements;

  // Chief state at perigee (theta = 0)
  const r_c = (h * h) / (mu * (1 + e)); // Radius at perigee
  const v_c = h / r_c; // Velocity at perigee (purely tangential)

  // Deputy state
  const r_d = r_c + radialOffset; // Deputy radius

  // Required semi-major axis for deputy (equal to chief's for no drift)
  const a = (h * h) / (mu * (1 - e * e));

  // Vis-viva equation: v^2 = mu * (2/r - 1/a)
  const v_d_mag = Math.sqrt(mu * (2 / r_d - 1 / a));

  const v_rel = v_d_mag - v_c * (r_d / r_c);

  return -v_rel;
};

type TimeAdvanceResult = {
  readonly time: number;
  readonly completed: boolean;
};

const advanceSimulationTime = (
  current: number,
  deltaSeconds: number,
  acceleration: number,
  duration: number
): TimeAdvanceResult => {
  const nextTime = current + deltaSeconds * acceleration;

  if (nextTime >= duration) {
    return { time: duration, completed: true };
  }

  return { time: nextTime, completed: false };
};

type PresetName =
  | "R-bar Approach"
  | "V-bar Approach"
  | "NMC (2:1 Ellipse)"
  | "FMC (Flyaround)";

type RelativeStateParams = {
  radialOffset: number;
  inTrackOffset: number;
  crossTrackOffset: number;
  radialVelocity: number;
  inTrackVelocity: number;
  crossTrackVelocity: number;
};

type RelativeMotionParams = RelativeStateParams & {
  numOrbits: number;
  timeAcceleration: number;
};

type RelativeMotionControls = RelativeMotionParams;

// Preset configurations
const NMC_R0 = 1000;
const NMC_I0 = -2000;
const NMC_C0 = 0;

const FMC_R0 = 200;
const FMC_I0 = -600;
const FMC_C0 = 400;

const PRESET_CONFIGS: Record<PresetName, RelativeMotionParams> = {
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
  "FMC (Flyaround)": {
    radialOffset: FMC_R0,
    inTrackOffset: FMC_I0,
    crossTrackOffset: FMC_C0,
    radialVelocity: 0,
    inTrackVelocity: naturalMotionInTrackVelocity(FMC_R0),
    crossTrackVelocity: -0.04,
    numOrbits: 6,
    timeAcceleration: 35,
  },
};

const DEFAULT_PRESET: PresetName = "NMC (2:1 Ellipse)";

const createRelativeState = ({
  radialOffset,
  inTrackOffset,
  crossTrackOffset,
  radialVelocity,
  inTrackVelocity,
  crossTrackVelocity,
}: RelativeStateParams): RelativeState => {
  const state = {
    position: [radialOffset, inTrackOffset, crossTrackOffset] as const,
    velocity: [radialVelocity, inTrackVelocity, crossTrackVelocity] as const,
  };
  return state;
};

const getPresetConfig = (preset: PresetName) => PRESET_CONFIGS[preset];
const defaultPresetConfig = getPresetConfig(DEFAULT_PRESET);

const useRelativeMotionControls = (
  onPlayPause: () => void,
  onReset: () => void
): RelativeMotionControls => {
  const setControlsRef = useRef<
    ((values: Partial<RelativeMotionParams>) => void) | null
  >(null);

  const [controls, setControls] = useControls(() => ({
    "R-bar Approach": button(() =>
      setControlsRef.current?.(PRESET_CONFIGS["R-bar Approach"])
    ),
    "V-bar Approach": button(() =>
      setControlsRef.current?.(PRESET_CONFIGS["V-bar Approach"])
    ),
    "NMC (2:1 Ellipse)": button(() =>
      setControlsRef.current?.(PRESET_CONFIGS["NMC (2:1 Ellipse)"])
    ),
    "FMC (Flyaround)": button(() =>
      setControlsRef.current?.(PRESET_CONFIGS["FMC (Flyaround)"])
    ),
    radialOffset: {
      label: "Radial Offset (m)",
      value: defaultPresetConfig.radialOffset,
      min: -4000,
      max: 4000,
      step: 1,
    },
    inTrackOffset: {
      label: "In-track Offset (m)",
      value: defaultPresetConfig.inTrackOffset,
      min: -6000,
      max: 6000,
      step: 1,
    },
    crossTrackOffset: {
      label: "Cross-track Offset (m)",
      value: defaultPresetConfig.crossTrackOffset,
      min: -2000,
      max: 2000,
      step: 1,
    },
    radialVelocity: {
      label: "Radial Velocity (m/s)",
      value: defaultPresetConfig.radialVelocity,
      min: -5,
      max: 5,
      step: 0.01,
    },
    inTrackVelocity: {
      label: "In-track Velocity (m/s)",
      value: defaultPresetConfig.inTrackVelocity,
      min: -5,
      max: 5,
      step: 0.01,
    },
    crossTrackVelocity: {
      label: "Cross-track Velocity (m/s)",
      value: defaultPresetConfig.crossTrackVelocity,
      min: -5,
      max: 5,
      step: 0.01,
    },
    numOrbits: {
      label: "Orbit Count",
      value: defaultPresetConfig.numOrbits,
      min: 1,
      max: 20,
      step: 1,
    },
    timeAcceleration: {
      label: "Time Scale",
      value: defaultPresetConfig.timeAcceleration,
      min: 1,
      max: 150,
      step: 1,
    },
    "Play / Pause": button(onPlayPause),
    Reset: button(onReset),
  }));

  useEffect(() => {
    setControlsRef.current = setControls;
  }, [setControls]);

  return controls as RelativeMotionControls;
};

function ChiefSpacecraft() {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#00ff00" />
      </mesh>
      <Text position={[0, 1.5, 0]} fontSize={0.5} color="#00ff00">
        Chief
      </Text>
    </group>
  );
}

type TrajectoryProps = {
  readonly initialState: RelativeState;
  readonly numOrbits: number;
};

function Trajectory({ initialState, numOrbits }: TrajectoryProps) {
  const points = useMemo(() => {
    const trajectoryPoints: Vector3[] = [];
    const totalPoints = numOrbits * TRAJECTORY_POINTS_PER_ORBIT;

    for (let i = 0; i <= totalPoints; i++) {
      const deltaTime =
        (i / TRAJECTORY_POINTS_PER_ORBIT) * ORBITAL_PARAMS.period;
      const theta0 = 0;
      const thetaF = trueAnomalyAtTime(
        ORBITAL_PARAMS.elements,
        theta0,
        deltaTime
      );

      const state = propagateYA(
        initialState,
        ORBITAL_PARAMS.elements,
        theta0,
        thetaF,
        deltaTime,
        "RIC"
      );

      trajectoryPoints.push(toThreeJS(state.position));
    }

    return trajectoryPoints;
  }, [initialState, numOrbits]);

  return <Line points={points} color="#00ffff" lineWidth={1} />;
}

type StatsProps = {
  readonly distance: number;
  readonly speed: number;
  readonly elapsedTime: number;
  readonly isPlaying: boolean;
};

function Stats({ distance, speed, elapsedTime, isPlaying }: StatsProps) {
  return (
    <div
      style={{
        position: "absolute",
        top: "10px",
        left: "10px",
        background: "rgba(0,0,0,0.8)",
        color: "#00ff00",
        padding: "15px",
        fontFamily: "monospace",
        fontSize: "14px",
        borderRadius: "5px",
        minWidth: "200px",
      }}
    >
      <div
        style={{ marginBottom: "8px", color: "#00ffff", fontWeight: "bold" }}
      >
        {isPlaying ? "RUNNING" : "PAUSED"}
      </div>
      <div>Distance: {distance.toFixed(1)} m</div>
      <div>Speed: {speed.toFixed(3)} m/s</div>
      <div>Time: {(elapsedTime / 60).toFixed(1)} min</div>
      <div>Orbit: {(elapsedTime / ORBITAL_PARAMS.period).toFixed(2)}</div>
    </div>
  );
}

type TimeControllerProps = {
  readonly acceleration: number;
  readonly duration: number;
  readonly onPlayPauseRef: (fn: () => void) => void;
  readonly onResetRef: (fn: () => void) => void;
  readonly onPlayingChange: (isPlaying: boolean) => void;
  readonly onTimeChange: (elapsedTime: number) => void;
};

function TimeController({
  acceleration,
  duration,
  onPlayPauseRef,
  onResetRef,
  onPlayingChange,
  onTimeChange,
}: TimeControllerProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);

  useFrame((_, delta) => {
    if (isPlaying) {
      setElapsedTime((current) => {
        const { time, completed } = advanceSimulationTime(
          current,
          delta,
          acceleration,
          duration
        );

        if (completed) {
          setIsPlaying(false);
        }

        return time;
      });
    }
  });

  useEffect(() => {
    onPlayingChange(isPlaying);
  }, [isPlaying, onPlayingChange]);

  useEffect(() => {
    onTimeChange(elapsedTime);
  }, [elapsedTime, onTimeChange]);

  useEffect(() => {
    onPlayPauseRef(() => setIsPlaying((p) => !p));
    onResetRef(() => {
      setElapsedTime(0);
      setIsPlaying(true);
    });
  }, [onPlayPauseRef, onResetRef]);

  return null;
}

type DeputyProps = {
  readonly initialState: RelativeState;
  readonly elapsedTime: number;
  readonly onStateUpdate: (state: RelativeState) => void;
};

function DeputySpacecraft({
  initialState,
  elapsedTime,
  onStateUpdate,
}: DeputyProps) {
  const state = useMemo(() => {
    const theta0 = 0;
    const thetaF = trueAnomalyAtTime(
      ORBITAL_PARAMS.elements,
      theta0,
      elapsedTime
    );

    return propagateYA(
      initialState,
      ORBITAL_PARAMS.elements,
      theta0,
      thetaF,
      elapsedTime,
      "RIC"
    );
  }, [elapsedTime, initialState]);

  const position = useMemo(() => toThreeJS(state.position), [state]);

  useEffect(() => {
    onStateUpdate(state);
  }, [state, onStateUpdate]);

  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color="#ff6600" />
      </mesh>
      <Text position={[0, 1, 0]} fontSize={0.4} color="#ff6600">
        Deputy
      </Text>
    </group>
  );
}

function RICAxes() {
  // Display RIC coordinate frame axes (mapped to Three.js for visualization)
  // Grid shows the I-C plane (Horizontal plane)
  return (
    <group>
      {/* R axis (Radial) - Green - Y axis */}
      <arrowHelper
        args={[
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(0, 0, 0),
          10,
          0x00ff00,
        ]}
      />
      <Text position={[0, 11, 0]} fontSize={0.8} color="green">
        R (Radial)
      </Text>

      {/* I axis (In-track) - Red - X axis */}
      <arrowHelper
        args={[
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(0, 0, 0),
          10,
          0xff0000,
        ]}
      />
      <Text position={[13, 0, 0]} fontSize={0.8} color="red">
        I (In-track)
      </Text>

      {/* C axis (Cross-track) - Blue - Z axis */}
      <arrowHelper
        args={[
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(0, 0, 0),
          10,
          0x0000ff,
        ]}
      />
      <Text position={[0, 0, 11]} fontSize={0.8} color="blue">
        C (Cross-track)
      </Text>

      {/* Grid on the R-I plane (Orbital Plane) - X-Y */}
      <gridHelper
        args={[60, 60, 0x444444, 0x222222]}
        rotation={[Math.PI / 2, 0, 0]}
      />
      <Text
        position={[30, 30, 0]}
        fontSize={0.8}
        color="#666666"
        rotation={[0, 0, 0]}
      >
        Orbital Plane (R-I)
      </Text>
    </group>
  );
}

function App() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentState, setCurrentState] = useState<RelativeState | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const playPauseRef = useRef<() => void>(() => {});
  const resetRef = useRef<() => void>(() => {});

  const controls = useRelativeMotionControls(
    () => playPauseRef.current(),
    () => resetRef.current()
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
  } = controls;

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
        <Trajectory initialState={initialRelativeState} numOrbits={numOrbits} />

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
      <Leva
        collapsed
        theme={{
          sizes: {
            rootWidth: "400px",
            controlWidth: "160px",
            numberInputMinWidth: "80px",
            rowHeight: "32px",
          },
          fontSizes: {
            root: "14px",
          },
        }}
      />
    </div>
  );
}

export default App;
