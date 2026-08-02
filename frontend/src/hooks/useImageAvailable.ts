import { useEffect, useState } from 'react';

// Optimistic by default (assumes the image will load) so there's no flash of the fallback state
// on the common path — flips to false only once the browser confirms the image failed to load.
export function useImageAvailable(src: string): boolean {
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setAvailable(true);
    };
    img.onerror = () => {
      if (!cancelled) setAvailable(false);
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return available;
}
