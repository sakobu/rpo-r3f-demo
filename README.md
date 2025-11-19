# RPO Suite Demo

Interactive 3D visualization of spacecraft relative motion using the rpo-suite library. This application demonstrates Rendezvous and Proximity Operations (RPO) calculations through real-time orbital mechanics simulation.

## Overview

This demo showcases the [rpo-suite](https://www.npmjs.com/package/rpo-suite) TypeScript library, which provides analytical solutions for propagating relative state between two spacecraft in orbit using the Yamanaka-Ankersen and Clohessy-Wiltshire algorithms.

The visualization renders a chief spacecraft at the origin and a deputy spacecraft whose relative motion is computed using exact analytical state transition matrices. Users can observe various proximity operations scenarios including natural motion orbits and approach trajectories.

## Features

- Real-time 3D visualization using React Three Fiber
- Multiple preset scenarios:
  - R-bar Approach (radial approach)
  - V-bar Approach (velocity vector approach)
  - Natural Motion Circumnavigation (2:1 ellipse)
- Interactive parameter controls via Leva
- Trajectory visualization showing complete orbital paths
- Velocity vector display
- Real-time statistics (distance, speed, elapsed time, orbit number)
- Adjustable time acceleration
- RIC (Radial, In-track, Cross-track) coordinate frame display

## Getting Started

### Installation

```bash
npm install
```

### Running the Demo

```bash
npm run dev
```

Open your browser to the URL shown in the terminal (typically http://localhost:5173).

### Usage

1. Select a preset scenario from the control panel or use custom initial conditions
2. Adjust orbital parameters, initial position, and velocity as desired
3. Use the Play/Pause and Reset buttons to control the simulation
4. Manipulate the 3D view using mouse controls:
   - Left click and drag to rotate
   - Right click and drag to pan
   - Scroll to zoom

## Technical Details

### Reference Frames

The simulation uses the RIC (Radial, In-track, Cross-track) frame:

- R (Radial): Direction away from Earth center (blue axis, Z)
- I (In-track): Along velocity direction (red axis, X)
- C (Cross-track): Normal to orbital plane (green axis, Y)

### Propagation Method

Relative motion is propagated using the Yamanaka-Ankersen State Transition Matrix, which provides exact analytical solutions for elliptical reference orbits (0 <= e < 1). The implementation handles true anomaly propagation via Kepler's equation and applies the state transition matrix in the RIC frame.

### Orbital Parameters

The demo uses a low Earth orbit configuration:

- Altitude: approximately 400 km
- Eccentricity: 0.001 (nearly circular)
- Gravitational parameter: 3.986004418e14 m^3/s^2 (Earth)

## Technologies

- [rpo-suite](https://www.npmjs.com/package/rpo-suite) - Orbital mechanics library
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) - React renderer for Three.js
- [Three.js](https://threejs.org/) - 3D graphics library
- [Leva](https://github.com/pmndrs/leva) - GUI controls
- [Vite](https://vitejs.dev/) - Build tool
- TypeScript

## Development

### Build

```bash
npm run build
```

### Linting

```bash
npm run lint
```

## References

1. Yamanaka, K., & Ankersen, F. (2002). "New State Transition Matrix for Relative Motion on an Arbitrary Elliptical Orbit." Journal of Guidance, Control, and Dynamics, 25(1), 60-66.

2. Clohessy, W. H., & Wiltshire, R. S. (1960). "Terminal Guidance System for Satellite Rendezvous." Journal of the Aerospace Sciences, 27(9), 653-658.

## License

MIT
