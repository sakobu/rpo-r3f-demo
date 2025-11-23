import {
  type RelativeState,
  type OrbitalElements,
  type Vector3,
  trueAnomalyAtTime,
  rho,
  s,
  c,
  sPrime,
  cPrime,
  J,
  kSquared,
} from "rpo-suite";
import { MATRIX_SINGULARITY_TOLERANCE } from "../config/constants";

// --- Matrix Math Helpers ---

type Matrix6x6 = number[][]; // 6 rows, 6 cols
type Matrix3x3 = [Vector3, Vector3, Vector3];

function createMatrix(rows: number, cols: number): number[][] {
  return Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0));
}

function multiplyMatrices(A: number[][], B: number[][]): number[][] {
  const rA = A.length;
  const cA = A[0].length;
  const rB = B.length;
  const cB = B[0].length;
  if (cA !== rB) throw new Error("Matrix dimension mismatch");

  const C = createMatrix(rA, cB);
  for (let i = 0; i < rA; i++) {
    for (let j = 0; j < cB; j++) {
      let sum = 0;
      for (let k = 0; k < cA; k++) {
        sum += A[i][k] * B[k][j];
      }
      C[i][j] = sum;
    }
  }
  return C;
}

function invert3x3(m: Matrix3x3): Matrix3x3 {
  const det =
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

  if (Math.abs(det) < MATRIX_SINGULARITY_TOLERANCE) {
    throw new Error("Matrix is singular or near-singular");
  }

  const invDet = 1 / det;

  return [
    [
      (m[1][1] * m[2][2] - m[1][2] * m[2][1]) * invDet,
      (m[0][2] * m[2][1] - m[0][1] * m[2][2]) * invDet,
      (m[0][1] * m[1][2] - m[0][2] * m[1][1]) * invDet,
    ],
    [
      (m[1][2] * m[2][0] - m[1][0] * m[2][2]) * invDet,
      (m[0][0] * m[2][2] - m[0][2] * m[2][0]) * invDet,
      (m[0][2] * m[1][0] - m[0][0] * m[1][2]) * invDet,
    ],
    [
      (m[1][0] * m[2][1] - m[1][1] * m[2][0]) * invDet,
      (m[0][1] * m[2][0] - m[0][0] * m[2][1]) * invDet,
      (m[0][0] * m[1][1] - m[0][1] * m[1][0]) * invDet,
    ],
  ];
}

function multiplyMatrixVector(m: Matrix3x3, v: Vector3): Vector3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

function subtractVectors(a: Vector3, b: Vector3): Vector3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

// --- Analytical STM Construction ---

/**
 * Constructs the 6x6 State Transition Matrix for the RIC frame.
 * Uses the Yamanaka-Ankersen auxiliary functions.
 */
