export type Quality = 'high' | 'medium' | 'low' | 'fallback2d';

const GRACE_PERIOD_MS = 2000;
const WINDOW_MS = 1000;
const FPS_THRESHOLDS: Record<'high' | 'medium' | 'low', number> = {
  high: 45,
  medium: 30,
  low: 20
};

export function createQualityTracker() {
  let quality: Quality = 'high';
  let elapsedSinceStart = 0;
  let windowElapsed = 0;
  let windowFrames = 0;

  function recordFrame(deltaMs: number): Quality {
    elapsedSinceStart += deltaMs;
    windowElapsed += deltaMs;
    windowFrames += 1;

    if (elapsedSinceStart < GRACE_PERIOD_MS || windowElapsed < WINDOW_MS) {
      return quality;
    }

    const avgFps = (windowFrames / windowElapsed) * 1000;
    windowElapsed = 0;
    windowFrames = 0;

    if (quality === 'high' && avgFps < FPS_THRESHOLDS.high) {
      quality = 'medium';
    } else if (quality === 'medium' && avgFps < FPS_THRESHOLDS.medium) {
      quality = 'low';
    } else if (quality === 'low' && avgFps < FPS_THRESHOLDS.low) {
      quality = 'fallback2d';
    }

    return quality;
  }

  function getQuality(): Quality {
    return quality;
  }

  return { recordFrame, getQuality };
}
