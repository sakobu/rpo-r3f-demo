import {
  type RelativeState,
  type OrbitalElements,
  type Vector3,
  propagateYA,
  trueAnomalyAtTime,
} from "rpo-suite";

type Matrix3x3 = [Vector3, Vector3, Vector3];

// --- Matrix Helpers ---

function invert3x3(m: Matrix3x3): Matrix3x3 {
  const det =
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

  if (Math.abs(det) < 1e-10) {
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

// --- STM Extraction ---

function getSTMComponents(
  elements: OrbitalElements,
  theta0: number,
  thetaF: number,
  deltaTime: number
): { Phi_rr: Matrix3x3; Phi_rv: Matrix3x3 } {
  const Phi_rr_cols = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const Phi_rv_cols = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  const epsilon = 1.0; // 1 meter or 1 m/s

  for (let i = 0; i < 3; i++) {
    const posPerturbation = [0, 0, 0] as [number, number, number];
    posPerturbation[i] = epsilon;

    const perturbedState: RelativeState = {
      position: posPerturbation,
      velocity: [0, 0, 0],
    };

    const finalState = propagateYA(
      perturbedState,
      elements,
      theta0,
      thetaF,
      deltaTime,
      "RIC"
    );

    Phi_rr_cols[0][i] = finalState.position[0] / epsilon;
    Phi_rr_cols[1][i] = finalState.position[1] / epsilon;
    Phi_rr_cols[2][i] = finalState.position[2] / epsilon;
  }

  for (let i = 0; i < 3; i++) {
    const velPerturbation = [0, 0, 0] as [number, number, number];
    velPerturbation[i] = epsilon;

    const perturbedState: RelativeState = {
      position: [0, 0, 0],
      velocity: velPerturbation,
    };

    const finalState = propagateYA(
      perturbedState,
      elements,
      theta0,
      thetaF,
      deltaTime,
      "RIC"
    );

    Phi_rv_cols[0][i] = finalState.position[0] / epsilon;
    Phi_rv_cols[1][i] = finalState.position[1] / epsilon;
    Phi_rv_cols[2][i] = finalState.position[2] / epsilon;
  }

  const Phi_rr = Phi_rr_cols as unknown as Matrix3x3;
  const Phi_rv = Phi_rv_cols as unknown as Matrix3x3;

  return { Phi_rr, Phi_rv };
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

  const { Phi_rr, Phi_rv } = getSTMComponents(
    elements,
    currentTheta,
    thetaF,
    transferTime
  );

  const Phi_rv_inv = invert3x3(Phi_rv);

  const Phi_rr_r0 = multiplyMatrixVector(Phi_rr, initialState.position);

  const r_diff = subtractVectors(targetPosition, Phi_rr_r0);

  const v_required = multiplyMatrixVector(Phi_rv_inv, r_diff);

  const deltaV = subtractVectors(v_required, initialState.velocity);

  return deltaV;
}
