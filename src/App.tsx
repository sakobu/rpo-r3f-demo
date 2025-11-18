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

// RIC frame: R (radial), I (in-track), C (cross-track)
// Library uses [R, I, C] order for position and velocity
// In Three.js: X = I (in-track), Y = C (cross-track), Z = R (radial)

const SCALE = 0.01; // Scale down from meters to scene units

// Orbital elements for a low Earth orbit
const orbitalElements: OrbitalElements = {
  eccentricity: 0.001,
  gravitationalParameter: 3.986004418e14, // Earth's μ (m³/s²)
  angularMomentum: 5.409e10, // for ~400km orbit
};

// Calculate orbital parameters
const ORBITAL_PARAMS = (() => {
  const {
    gravitationalParameter: mu,
    angularMomentum: h,
    eccentricity: e,
  } = orbitalElements;
  const a = (h * h) / (mu * (1 - e * e)); // semi-major axis
  const n = Math.sqrt(mu / (a * a * a)); // mean motion (correct formula)
  const period = orbitalPeriod(orbitalElements);

  console.log("Orbital period:", period, "seconds");
  console.log("Mean motion n:", n, "rad/s");
  console.log("Semi-major axis a:", a, "meters");

  return { elements: orbitalElements, period, meanMotion: n } as const;
})();

const TRAJECTORY_POINTS_PER_ORBIT = 120;

// Coordinate conversion: RIC to Three.js
const toThreeJS = (ricPosition: Vector3): Vector3 =>
  [
    ricPosition[1] * SCALE, // I -> X
    ricPosition[2] * SCALE, // C -> Y
    ricPosition[0] * SCALE, // R -> Z
  ] as const;

const computeNaturalMotionVelocity = (inTrack: number): number =>
  0.5 * ORBITAL_PARAMS.meanMotion * inTrack;

const CUSTOM_PRESET = "Custom" as const;
const PRESET_NAMES = [
  "R-bar Approach",
  "V-bar Approach",
  "NMC (2:1 Ellipse)",
  "FMC (Flyaround)",
] as const;

type PresetName = (typeof PRESET_NAMES)[number];
type PresetOption = typeof CUSTOM_PRESET | PresetName;

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

type RelativeMotionControls = RelativeMotionParams & {
  preset: PresetOption;
};

// Preset configurations
const R0 = 1000;
const I0 = -2000;
const C0 = 0;

const PRESET_CONFIGS: Record<PresetName, RelativeMotionParams> = {
  "R-bar Approach": {
    radialOffset: 1500,
    inTrackOffset: 0,
    crossTrackOffset: 0,
    radialVelocity: -0.05,
    inTrackVelocity: 0,
    crossTrackVelocity: 0,
    numOrbits: 2,
    timeAcceleration: 20,
  },
  "V-bar Approach": {
    radialOffset: 0,
    inTrackOffset: -1500,
    crossTrackOffset: 0,
    radialVelocity: 0,
    inTrackVelocity: 0.05,
    crossTrackVelocity: 0,
    numOrbits: 2,
    timeAcceleration: 20,
  },
  "NMC (2:1 Ellipse)": {
    radialOffset: R0,
    inTrackOffset: I0,
    crossTrackOffset: C0,
    radialVelocity: computeNaturalMotionVelocity(I0),
    inTrackVelocity: 0,
    crossTrackVelocity: 0,
    numOrbits: 10,
    timeAcceleration: 50,
  },
  "FMC (Flyaround)": {
    radialOffset: 200,
    inTrackOffset: -600,
    crossTrackOffset: 400,
    radialVelocity: 0,
    inTrackVelocity: 0.02,
    crossTrackVelocity: -0.04,
    numOrbits: 6,
    timeAcceleration: 35,
  },
};

const DEFAULT_PRESET: PresetName = "NMC (2:1 Ellipse)";
const PRESET_OPTIONS: PresetOption[] = [CUSTOM_PRESET, ...PRESET_NAMES];
const CONTROL_FIELDS = [
  "radialOffset",
  "inTrackOffset",
  "crossTrackOffset",
  "radialVelocity",
  "inTrackVelocity",
  "crossTrackVelocity",
  "numOrbits",
  "timeAcceleration",
] as const satisfies readonly (keyof RelativeMotionParams)[];

const createRelativeState = ({
  radialOffset,
  inTrackOffset,
  crossTrackOffset,
  radialVelocity,
  inTrackVelocity,
  crossTrackVelocity,
}: RelativeStateParams): RelativeState => ({
  position: [radialOffset, inTrackOffset, crossTrackOffset] as const,
  velocity: [radialVelocity, inTrackVelocity, crossTrackVelocity] as const,
});

const getPresetConfig = (preset: PresetName) => PRESET_CONFIGS[preset];
const defaultPresetConfig = getPresetConfig(DEFAULT_PRESET);

const matchesPreset = (values: RelativeMotionParams, preset: PresetName) => {
  const presetConfig = getPresetConfig(preset);
  return CONTROL_FIELDS.every((field) => values[field] === presetConfig[field]);
};

