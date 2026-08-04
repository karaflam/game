import { easeOutBack } from '../easing';

export const BADGE_POP_DURATION_MS = 400;

export function getBadgeScale(elapsedMs: number): number {
  const t = Math.min(Math.max(elapsedMs / BADGE_POP_DURATION_MS, 0), 1);
  return easeOutBack(t);
}
