import { describe, expect, it } from 'vitest';
import { RPS_MOVES, getRpsOutcome, pickRandomRpsMove } from './rpsLogic';

describe('getRpsOutcome', () => {
  it('returns draw when both play the same move', () => {
    expect(getRpsOutcome('pierre', 'pierre')).toBe('draw');
  });

  it('returns player when pierre beats ciseau', () => {
    expect(getRpsOutcome('pierre', 'ciseau')).toBe('player');
  });

  it('returns player when feuille beats pierre', () => {
    expect(getRpsOutcome('feuille', 'pierre')).toBe('player');
  });

  it('returns player when ciseau beats feuille', () => {
    expect(getRpsOutcome('ciseau', 'feuille')).toBe('player');
  });

  it('returns machine when the machine move beats the player move', () => {
    expect(getRpsOutcome('ciseau', 'pierre')).toBe('machine');
  });
});

describe('pickRandomRpsMove', () => {
  it('returns the first move when random() returns 0', () => {
    expect(pickRandomRpsMove(() => 0)).toBe(RPS_MOVES[0]);
  });

  it('returns the last move when random() returns just under 1', () => {
    expect(pickRandomRpsMove(() => 0.999)).toBe(RPS_MOVES[RPS_MOVES.length - 1]);
  });
});
