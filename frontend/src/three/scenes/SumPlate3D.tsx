// frontend/src/three/scenes/SumPlate3D.tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
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
      <mesh>
        <planeGeometry args={[1.6, 0.6]} />
        <meshStandardMaterial
          color={material.baseColor}
          emissive={material.emissive}
          metalness={material.metalness}
          roughness={material.roughness}
          side={THREE.DoubleSide}
          transparent
          opacity={0.92}
        />
      </mesh>
      <Text position={[0, 0.12, 0.01]} fontSize={0.16} color={material.glowColor} anchorX="center" anchorY="middle">
        {`${sum} — ${parityLabel}`}
      </Text>
      <Text position={[0, -0.14, 0.01]} fontSize={0.13} color={material.glowColor} anchorX="center" anchorY="middle">
        {outcomeLabel}
      </Text>
    </group>
  );
}
