import { describe, expect, it } from 'vitest';
import { BADGE_POP_DURATION_MS, BURST_PARTICLE_DURATION_MS, getBadgeScale, getBurstProgress } from './burstTimeline';

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

describe('getBurstProgress', () => {
  it('starts at 0 and ends at 1', () => {
    expect(getBurstProgress(0)).toBeCloseTo(0, 5);
    expect(getBurstProgress(BURST_PARTICLE_DURATION_MS)).toBeCloseTo(1, 5);
  });

  it('clamps at 1 beyond the duration', () => {
    expect(getBurstProgress(BURST_PARTICLE_DURATION_MS * 3)).toBe(1);
  });

  it('is monotonically increasing', () => {
    let previous = getBurstProgress(0);
    for (let t = 50; t <= BURST_PARTICLE_DURATION_MS; t += 50) {
      const current = getBurstProgress(t);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });
});