function calculateSTM(
  elements: OrbitalElements,
  theta0: number,
  thetaF: number,
  deltaTime: number
): Matrix6x6 {
  const e = elements.eccentricity;
  const k2 = kSquared(elements);
  const J_val = J(elements, deltaTime);

  // 1. Transformation: True -> Modified (at theta0)
  // State vector order for internal calculation: [x, z, vx, vz, y, vy]
  // where x=InTrack, z=Radial, y=CrossTrack
  // But we will build 6x6 matrices for [x, y, z, vx, vy, vz] to match rpo-suite internal frame
  // Internal Frame: x=I, y=C, z=R
  // Indices: 0:x, 1:y, 2:z, 3:vx, 4:vy, 5:vz

  const T_tm0 = createMatrix(6, 6);
  const rho0 = rho(e, theta0);
  const sinTheta0 = Math.sin(theta0);

  // For each axis j in {x, y, z}:
  // pos_mod = rho * pos_true
  // vel_mod = -e*sin(theta)*pos_true + (1/(k2*rho))*vel_true
  for (let j = 0; j < 3; j++) {
    T_tm0[j][j] = rho0; // Position -> Position
    T_tm0[j + 3][j] = -e * sinTheta0; // Position -> Velocity
    T_tm0[j + 3][j + 3] = 1 / (k2 * rho0); // Velocity -> Velocity
  }

  // 2. Propagation in Modified Coordinates
  // We need to build the matrix that maps Modified(t0) -> Modified(tf)
  // This separates into In-Plane (x, z) and Out-Of-Plane (y)

  const Phi_mod = createMatrix(6, 6);

  // --- In-Plane (x, z) ---
  // Indices: x=0, z=2, vx=3, vz=5
  // We combine "Pseudo-Initial" transform and "Propagate In-Plane"
  // from rpo-suite source logic.

  // Step 2a: Modified -> Pseudo (at theta0)
  // xBar = factor * ((1-e^2)x + 3e(s/rho)(1+1/rho)z - e*s(1+1/rho)vx + (2-e*c)vz) ... wait, check signs
  // Let's use the auxiliary functions s, c.
  const s0 = s(e, theta0);
  const c0 = c(e, theta0);
  const factor = 1 / (1 - e * e);

  // Coefficients for Pseudo-State (from rpo-suite source)
  // xBar
  const m_x_x = factor * (1 - e * e);
  const m_x_z = factor * 3 * e * (s0 / rho0) * (1 + 1 / rho0);
  const m_x_vx = factor * -e * s0 * (1 + 1 / rho0);
  const m_x_vz = factor * (-e * c0 + 2);

  // zBar
  const m_z_x = 0;
  const m_z_z = factor * -3 * (s0 / rho0) * (1 + (e * e) / rho0);
  const m_z_vx = factor * s0 * (1 + 1 / rho0);
  const m_z_vz = factor * (c0 - 2 * e);

  // vxBar
  const m_vx_x = 0;
  const m_vx_z = factor * -3 * (c0 / rho0 + e);
  const m_vx_vx = factor * (c0 * (1 + 1 / rho0) + e);
  const m_vx_vz = factor * -s0;

  // vzBar
  const m_vz_x = 0;
  const m_vz_z = factor * (3 * rho0 + e * e - 1);
  const m_vz_vx = factor * -rho0 * rho0;
  const m_vz_vz = factor * e * s0;

  // Step 2b: Pseudo -> Final Modified (at thetaF)
  const rhoF = rho(e, thetaF);
  const sF = s(e, thetaF);
  const cF = c(e, thetaF);
  const sPrimeF = sPrime(e, thetaF);
  const cPrimeF = cPrime(e, thetaF);
  const oneOverRhoF = 1 / rhoF;

  // x_f
  const p_x_x = 1;
  const p_x_z = -cF * (1 + oneOverRhoF);
  const p_x_vx = sF * (1 + oneOverRhoF);
  const p_x_vz = 3 * rhoF * rhoF * J_val;

  // z_f
  const p_z_x = 0;
  const p_z_z = sF;
  const p_z_vx = cF;
  const p_z_vz = 2 - 3 * e * sF * J_val;

  // vx_f
  const p_vx_x = 0;
  const p_vx_z = 2 * sF;
  const p_vx_vx = 2 * cF - e;
  const p_vx_vz = 3 * (1 - 2 * e * sF * J_val);

  // vz_f
  const p_vz_x = 0;
  const p_vz_z = sPrimeF;
  const p_vz_vx = cPrimeF;
  const p_vz_vz = -3 * e * (sPrimeF * J_val + sF / (rhoF * rhoF));

  // Combine In-Plane (Product of Propagate * Pseudo)
  // Rows: x(0), z(2), vx(3), vz(5)
  // Cols: x(0), z(2), vx(3), vz(5)

  const map_indices = [0, 2, 3, 5];
  const M_pseudo = [
    [m_x_x, m_x_z, m_x_vx, m_x_vz],
    [m_z_x, m_z_z, m_z_vx, m_z_vz],
    [m_vx_x, m_vx_z, m_vx_vx, m_vx_vz],
    [m_vz_x, m_vz_z, m_vz_vx, m_vz_vz],
  ];
  const M_prop = [
    [p_x_x, p_x_z, p_x_vx, p_x_vz],
    [p_z_x, p_z_z, p_z_vx, p_z_vz],
    [p_vx_x, p_vx_z, p_vx_vx, p_vx_vz],
    [p_vz_x, p_vz_z, p_vz_vx, p_vz_vz],
  ];

  const M_in_plane = multiplyMatrices(M_prop, M_pseudo);

  // Fill Phi_mod with In-Plane values
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      Phi_mod[map_indices[r]][map_indices[c]] = M_in_plane[r][c];
    }
  }

  // --- Out-Of-Plane (y) ---
  // Indices: y=1, vy=4
  const deltaTheta = thetaF - theta0;
  const cosDelta = Math.cos(deltaTheta);
  const sinDelta = Math.sin(deltaTheta);
  const factorOOP = 1 / (rhoF / rho0);

  // y_f
  Phi_mod[1][1] = factorOOP * cosDelta; // y -> y
  Phi_mod[1][4] = factorOOP * sinDelta; // vy -> y

  // vy_f
  Phi_mod[4][1] = factorOOP * -sinDelta; // y -> vy
  Phi_mod[4][4] = factorOOP * cosDelta; // vy -> vy

  // 3. Transformation: Modified -> True (at thetaF)
  const T_mtF = createMatrix(6, 6);
  const sinThetaF = Math.sin(thetaF);

  // Inverse relations:
  // pos = (1/rho) * pos_mod
  // vel = k2 * (e*sin(theta)*pos_mod + rho*vel_mod)
  for (let j = 0; j < 3; j++) {
    T_mtF[j][j] = 1 / rhoF; // Position -> Position
    T_mtF[j + 3][j] = k2 * e * sinThetaF; // Position -> Velocity
    T_mtF[j + 3][j + 3] = k2 * rhoF; // Velocity -> Velocity
  }

  // 4. Full Chain: Phi_internal = T_mtF * Phi_mod * T_tm0
  const Phi_temp = multiplyMatrices(Phi_mod, T_tm0);
  const Phi_internal = multiplyMatrices(T_mtF, Phi_temp);

  // 5. Convert Frame: Internal (I, C, R) -> RIC (R, I, C)
  // Internal: 0=I, 1=C, 2=R
  // RIC: 0=R, 1=I, 2=C
  // Mapping: RIC[0] -> Internal[2], RIC[1] -> Internal[0], RIC[2] -> Internal[1]
  const map_RIC_to_Internal = [2, 0, 1]; // R->z, I->x, C->y

  const Phi_RIC = createMatrix(6, 6);

  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      // Map row/col indices
      // If r < 3 (Position), index is map[r]. If r >= 3 (Velocity), index is map[r-3] + 3
      const r_int =
        r < 3 ? map_RIC_to_Internal[r] : map_RIC_to_Internal[r - 3] + 3;
      const c_int =
        c < 3 ? map_RIC_to_Internal[c] : map_RIC_to_Internal[c - 3] + 3;

      Phi_RIC[r][c] = Phi_internal[r_int][c_int];
    }
  }

  return Phi_RIC;
}

