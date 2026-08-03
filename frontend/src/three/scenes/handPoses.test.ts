import { describe, expect, it } from 'vitest';
import { RPS_MOVES } from '@/lib/rpsLogic';
import { FINGER_CURLS } from './handPoses';

describe('FINGER_CURLS', () => {
  it('has an entry for neutral plus every RPS move', () => {
    const keys = Object.keys(FINGER_CURLS).sort();
    expect(keys).toEqual([...RPS_MOVES, 'neutral'].sort());
  });

  it('gives every pose exactly 5 finger values within a sane curl range', () => {
    for (const curls of Object.values(FINGER_CURLS)) {
      expect(curls).toHaveLength(5);
      for (const curl of curls) {
        expect(curl).toBeGreaterThanOrEqual(0);
        expect(curl).toBeLessThanOrEqual(Math.PI / 2);
      }
    }
  });

  it('fully extends every finger for feuille (paper)', () => {
    expect(FINGER_CURLS.feuille).toEqual([0, 0, 0, 0, 0]);
  });

  it('curls every finger for pierre (rock)', () => {
    expect(FINGER_CURLS.pierre.every(curl => curl > 1)).toBe(true);
  });

  it('extends index and middle for ciseau (scissors) while curling the rest', () => {
    const [thumb, index, middle, ring, pinky] = FINGER_CURLS.ciseau;
    expect(index).toBe(0);
    expect(middle).toBe(0);
    expect(thumb).toBeGreaterThan(1);
    expect(ring).toBeGreaterThan(1);
    expect(pinky).toBeGreaterThan(1);
  });
});
