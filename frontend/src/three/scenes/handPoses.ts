import type { RpsMove } from '@/lib/rpsLogic';

export type HandPose = RpsMove | 'neutral';

// Curl angle in radians per finger: [thumb, index, middle, ring, pinky].
// 0 = fully extended, ~1.4 = fully curled into the palm.
export const FINGER_CURLS: Record<HandPose, [number, number, number, number, number]> = {
  neutral: [0.5, 0.5, 0.5, 0.5, 0.5],
  pierre: [1.4, 1.4, 1.4, 1.4, 1.4],
  feuille: [0, 0, 0, 0, 0],
  ciseau: [1.3, 0, 0, 1.3, 1.3]
};
