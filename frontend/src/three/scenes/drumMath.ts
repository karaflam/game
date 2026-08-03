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
