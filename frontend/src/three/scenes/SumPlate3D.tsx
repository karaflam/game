// frontend/src/three/scenes/SumPlate3D.tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { DRUM_FONT_URL } from './textFont';
import type { ThemeMaterial } from '../themeMaterials';

type SumPlate3DProps = {
  sum: number;
  parityLabel: string;
  outcomeLabel: string;
  material: ThemeMaterial;
  position: [number, number, number];
  visible: boolean;
};

export function SumPlate3D({ sum, parityLabel, outcomeLabel, material, position, visible }: SumPlate3DProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    const t = clock.getElapsedTime();
    group.position.y = position[1] + Math.sin(t * 1.1) * 0.05;
    group.scale.setScalar(visible ? 1 : 0.001);
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Non-emissive plate: `emissive` and `glowColor` are the same color in
          every theme, so a glowing plate made the text below blend into its
          own background — see the identical fix in NumberDrum.tsx. */}
      <mesh>
        <planeGeometry args={[1.6, 0.6]} />
        <meshStandardMaterial
          color={material.baseColor}
          metalness={material.metalness}
          roughness={material.roughness}
          side={THREE.DoubleSide}
          transparent
          opacity={0.92}
        />
      </mesh>
      {/* Keyed on color: switching themes live (not a page reload) changes
          this color in place on the existing troika-three-text instance,
          which can leave its SDF glyph render stuck blank instead of
          redrawing. Keying on the color forces a fresh mount on every
          theme switch instead of patching the live instance. */}
      <Text
        key={`sum-${material.glowColor}`}
        position={[0, 0.12, 0.01]}
        fontSize={0.16}
        color={material.glowColor}
        anchorX="center"
        anchorY="middle"
        font={DRUM_FONT_URL}
      >
        {`${sum} — ${parityLabel}`}
      </Text>
      <Text
        key={`outcome-${material.glowColor}`}
        position={[0, -0.14, 0.01]}
        fontSize={0.13}
        color={material.glowColor}
        anchorX="center"
        anchorY="middle"
        font={DRUM_FONT_URL}
      >
        {outcomeLabel}
      </Text>
    </group>
  );
}
