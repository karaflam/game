import { describe, expect, it } from 'vitest';
import { faceIndexToDrumRotation } from './drumMath';
import { ROLL_DURATION_MS, getRollAngle, isRollSettled } from './rollTimeline';

describe('rollTimeline', () => {
  it('starts at angle 0', () => {
    expect(getRollAngle(0, 4)).toBeCloseTo(0, 5);
  });

  it('ends exactly on the target face angle plus full turns, at the full duration', () => {
    const targetFace = 4;
    const finalAngle = getRollAngle(ROLL_DURATION_MS, targetFace, 3);
    const expected = faceIndexToDrumRotation(targetFace) + 3 * 2 * Math.PI;
    expect(finalAngle).toBeCloseTo(expected, 5);
  });

  it('is monotonically increasing (the drum never spins backward)', () => {
    const targetFace = 2;
    let previous = getRollAngle(0, targetFace);
    for (let t = 50; t <= ROLL_DURATION_MS; t += 50) {
      const current = getRollAngle(t, targetFace);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });

  it('decelerates toward the end (later equal time-steps cover less angle)', () => {
    const targetFace = 6;
    const early = getRollAngle(200, targetFace) - getRollAngle(100, targetFace);
    const late = getRollAngle(ROLL_DURATION_MS, targetFace) - getRollAngle(ROLL_DURATION_MS - 100, targetFace);
    expect(late).toBeLessThan(early);
  });

  it('isRollSettled is false before the duration and true at/after it', () => {
    expect(isRollSettled(ROLL_DURATION_MS - 1)).toBe(false);
    expect(isRollSettled(ROLL_DURATION_MS)).toBe(true);
    expect(isRollSettled(ROLL_DURATION_MS + 500)).toBe(true);
  });
});
