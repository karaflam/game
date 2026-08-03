import { describe, expect, it } from 'vitest';
import { easeOutBack } from './easing';

describe('easeOutBack', () => {
  it('starts at 0', () => {
    expect(easeOutBack(0)).toBeCloseTo(0, 5);
  });

  it('ends at 1', () => {
    expect(easeOutBack(1)).toBeCloseTo(1, 5);
  });

  it('overshoots past 1 partway through the motion', () => {
    expect(easeOutBack(0.75)).toBeGreaterThan(1);
  });
});
