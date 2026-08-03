// frontend/src/three/scenes/BurstBadge.tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getBadgeScale } from './burstTimeline';
import type { ThemeMaterial } from '../themeMaterials';

export type BurstVariant = 'success' | 'fail' | 'neutral';

type BurstBadgeProps = {
  variant: BurstVariant;
  material: ThemeMaterial;
};

const VARIANT_COLOR: Record<BurstVariant, (material: ThemeMaterial) => string> = {
  success: material => material.glowColor,
  fail: () => '#7a2b2b',
  neutral: material => material.particleColor
};

function IconShape({ variant, color }: { variant: BurstVariant; color: string }) {
  if (variant === 'success') {
    // Checkmark: two short bars meeting at an angle.
    return (
      <group>
        <mesh position={[-0.08, -0.05, 0]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.22, 0.08, 0.08]} />
          <meshStandardMaterial color={color} emissive={color} />
        </mesh>
        <mesh position={[0.06, 0.05, 0]} rotation={[0, 0, -Math.PI / 4]}>
          <boxGeometry args={[0.34, 0.08, 0.08]} />
          <meshStandardMaterial color={color} emissive={color} />
        </mesh>
      </group>
    );
  }
  if (variant === 'fail') {
    // X: two crossed bars.
    return (
      <group>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.4, 0.08, 0.08]} />
          <meshStandardMaterial color={color} emissive={color} />
        </mesh>
        <mesh rotation={[0, 0, -Math.PI / 4]}>
          <boxGeometry args={[0.4, 0.08, 0.08]} />
          <meshStandardMaterial color={color} emissive={color} />
        </mesh>
      </group>
    );
  }
  // Neutral: a single horizontal dash.
  return (
    <mesh>
      <boxGeometry args={[0.32, 0.08, 0.08]} />
      <meshStandardMaterial color={color} emissive={color} />
    </mesh>
  );
}

export function BurstBadge({ variant, material }: BurstBadgeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const startTimeRef = useRef<number | null>(null);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    if (startTimeRef.current === null) {
      startTimeRef.current = clock.getElapsedTime() * 1000;
    }
    const elapsedMs = clock.getElapsedTime() * 1000 - startTimeRef.current;
    group.scale.setScalar(getBadgeScale(elapsedMs));
  });

  const color = VARIANT_COLOR[variant](material);

  return (
    <group ref={groupRef}>
      <mesh>
        <circleGeometry args={[0.45, 32]} />
        <meshStandardMaterial color={material.baseColor} emissive={color} metalness={material.metalness} roughness={material.roughness} />
      </mesh>
      <group position={[0, 0, 0.02]}>
        <IconShape variant={variant} color={color} />
      </group>
    </group>
  );
}
