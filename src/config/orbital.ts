import { orbitalPeriod, type OrbitalElements } from "rpo-suite";

// Orbital elements for LEO
export const ORBITAL_ELEMENTS: OrbitalElements = {
  eccentricity: 0.001,
  gravitationalParameter: 3.986004418e14, // Earth's mu (m^3/s^2)
  angularMomentum: 5.194e10, // for ~400km orbit (h = sqrt(mu*a), a = 6771km)
};

// Calculate orbital parameters
export const ORBITAL_PARAMS = (() => {
  const {
    gravitationalParameter: mu,
    angularMomentum: h,
    eccentricity: e,
  } = ORBITAL_ELEMENTS;
  const a = (h * h) / (mu * (1 - e * e)); // semi-major axis
  const n = Math.sqrt(mu / (a * a * a)); // mean motion
  const period = orbitalPeriod(ORBITAL_ELEMENTS);

  return {
    elements: ORBITAL_ELEMENTS,
    period,
    meanMotion: n,
    semiMajorAxis: a,
  } as const;
})();
