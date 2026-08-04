import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getBurstProgress } from './burstTimeline';

type BurstParticlesProps = {
  color: string;
};

const PARTICLE_COUNT = 24;

export function BurstParticles({ color }: BurstParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const startTimeRef = useRef<number | null>(null);

  const directions = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
      const radius = 0.5 + Math.random() * 0.5;
      arr[i * 3] = Math.cos(angle) * radius;
      arr[i * 3 + 1] = Math.sin(angle) * radius;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    }
    return arr;
  }, []);

  const positions = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);

  useFrame(({ clock }) => {
    const points = pointsRef.current;
    const mat = materialRef.current;
    if (!points || !mat) return;
    if (startTimeRef.current === null) {
      startTimeRef.current = clock.getElapsedTime() * 1000;
    }
    const elapsedMs = clock.getElapsedTime() * 1000 - startTimeRef.current;
    const progress = getBurstProgress(elapsedMs);

    const posAttr = points.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      posAttr.array[i * 3] = directions[i * 3] * progress;
      posAttr.array[i * 3 + 1] = directions[i * 3 + 1] * progress;
      posAttr.array[i * 3 + 2] = directions[i * 3 + 2] * progress;
    }
    posAttr.needsUpdate = true;
    mat.opacity = 1 - progress;
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial ref={materialRef} color={color} size={0.06} sizeAttenuation transparent opacity={1} />
    </points>
  );
}
