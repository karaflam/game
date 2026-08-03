import { easeOutBack } from '../easing';

export const FLIP_DURATION_MS = 700;

export function getCardRotationY(elapsedMs: number): number {
  const t = Math.min(Math.max(elapsedMs / FLIP_DURATION_MS, 0), 1);
  return easeOutBack(t) * Math.PI;
}

export function isFlipSettled(elapsedMs: number): boolean {
  return elapsedMs >= FLIP_DURATION_MS;
}
