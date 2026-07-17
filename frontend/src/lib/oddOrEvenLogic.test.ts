import { describe, expect, it } from 'vitest';
import { getOddOrEvenOutcome, getParity, pickRandomNumber } from './oddOrEvenLogic';

describe('getParity', () => {
  it('returns pair for an even sum', () => {
    expect(getParity(4)).toBe('pair');
  });

  it('returns impair for an odd sum', () => {
    expect(getParity(5)).toBe('impair');
  });
});

describe('getOddOrEvenOutcome', () => {
  it('returns player when the prediction matches the actual parity', () => {
    // 3 + 4 = 7 -> impair
    expect(getOddOrEvenOutcome(3, 'impair', 4)).toBe('player');
  });

  it('returns machine when the prediction does not match the actual parity', () => {
    // 3 + 4 = 7 -> impair, player predicted pair
    expect(getOddOrEvenOutcome(3, 'pair', 4)).toBe('machine');
  });
});

describe('pickRandomNumber', () => {
  it('returns 1 when random() returns 0', () => {
    expect(pickRandomNumber(() => 0)).toBe(1);
  });

  it('returns 9 when random() returns just under 1', () => {
    expect(pickRandomNumber(() => 0.999)).toBe(9);
  });
});
