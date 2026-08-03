import { Suspense, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { ParticleField } from './ambient/ParticleField';
import { getThemeMaterial } from './themeMaterials';
import type { ThemeId } from '@/hooks/useTheme';
import type { Quality } from './qualityTracker';

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
      style={{ touchAction: 'none' }}
    >
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
