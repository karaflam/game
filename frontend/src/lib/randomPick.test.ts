import { describe, expect, it } from 'vitest';
import { pickRandomItem } from './randomPick';

describe('pickRandomItem', () => {
  const items = ['a', 'b', 'c'] as const;

  it('returns the first item when random() returns 0', () => {
    expect(pickRandomItem(items, () => 0)).toBe('a');
  });

  it('returns the last item when random() returns just under 1', () => {
    expect(pickRandomItem(items, () => 0.999)).toBe('c');
  });
});
