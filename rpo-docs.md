# RPO Suite

TypeScript library for spacecraft relative motion propagation implementing the Yamanaka-Ankersen and Clohessy-Wiltshire algorithms for Rendezvous and Proximity Operations.

## Overview

This library provides analytical solutions for propagating the relative state between two spacecraft in orbit. The implementation is based on the analytical state transition matrix derived in Yamanaka & Ankersen (2002), which extends the classical Clohessy-Wiltshire equations to handle elliptical reference orbits with exact analytical solutions.

Two propagation methods are provided:

- Yamanaka-Ankersen State Transition Matrix for elliptical orbits (0 <= e < 1)
- Clohessy-Wiltshire equations for circular orbits (e = 0)

## Demo

[View Demo on StackBlitz](https://stackblitz.com/edit/vitejs-vite-spbbqvbx?embed=1&file=src%2FApp.tsx)

## Installation

```bash
npm install rpo-suite
```

## Usage

```typescript
import {
  propagateYA,
  trueAnomalyAtTime,
  type OrbitalElements,
  type RelativeState,
} from "rpo-suite";

const elements: OrbitalElements = {
  eccentricity: 0.1,
  gravitationalParameter: 3.986004418e14,
  angularMomentum: 5.409e10,
};

const initialState: RelativeState = {
  position: [100, 200, 50] as const,
  velocity: [0.5, -0.2, 0.1] as const,
};

const theta0 = 0;
const deltaTime = 1000;
const thetaF = trueAnomalyAtTime(elements, theta0, deltaTime);

const finalState = propagateYA(
  initialState,
  elements,
  theta0,
  thetaF,
  deltaTime,
  "RIC"
);
```

## API Reference

### Type Definitions

```typescript
type Vector3 = readonly [number, number, number];

type RelativeState = {
  readonly position: Vector3;
  readonly velocity: Vector3;
};

type OrbitalElements = {
  readonly eccentricity: number;
  readonly angularMomentum: number;
  readonly gravitationalParameter: number;
};

type TrueAnomaly = number;

type Frame = "RIC" | "LVLH";

type InPlaneState = {
  readonly x: number;
  readonly z: number;
  readonly vx: number;
  readonly vz: number;
};

type OutOfPlaneState = {
  readonly y: number;
  readonly vy: number;
};

type DeriveAngularMomentum = (
  eccentricity: number,
  meanMotionRevPerDay: number,
  mu: number
) => number;
```

### Core Functions

#### `propagateYA`

```typescript
function propagateYA(
  initialState: RelativeState,
  elements: OrbitalElements,
  theta0: TrueAnomaly,
  thetaF: TrueAnomaly,
  deltaTime: number,
  frame: Frame
): RelativeState;
```

Propagates relative state using the Yamanaka-Ankersen State Transition Matrix. Implements Equations 80-84 from Yamanaka & Ankersen (2002) for elliptical reference orbits.

#### `propagateHCW`

```typescript
function propagateHCW(
  initialState: RelativeState,
  orbitalRate: number,
  deltaTime: number,
  frame: Frame
): RelativeState;
```

Propagates relative state using the Clohessy-Wiltshire equations for circular reference orbits.

### Utilities

#### `trueAnomalyAtTime`

```typescript
function trueAnomalyAtTime(
  elements: OrbitalElements,
  theta0: TrueAnomaly,
  deltaTime: number
): TrueAnomaly;
```

Computes true anomaly at a future time using Kepler propagation.

#### `trueAnomalyFromMean`

```typescript
function trueAnomalyFromMean(
  meanAnomaly: number,
  eccentricity: number,
  tolerance?: number
): TrueAnomaly;
```

Converts mean anomaly to true anomaly by solving Kepler equation using Newton-Raphson iteration.

#### `orbitalPeriod`

```typescript
function orbitalPeriod(elements: OrbitalElements): number;
```

Calculates orbital period from orbital elements.

#### `deriveAngularMomentum`

```typescript
function deriveAngularMomentum(
  eccentricity: number,
  meanMotionRevPerDay: number,
  mu: number
): number;
```

Derives specific angular momentum from TLE mean motion and eccentricity.

### Coordinate Transformations

```typescript
function toModifiedCoordinates(
  state: RelativeState,
  elements: OrbitalElements,
  theta: TrueAnomaly
): RelativeState;

function fromModifiedCoordinates(
  modifiedState: RelativeState,
  elements: OrbitalElements,
  theta: TrueAnomaly
): RelativeState;
```

Transforms between true and modified coordinates as defined in Yamanaka & Ankersen (2002).

### Auxiliary Functions

```typescript
function kSquared(elements: OrbitalElements): number;
function rho(eccentricity: number, theta: TrueAnomaly): number;
function s(eccentricity: number, theta: TrueAnomaly): number;
function c(eccentricity: number, theta: TrueAnomaly): number;
function sPrime(eccentricity: number, theta: TrueAnomaly): number;
function cPrime(eccentricity: number, theta: TrueAnomaly): number;
function J(elements: OrbitalElements, deltaTime: number): number;
```

Low-level functions corresponding to auxiliary variables in Yamanaka & Ankersen (2002).

## Reference Frames

Two local-orbital reference frames are supported:

**RIC**: Radial, In-track, Cross-track

- R: Radial (away from Earth center)
- I: In-track (along velocity)
- C: Cross-track (normal to orbital plane)

**LVLH**: Local Vertical Local Horizontal (ordered as I, C, R)

## Units

All quantities use SI units: meters (m), meters per second (m/s), seconds (s), and radians (rad). Gravitational parameter mu is in m^3/s^2 and angular momentum h is in m^2/s.

## Advanced Usage

### Computing Orbital Elements from TLE

```typescript
import { deriveAngularMomentum } from "rpo-suite";

const elements = {
  eccentricity: 0.0001084,
  angularMomentum: deriveAngularMomentum(
    0.0001084,
    15.54225995,
    3.986004418e14
  ),
  gravitationalParameter: 3.986004418e14,
};
```

### Propagating Over Multiple Orbits

```typescript
import { propagateYA, orbitalPeriod, trueAnomalyAtTime } from "rpo-suite";

const period = orbitalPeriod(elements);
let state = initialState;
let theta = 0;

for (let i = 0; i < 3; i++) {
  const thetaF = trueAnomalyAtTime(elements, theta, period);
  state = propagateYA(state, elements, theta, thetaF, period, "RIC");
  theta = thetaF;
}
```

## Development

```bash
bun install
bun run build
bun test
```

## References

1. Yamanaka, K., & Ankersen, F. (2002). "New State Transition Matrix for Relative Motion on an Arbitrary Elliptical Orbit." _Journal of Guidance, Control, and Dynamics_, 25(1), 60-66.

2. Clohessy, W. H., & Wiltshire, R. S. (1960). "Terminal Guidance System for Satellite Rendezvous." _Journal of the Aerospace Sciences_, 27(9), 653-658.

3. Vallado, D. A. (2013). _Fundamentals of Astrodynamics and Applications_ (4th ed.). Microcosm Press.

## License

MIT
