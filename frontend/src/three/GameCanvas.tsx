import { Suspense, useEffect, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { ParticleField } from './ambient/ParticleField';
import { getThemeMaterial } from './themeMaterials';
import type { ThemeId } from '@/hooks/useTheme';
import type { Quality } from './qualityTracker';

// A fixed vertical FOV means the *horizontal* FOV shrinks on a narrow/tall
// container (hFov depends on vFov and aspect) — on a narrow mobile reveal
// box this pushed content spread out sideways (e.g. Odd or Even's two
// number drums) outside the camera's view entirely, rendering as clipped
// fragments at the frame edges.
//
// This only kicks in for portrait-ish containers (aspect < 1, i.e. taller
// than wide — the mobile case). Landscape/desktop containers keep the
// original fixed vertical FOV: applying the same horizontal-FOV-preserving
// formula there would shrink the vertical FOV drastically on a wide desktop
// canvas (e.g. aspect ~2.4 → vertical FOV collapses to ~22°), visibly
// changing how every scene is framed on desktop just to fix a mobile-only
// clipping bug.
const BASE_VERTICAL_FOV_DEG = 45;
const TARGET_HORIZONTAL_FOV_DEG = 50;

function ResponsiveCamera() {
  const camera = useThree(state => state.camera);
  const size = useThree(state => state.size);

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera) || size.height === 0) return;
    const aspect = size.width / size.height;

    if (aspect >= 1) {
      camera.fov = BASE_VERTICAL_FOV_DEG;
    } else {
      const horizontalFovRad = (TARGET_HORIZONTAL_FOV_DEG * Math.PI) / 180;
      const verticalFovRad = 2 * Math.atan(Math.tan(horizontalFovRad / 2) / aspect);
      camera.fov = (verticalFovRad * 180) / Math.PI;
    }
    camera.updateProjectionMatrix();
  }, [camera, size]);

  return null;
}

type GameCanvasProps = {
  theme: ThemeId;
  quality: Quality;
  children?: ReactNode;
  /** Bloom/glow post-processing — on by default (Pierre-Feuille-Ciseaux's hand
   * duel reads well with it), but other scenes (e.g. the Odd or Even number
   * drums) found it more distracting than useful, so callers can opt out. */
  bloom?: boolean;
};

export function GameCanvas({ theme, quality, children, bloom = true }: GameCanvasProps) {
  if (quality === 'fallback2d') {
    return null;
  }

  const material = getThemeMaterial(theme);
  const particleDensity = quality === 'high' ? 150 : quality === 'medium' ? 70 : 25;
  const bloomEnabled = bloom && (quality === 'high' || quality === 'medium');

  return (
    <Canvas
      camera={{ position: [0, 0.6, 3.2], fov: 45 }}
      dpr={[1, quality === 'high' ? 2 : 1]}
      // pan-y (not none): the only pointer-driven interaction in any scene is
      // NumberDrum's horizontal carousel drag — vertical page scroll should
      // pass through untouched instead of getting captured by the canvas.
      style={{ touchAction: 'pan-y' }}
    >
      <ResponsiveCamera />
      <color attach="background" args={[material.sceneBackground]} />
      <fog attach="fog" args={[material.sceneBackground, 4, 9]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 3, 2]} intensity={1.1} color={material.glowColor} castShadow />
      <Suspense fallback={null}>
        <ParticleField color={material.particleColor} density={particleDensity} />
      </Suspense>
      {/* Note: if a hand's .glb is still loading, this subtree suspends and HandDuelScene's
          clock pauses with it — acceptable for now since useGLTF.preload starts the download
          at app boot, but a future pass should decouple the duel timer from Suspense. */}
      <Suspense fallback={null}>
        {children}
      </Suspense>
      {bloomEnabled && (
        <EffectComposer>
          <Bloom intensity={0.6} luminanceThreshold={0.2} luminanceSmoothing={0.9} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
