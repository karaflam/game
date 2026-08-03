export type DuelPhase = 'idle' | 'countdown' | 'transition' | 'advance' | 'outcome' | 'done';

export const DUEL_DURATION_MS = 2200;

const COUNTDOWN_END_MS = 900;
const TRANSITION_END_MS = 1150;
const ADVANCE_END_MS = 1500;

export function getDuelPhase(elapsedMs: number): DuelPhase {
  if (elapsedMs < 0) return 'idle';
  if (elapsedMs < COUNTDOWN_END_MS) return 'countdown';
  if (elapsedMs < TRANSITION_END_MS) return 'transition';
  if (elapsedMs < ADVANCE_END_MS) return 'advance';
  if (elapsedMs < DUEL_DURATION_MS) return 'outcome';
  return 'done';
}

export function getPhaseProgress(elapsedMs: number): number {
  switch (getDuelPhase(elapsedMs)) {
    case 'idle':
      return 0;
    case 'countdown':
      return elapsedMs / COUNTDOWN_END_MS;
    case 'transition':
      return (elapsedMs - COUNTDOWN_END_MS) / (TRANSITION_END_MS - COUNTDOWN_END_MS);
    case 'advance':
      return (elapsedMs - TRANSITION_END_MS) / (ADVANCE_END_MS - TRANSITION_END_MS);
    case 'outcome':
      return (elapsedMs - ADVANCE_END_MS) / (DUEL_DURATION_MS - ADVANCE_END_MS);
    case 'done':
      return 1;
  }
}
