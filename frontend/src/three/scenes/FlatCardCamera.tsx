// frontend/src/three/scenes/FlatCardCamera.tsx
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

// Scoped to the calling scene only, like PlayerWheelScene's WheelCamera: the
// shared GameCanvas camera sits slightly above and back from the origin
// (good for the wheel/duel scenes' raised view), which makes a flat,
// dead-center card read as subtly tilted away from the viewer instead of
// facing them head-on. Used by BurstBadge and CardFlipScene.
export function FlatCardCamera() {
  const camera = useThree(state => state.camera);
  useEffect(() => {
    camera.position.set(0, 0, 3.2);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  return null;
}
