import { describe, expect, it } from 'vitest';
import { applyRoundOutcome, createInitialScore, getWinner } from './soloScore';

describe('createInitialScore', () => {
  it('starts both scores at 0', () => {
    expect(createInitialScore()).toEqual({ player: 0, machine: 0 });
  });
});

describe('applyRoundOutcome', () => {
  it('increments player score on player outcome', () => {
    const state = applyRoundOutcome({ player: 1, machine: 2 }, 'player');
    expect(state).toEqual({ player: 2, machine: 2 });
  });

  it('increments machine score on machine outcome', () => {
    const state = applyRoundOutcome({ player: 1, machine: 2 }, 'machine');
    expect(state).toEqual({ player: 1, machine: 3 });
  });

  it('leaves both scores unchanged on draw', () => {
    const state = applyRoundOutcome({ player: 1, machine: 2 }, 'draw');
    expect(state).toEqual({ player: 1, machine: 2 });
  });
});

describe('getWinner', () => {
  it('returns null when neither score reached the target', () => {
    expect(getWinner({ player: 2, machine: 3 }, 5)).toBeNull();
  });

  it('returns "player" when the player reached the target', () => {
    expect(getWinner({ player: 5, machine: 3 }, 5)).toBe('player');
  });

  it('returns "machine" when the machine reached the target', () => {
    expect(getWinner({ player: 2, machine: 5 }, 5)).toBe('machine');
  });
});
