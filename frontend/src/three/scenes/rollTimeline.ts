import { faceIndexToAngle } from './drumMath';

export const ROLL_DURATION_MS = 1100;
const DEFAULT_EXTRA_TURNS = 3;

function easeOutCubic(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return 1 - Math.pow(1 - clamped, 3);
}

export function getRollAngle(elapsedMs: number, targetFaceIndex: number, extraTurns: number = DEFAULT_EXTRA_TURNS): number {
  const t = Math.min(Math.max(elapsedMs / ROLL_DURATION_MS, 0), 1);
  const eased = easeOutCubic(t);
  const totalAngle = extraTurns * 2 * Math.PI + faceIndexToAngle(targetFaceIndex);
  return totalAngle * eased;
}

export function isRollSettled(elapsedMs: number): boolean {
  return elapsedMs >= ROLL_DURATION_MS;
}
