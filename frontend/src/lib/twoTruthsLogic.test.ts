import { describe, expect, it } from 'vitest';
import { shuffleTriplet, type Triplet } from './twoTruthsLogic';

const triplet: Triplet = {
  statements: ['vrai 1', 'mensonge', 'vrai 2'],
  lieIndex: 1
};

describe('shuffleTriplet', () => {
  it('preserves the same set of statements after shuffling', () => {
    const shuffled = shuffleTriplet(triplet, () => 0.5);
    expect(new Set(shuffled.statements)).toEqual(new Set(triplet.statements));
  });

  it('keeps the lieIndex pointing at the original lie statement', () => {
    const shuffled = shuffleTriplet(triplet, () => 0.5);
    expect(shuffled.statements[shuffled.lieIndex]).toBe('mensonge');
  });

  it('produces a deterministic order for a fixed random source', () => {
    const shuffled = shuffleTriplet(triplet, () => 0);
    expect(shuffled.statements[shuffled.lieIndex]).toBe('mensonge');
    expect(shuffled.statements).toHaveLength(3);
  });
});
