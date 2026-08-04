export const WHEEL_SPIN_DURATION_MS = 2800;
const MIN_FULL_TURNS = 5;
const TWO_PI = Math.PI * 2;

function easeOutCubic(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return 1 - Math.pow(1 - clamped, 3);
}

// Angle convention: radians, measured clockwise from "up" (the fixed pointer
// position at the top of the wheel), matching the pre-existing 2D wheel's
// polarToCartesian convention. Wedge 0 starts at "up" and wedges proceed
// clockwise as index increases. This is the single source of truth for that
// convention — the 3D wedge geometry (Task 2) must derive its positions from
// this function rather than re-deriving its own angle formula.
export function wedgeCenterAngle(index: number, wedgeCount: number): number {
  const wedgeAngle = TWO_PI / wedgeCount;
  return index * wedgeAngle + wedgeAngle / 2;
}

// Deterministic jitter within the wedge so the wheel doesn't always stop
// dead-center, without ever landing close enough to a divider to look
// ambiguous — same LCG-style formula as the 2D wheel (PlayerWheel.tsx),
// seeded by spinSeed so repeated spins land at different offsets.
function wedgeJitter(spinSeed: number, wedgeAngle: number): number {
  return (((spinSeed * 9301 + 49297) % 233280) / 233280 - 0.5) * wedgeAngle * 0.5;
}

// Total clockwise rotation (radians) the wheel must turn so that
// targetIndex's wedge ends up at "up", under the fixed pointer, after
// several full spins.
export function getWheelTargetRotation(targetIndex: number, wedgeCount: number, spinSeed: number): number {
  const wedgeAngle = TWO_PI / wedgeCount;
  const jitter = wedgeJitter(spinSeed, wedgeAngle);
  return MIN_FULL_TURNS * TWO_PI + (TWO_PI - wedgeCenterAngle(targetIndex, wedgeCount)) + jitter;
}

// The wheel's clockwise rotation at a given point in the spin animation —
// eases out to getWheelTargetRotation's exact value once settled.
export function getWheelRotation(elapsedMs: number, targetIndex: number, wedgeCount: number, spinSeed: number): number {
  const t = easeOutCubic(elapsedMs / WHEEL_SPIN_DURATION_MS);
  return getWheelTargetRotation(targetIndex, wedgeCount, spinSeed) * t;
}

export function isWheelSpinSettled(elapsedMs: number): boolean {
  return elapsedMs >= WHEEL_SPIN_DURATION_MS;
}