// --- Main Function ---

/**
 * @param initialState Current relative state (position, velocity)
 * @param targetPosition Desired relative position at the end of the transfer
 * @param transferTime Time of flight in seconds
 * @param elements Orbital elements of the chief
 * @param currentTheta Current true anomaly of the chief
 * @returns Required delta-v vector [vr, vi, vc]
 */
export function calculateRendezvousBurn(
  initialState: RelativeState,
  targetPosition: Vector3,
  transferTime: number,
  elements: OrbitalElements,
  currentTheta: number
): Vector3 {
  const thetaF = trueAnomalyAtTime(elements, currentTheta, transferTime);

  // Calculate Analytical STM
  const Phi = calculateSTM(elements, currentTheta, thetaF, transferTime);

  // Extract Phi_rr (top-left 3x3) and Phi_rv (top-right 3x3)
  const Phi_rr: Matrix3x3 = [
    [Phi[0][0], Phi[0][1], Phi[0][2]],
    [Phi[1][0], Phi[1][1], Phi[1][2]],
    [Phi[2][0], Phi[2][1], Phi[2][2]],
  ];

  const Phi_rv: Matrix3x3 = [
    [Phi[0][3], Phi[0][4], Phi[0][5]],
    [Phi[1][3], Phi[1][4], Phi[1][5]],
    [Phi[2][3], Phi[2][4], Phi[2][5]],
  ];

  const Phi_rv_inv = invert3x3(Phi_rv);

  const Phi_rr_r0 = multiplyMatrixVector(Phi_rr, initialState.position);

  const r_diff = subtractVectors(targetPosition, Phi_rr_r0);

  const v_required = multiplyMatrixVector(Phi_rv_inv, r_diff);

  const deltaV = subtractVectors(v_required, initialState.velocity);

  return deltaV;
}
