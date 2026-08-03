import { describe, expect, it } from 'vitest';
import { FACE_COUNT, FACE_STEP, angleToFaceIndex, faceIndexToAngle, normalizeAngle } from './drumMath';

describe('drumMath', () => {
  it('has 9 faces, one per number 1-9', () => {
    expect(FACE_COUNT).toBe(9);
    expect(FACE_STEP).toBeCloseTo((2 * Math.PI) / 9, 10);
  });

  it('normalizeAngle wraps negative and large angles into [0, 2π)', () => {
    expect(normalizeAngle(-FACE_STEP)).toBeCloseTo(2 * Math.PI - FACE_STEP, 10);
    expect(normalizeAngle(2 * Math.PI + 0.1)).toBeCloseTo(0.1, 10);
    expect(normalizeAngle(0)).toBeCloseTo(0, 10);
  });

  it('faceIndexToAngle and angleToFaceIndex round-trip for every face', () => {
    for (let i = 0; i < FACE_COUNT; i++) {
      expect(angleToFaceIndex(faceIndexToAngle(i))).toBe(i);
    }
  });

  it('angleToFaceIndex snaps to the nearest face, not just floor', () => {
    // Slightly past face 3's angle should still snap to 3, not roll over to 4.
    expect(angleToFaceIndex(faceIndexToAngle(3) + FACE_STEP * 0.4)).toBe(3);
    // Slightly before face 3's angle should also snap to 3.
    expect(angleToFaceIndex(faceIndexToAngle(3) - FACE_STEP * 0.4)).toBe(3);
  });

  it('angleToFaceIndex wraps around at the 8→0 boundary', () => {
    expect(angleToFaceIndex(faceIndexToAngle(8) + FACE_STEP * 0.6)).toBe(0);
  });
});
