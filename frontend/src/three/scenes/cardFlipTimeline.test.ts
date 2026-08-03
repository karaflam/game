import { describe, expect, it } from 'vitest';
import { FLIP_DURATION_MS, getCardRotationY, isFlipSettled } from './cardFlipTimeline';

describe('cardFlipTimeline', () => {
  it('starts at 0 rotation', () => {
    expect(getCardRotationY(0)).toBeCloseTo(0, 5);
  });

  it('ends at exactly PI once settled', () => {
    expect(getCardRotationY(FLIP_DURATION_MS)).toBeCloseTo(Math.PI, 5);
  });

  it('overshoots past PI partway through (matches easeOutBack)', () => {
    expect(getCardRotationY(FLIP_DURATION_MS * 0.75)).toBeGreaterThan(Math.PI);
  });

  it('isFlipSettled is false before the duration and true at/after it', () => {
    expect(isFlipSettled(FLIP_DURATION_MS - 1)).toBe(false);
    expect(isFlipSettled(FLIP_DURATION_MS)).toBe(true);
    expect(isFlipSettled(FLIP_DURATION_MS + 500)).toBe(true);
  });

  it('clamps beyond the duration (does not keep rotating past PI)', () => {
    expect(getCardRotationY(FLIP_DURATION_MS * 3)).toBeCloseTo(Math.PI, 5);
  });
});
