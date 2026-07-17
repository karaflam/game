import { describe, expect, it } from 'vitest';
import { pickRandomIndexExcluding, pickRandomItem } from './randomPick';

describe('pickRandomItem', () => {
  const items = ['a', 'b', 'c'] as const;

  it('returns the first item when random() returns 0', () => {
    expect(pickRandomItem(items, () => 0)).toBe('a');
  });

  it('returns the last item when random() returns just under 1', () => {
    expect(pickRandomItem(items, () => 0.999)).toBe('c');
  });
});

describe('pickRandomIndexExcluding', () => {
  it('never returns an excluded index while unexcluded ones remain', () => {
    const excluded = new Set([0, 2]);
    expect(pickRandomIndexExcluding(3, excluded, () => 0)).toBe(1);
    expect(pickRandomIndexExcluding(3, excluded, () => 0.999)).toBe(1);
  });

  it('picks from the full range again once all indices are excluded (recycle)', () => {
    const excluded = new Set([0, 1, 2]);
    expect(pickRandomIndexExcluding(3, excluded, () => 0)).toBe(0);
    expect(pickRandomIndexExcluding(3, excluded, () => 0.999)).toBe(2);
  });

  it('returns the only available index when nothing is excluded', () => {
    expect(pickRandomIndexExcluding(1, new Set(), () => 0.5)).toBe(0);
  });
});
