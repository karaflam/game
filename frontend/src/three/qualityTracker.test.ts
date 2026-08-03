import { describe, expect, it } from 'vitest';
import { createQualityTracker } from './qualityTracker';

function runFrames(tracker: ReturnType<typeof createQualityTracker>, count: number, deltaMs: number) {
  let last;
  for (let i = 0; i < count; i++) {
    last = tracker.recordFrame(deltaMs);
  }
  return last;
}

describe('createQualityTracker', () => {
  it('stays high during the 2s grace period regardless of framerate', () => {
    const tracker = createQualityTracker();
    // 16.7fps (60ms/frame) for 1.92s total — under the 2s grace period
    const quality = runFrames(tracker, 32, 60);
    expect(quality).toBe('high');
  });

  it('downgrades from high to medium once the grace period ends with a bad framerate', () => {
    const tracker = createQualityTracker();
    // At 60ms/frame (~16.7fps), elapsedSinceStart crosses 2000ms on frame 34,
    // which is also the first evaluation (windowElapsed == elapsedSinceStart
    // until the first reset) — so this frame both ends the grace period and
    // triggers the first quality check.
    const quality = runFrames(tracker, 34, 60);
    expect(quality).toBe('medium');
  });

  it('only steps down one quality level per measurement window', () => {
    const tracker = createQualityTracker();
    const afterFirstWindow = runFrames(tracker, 34, 60);
    expect(afterFirstWindow).toBe('medium');
    // Next window needs ~1000ms of frames post-reset: 17 frames * 60ms = 1020ms
    const afterSecondWindow = runFrames(tracker, 17, 60);
    expect(afterSecondWindow).toBe('low');
  });

  it('ratchets all the way down to fallback2d over consecutive bad windows', () => {
    const tracker = createQualityTracker();
    runFrames(tracker, 34, 60); // grace period ends + window 1: high -> medium
    runFrames(tracker, 17, 60); // window 2: medium -> low
    const quality = runFrames(tracker, 17, 60); // window 3: low -> fallback2d
    expect(quality).toBe('fallback2d');
  });

  it('stays at high when framerate is healthy', () => {
    const tracker = createQualityTracker();
    // 16ms/frame (62.5fps): grace period ends at frame 125 (2000ms), which
    // is also the first window evaluation — avgFps ~62.5 stays above the
    // high threshold (45), so quality never downgrades.
    const quality = runFrames(tracker, 150, 16);
    expect(quality).toBe('high');
  });
});
