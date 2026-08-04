import { describe, expect, it } from 'vitest';
import { ROLL_DURATION_MS, getCarouselOffset, isRollSettled } from './carouselTimeline';

describe('carouselTimeline', () => {
  it('isRollSettled is false before ROLL_DURATION_MS and true at/after it', () => {
    expect(isRollSettled(0)).toBe(false);
    expect(isRollSettled(ROLL_DURATION_MS - 1)).toBe(false);
    expect(isRollSettled(ROLL_DURATION_MS)).toBe(true);
    expect(isRollSettled(ROLL_DURATION_MS + 500)).toBe(true);
  });

  it('getCarouselOffset lands exactly on the target index once settled', () => {
    for (let target = 0; target < 9; target++) {
      expect(getCarouselOffset(ROLL_DURATION_MS, target, 9)).toBeCloseTo(target, 10);
    }
  });

  it('getCarouselOffset starts from the far end of the row, not the target itself', () => {
    // Target near the start of the row (0..3) should start the slide from the far end (8).
    expect(getCarouselOffset(0, 1, 9)).toBeCloseTo(8, 10);
    // Target near the end of the row (5..8) should start the slide from the near end (0).
    expect(getCarouselOffset(0, 7, 9)).toBeCloseTo(0, 10);
  });

  it('getCarouselOffset stays within the row bounds throughout the animation', () => {
    for (let ms = 0; ms <= ROLL_DURATION_MS; ms += 50) {
      const offset = getCarouselOffset(ms, 4, 9);
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThanOrEqual(8);
    }
  });

  it('getCarouselOffset moves monotonically toward the target as elapsed time increases', () => {
    const target = 6;
    let prevDistance = Infinity;
    for (let ms = 0; ms <= ROLL_DURATION_MS; ms += 100) {
      const distance = Math.abs(getCarouselOffset(ms, target, 9) - target);
      expect(distance).toBeLessThanOrEqual(prevDistance + 1e-9);
      prevDistance = distance;
    }
  });
});
