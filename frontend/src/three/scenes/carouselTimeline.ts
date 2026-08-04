export const ROLL_DURATION_MS = 1100;

function easeOutCubic(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return 1 - Math.pow(1 - clamped, 3);
}

// Cards sit at fixed positions 0..cardCount-1 and don't wrap, so unlike a
// cylindrical drum this can't spin past the ends to fake extra turns.
// Instead it starts the slide from whichever end of the row is farther from
// the target, giving a visible travel motion across several cards before
// landing exactly on target.
export function getCarouselOffset(elapsedMs: number, targetIndex: number, cardCount: number): number {
  const start = targetIndex <= (cardCount - 1) / 2 ? cardCount - 1 : 0;
  const t = easeOutCubic(elapsedMs / ROLL_DURATION_MS);
  return start + (targetIndex - start) * t;
}

export function isRollSettled(elapsedMs: number): boolean {
  return elapsedMs >= ROLL_DURATION_MS;
}
