import { describe, expect, it } from 'vitest';
import { BADGE_POP_DURATION_MS, getBadgeScale } from './burstTimeline';

describe('getBadgeScale', () => {
  it('starts at 0', () => {
    expect(getBadgeScale(0)).toBeCloseTo(0, 5);
  });

  it('settles at exactly 1', () => {
    expect(getBadgeScale(BADGE_POP_DURATION_MS)).toBeCloseTo(1, 5);
    expect(getBadgeScale(BADGE_POP_DURATION_MS * 5)).toBeCloseTo(1, 5);
  });

  it('overshoots past 1 partway through the pop', () => {
    expect(getBadgeScale(BADGE_POP_DURATION_MS * 0.75)).toBeGreaterThan(1);
  });
});
