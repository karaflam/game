import { useEffect, useRef, useState } from 'react';
import { createQualityTracker, type Quality } from './qualityTracker';

export function useAdaptiveQuality(): Quality {
  const [quality, setQuality] = useState<Quality>('high');
  const trackerRef = useRef(createQualityTracker());
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    let frameId: number;

    const tick = (time: number) => {
      if (lastTimeRef.current !== null) {
        const delta = time - lastTimeRef.current;
        const next = trackerRef.current.recordFrame(delta);
        setQuality(prev => (prev === next ? prev : next));
      }
      lastTimeRef.current = time;
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return quality;
}
