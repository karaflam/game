export const FACE_COUNT = 9;
export const FACE_STEP = (2 * Math.PI) / FACE_COUNT;

export function normalizeAngle(angleRadians: number): number {
  const twoPi = 2 * Math.PI;
  return ((angleRadians % twoPi) + twoPi) % twoPi;
}

export function faceIndexToAngle(faceIndex: number): number {
  return faceIndex * FACE_STEP;
}

export function angleToFaceIndex(angleRadians: number): number {
  const normalized = normalizeAngle(angleRadians);
  const index = Math.round(normalized / FACE_STEP) % FACE_COUNT;
  return index;
}

// Each drum face lives in a child group rotated by +faceIndex * FACE_STEP about X,
// and rotations about the same axis compose additively. So face `i` is front-facing
// (world +z, toward the camera) when i * FACE_STEP + drumRotation ≡ 0 (mod 2π) —
// i.e. the drum rotation needed to show face `i` is the *negation* of its own angle.
export function faceIndexToDrumRotation(faceIndex: number): number {
  return -faceIndexToAngle(faceIndex);
}

export function drumRotationToFrontFace(rotation: number): number {
  return angleToFaceIndex(-rotation);
}