const useRelativeMotionControls = (
  onPlayPause: () => void,
  onReset: () => void
): RelativeMotionControls => {
  const [controls, setControls] = useControls(() => ({
    preset: {
      label: "Preset",
      value: DEFAULT_PRESET,
      options: PRESET_OPTIONS,
    },
    radialOffset: {
      label: "Radial Offset (m)",
      value: defaultPresetConfig.radialOffset,
      min: -4000,
      max: 4000,
      step: 10,
    },
    inTrackOffset: {
      label: "In-track Offset (m)",
      value: defaultPresetConfig.inTrackOffset,
      min: -6000,
      max: 6000,
      step: 10,
    },
    crossTrackOffset: {
      label: "Cross-track Offset (m)",
      value: defaultPresetConfig.crossTrackOffset,
      min: -2000,
      max: 2000,
      step: 10,
    },
    radialVelocity: {
      label: "Radial Velocity (m/s)",
      value: defaultPresetConfig.radialVelocity,
      min: -2,
      max: 2,
      step: 0.01,
    },
    inTrackVelocity: {
      label: "In-track Velocity (m/s)",
      value: defaultPresetConfig.inTrackVelocity,
      min: -2,
      max: 2,
      step: 0.01,
    },
    crossTrackVelocity: {
      label: "Cross-track Velocity (m/s)",
      value: defaultPresetConfig.crossTrackVelocity,
      min: -2,
      max: 2,
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
    "Play /Pause": button(onPlayPause),
    Reset: button(onReset),
  }));

  const controlValues = controls as RelativeMotionControls;

  const {
    preset,
    radialOffset,
    inTrackOffset,
    crossTrackOffset,
    radialVelocity,
    inTrackVelocity,
    crossTrackVelocity,
    numOrbits,
    timeAcceleration,
  } = controlValues;

  useEffect(() => {
    if (preset === CUSTOM_PRESET) {
      return;
    }
    const presetConfig = getPresetConfig(preset);
    setControls({
      radialOffset: presetConfig.radialOffset,
      inTrackOffset: presetConfig.inTrackOffset,
      crossTrackOffset: presetConfig.crossTrackOffset,
      radialVelocity: presetConfig.radialVelocity,
      inTrackVelocity: presetConfig.inTrackVelocity,
      crossTrackVelocity: presetConfig.crossTrackVelocity,
      numOrbits: presetConfig.numOrbits,
      timeAcceleration: presetConfig.timeAcceleration,
    });
  }, [preset, setControls]);

  useEffect(() => {
    if (preset === CUSTOM_PRESET) {
      return;
    }
    const currentValues: RelativeMotionParams = {
      radialOffset,
      inTrackOffset,
      crossTrackOffset,
      radialVelocity,
      inTrackVelocity,
      crossTrackVelocity,
      numOrbits,
      timeAcceleration,
    };
    if (matchesPreset(currentValues, preset)) {
      return;
    }
    setControls({ preset: CUSTOM_PRESET });
  }, [
    preset,
    radialOffset,
    inTrackOffset,
    crossTrackOffset,
    radialVelocity,
    inTrackVelocity,
    crossTrackVelocity,
    numOrbits,
    timeAcceleration,
    setControls,
  ]);

  return controlValues;
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

type VelocityVectorProps = {
  readonly position: Vector3;
  readonly velocity: Vector3;
};

function VelocityVector({ position, velocity }: VelocityVectorProps) {
  const start = useMemo(
    () => new THREE.Vector3(...toThreeJS(position)),
    [position]
  );

  const direction = useMemo(() => {
    const vel = new THREE.Vector3(velocity[1], velocity[2], velocity[0]);
    return vel.normalize();
  }, [velocity]);

  const magnitude = useMemo(() => {
    const speed = Math.sqrt(
      velocity[0] ** 2 + velocity[1] ** 2 + velocity[2] ** 2
    );
    return speed * SCALE * 5; // Scale up for visibility
  }, [velocity]);

  return (
    <arrowHelper
      args={[
        direction,
        start,
        magnitude,
        0xffff00,
        magnitude * 0.2,
        magnitude * 0.1,
      ]}
    />
  );
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
        {isPlaying ? "▶ RUNNING" : "⏸ PAUSED"}
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
  readonly onPlayPauseRef: (fn: () => void) => void;
  readonly onResetRef: (fn: () => void) => void;
  readonly onPlayingChange: (isPlaying: boolean) => void;
  readonly onTimeChange: (elapsedTime: number) => void;
};

function TimeController({
  acceleration,
  onPlayPauseRef,
  onResetRef,
  onPlayingChange,
  onTimeChange,
}: TimeControllerProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);

  useFrame((_, delta) => {
    if (isPlaying) {
      setElapsedTime((t) => t + delta * acceleration);
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
      <VelocityVector position={state.position} velocity={state.velocity} />
    </group>
  );
}

function RICAxes() {
  return (
    <group>
      {/* R axis (Radial) - Blue - Z axis */}
      <arrowHelper
        args={[
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(0, 0, 0),
          10,
          0x0000ff,
        ]}
      />
      <Text position={[0, 0, 11]} fontSize={0.8} color="blue">
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
      <Text position={[11, 0, 0]} fontSize={0.8} color="red">
        I (In-track)
      </Text>

      {/* C axis (Cross-track) - Green - Y axis */}
      <arrowHelper
        args={[
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(0, 0, 0),
          10,
          0x00ff00,
        ]}
      />
      <Text position={[0, 11, 0]} fontSize={0.8} color="green">
        C (Cross-track)
      </Text>

      {/* Grid on the I-R plane */}
      <gridHelper
        args={[60, 60, 0x666666, 0x333333]}
        rotation={[Math.PI / 2, 0, 0]}
      />
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
      <Canvas camera={{ position: [20, 20, 20], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={1} />

        <RICAxes />
        <ChiefSpacecraft />
        <Trajectory initialState={initialRelativeState} numOrbits={numOrbits} />

        <TimeController
          key={initialStateKey}
          acceleration={timeAcceleration}
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
      <Leva collapsed />
    </div>
  );
}

export default App;
