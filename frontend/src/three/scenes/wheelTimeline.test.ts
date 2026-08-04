// frontend/src/three/scenes/wheelTimeline.test.ts
import { describe, expect, it } from 'vitest';
import {
  WHEEL_SPIN_DURATION_MS,
  getWheelRotation,
  getWheelTargetRotation,
  isWheelSpinSettled,
  wedgeCenterAngle
} from './wheelTimeline';

const TWO_PI = Math.PI * 2;

function normalizeAngle(angle: number): number {
  return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
}

describe('wheelTimeline', () => {
  it('isWheelSpinSettled is false before WHEEL_SPIN_DURATION_MS and true at/after it', () => {
    expect(isWheelSpinSettled(0)).toBe(false);
    expect(isWheelSpinSettled(WHEEL_SPIN_DURATION_MS - 1)).toBe(false);
    expect(isWheelSpinSettled(WHEEL_SPIN_DURATION_MS)).toBe(true);
    expect(isWheelSpinSettled(WHEEL_SPIN_DURATION_MS + 500)).toBe(true);
  });

  it('wedgeCenterAngle divides the wheel evenly, starting half a wedge past "up"', () => {
    expect(wedgeCenterAngle(0, 4)).toBeCloseTo(Math.PI / 4, 10);
    expect(wedgeCenterAngle(1, 4)).toBeCloseTo((3 * Math.PI) / 4, 10);
    expect(wedgeCenterAngle(2, 4)).toBeCloseTo((5 * Math.PI) / 4, 10);
    expect(wedgeCenterAngle(3, 4)).toBeCloseTo((7 * Math.PI) / 4, 10);
  });

  it('getWheelRotation lands within the target wedge for every wedge and several wheel sizes', () => {
    // wedgeCount === 1 is skipped: a single wedge spans the whole circle, so
    // "within the wedge" is trivially always true and not a meaningful check.
    for (const wedgeCount of [2, 3, 5, 8]) {
      for (let targetIndex = 0; targetIndex < wedgeCount; targetIndex++) {
        const wedgeAngle = TWO_PI / wedgeCount;
        const rotation = getWheelRotation(WHEEL_SPIN_DURATION_MS, targetIndex, wedgeCount, 1);
        const landedAngle = normalizeAngle(wedgeCenterAngle(targetIndex, wedgeCount) + rotation);
        const distanceFromUp = Math.min(landedAngle, TWO_PI - landedAngle);
        expect(distanceFromUp).toBeLessThan(wedgeAngle / 2);
      }
    }
  });

  it('getWheelRotation matches getWheelTargetRotation exactly once settled', () => {
    expect(getWheelRotation(WHEEL_SPIN_DURATION_MS, 2, 6, 3)).toBeCloseTo(getWheelTargetRotation(2, 6, 3), 10);
  });

  it('getWheelRotation starts at 0 and increases monotonically toward the settled value', () => {
    let prev = -1;
    for (let ms = 0; ms <= WHEEL_SPIN_DURATION_MS; ms += 100) {
      const rotation = getWheelRotation(ms, 3, 6, 5);
      expect(rotation).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = rotation;
    }
    expect(getWheelRotation(0, 3, 6, 5)).toBeCloseTo(0, 10);
  });

  it('different spin seeds land at different jittered offsets within the same wedge', () => {
    const rotationA = getWheelTargetRotation(1, 8, 1);
    const rotationB = getWheelTargetRotation(1, 8, 2);
    expect(rotationA).not.toBeCloseTo(rotationB, 5);
  });
});
