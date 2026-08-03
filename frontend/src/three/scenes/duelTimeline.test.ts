import { describe, expect, it } from 'vitest';
import { DUEL_DURATION_MS, getDuelPhase, getPhaseProgress } from './duelTimeline';

describe('getDuelPhase', () => {
  it('is idle before the round starts', () => {
    expect(getDuelPhase(-1)).toBe('idle');
  });

  it('is countdown right at the start', () => {
    expect(getDuelPhase(0)).toBe('countdown');
  });

  it('is countdown just before 900ms', () => {
    expect(getDuelPhase(899)).toBe('countdown');
  });

  it('is transition at 900ms', () => {
    expect(getDuelPhase(900)).toBe('transition');
  });

  it('is advance at 1150ms', () => {
    expect(getDuelPhase(1150)).toBe('advance');
  });

  it('is outcome at 1500ms', () => {
    expect(getDuelPhase(1500)).toBe('outcome');
  });

  it('is done at the full duration', () => {
    expect(getDuelPhase(DUEL_DURATION_MS)).toBe('done');
    expect(DUEL_DURATION_MS).toBe(2200);
  });
});

describe('getPhaseProgress', () => {
  it('is 0 at the very start of countdown', () => {
    expect(getPhaseProgress(0)).toBeCloseTo(0, 5);
  });

  it('is ~1 at the end of transition', () => {
    expect(getPhaseProgress(1149)).toBeCloseTo(1, 1);
  });

  it('is 0 at the start of advance', () => {
    expect(getPhaseProgress(1150)).toBeCloseTo(0, 5);
  });

  it('is 1 once done', () => {
    expect(getPhaseProgress(DUEL_DURATION_MS)).toBe(1);
  });
});
