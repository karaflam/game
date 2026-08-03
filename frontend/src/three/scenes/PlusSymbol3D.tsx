// frontend/src/three/scenes/PlusSymbol3D.tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ThemeMaterial } from '../themeMaterials';

type PlusSymbol3DProps = {
  material: ThemeMaterial;
  position: [number, number, number];
};

export function PlusSymbol3D({ material, position }: PlusSymbol3DProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    const t = clock.getElapsedTime();
    group.position.y = position[1] + Math.sin(t * 1.4) * 0.06;
    group.rotation.y = Math.sin(t * 0.6) * Math.PI;
    group.rotation.x = Math.sin(t * 0.4) * 0.15;
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh>
        <boxGeometry args={[0.34, 0.1, 0.1]} />
        <meshStandardMaterial color={material.glowColor} emissive={material.emissive} metalness={0.4} roughness={0.3} />
      </mesh>
      <mesh>
        <boxGeometry args={[0.1, 0.34, 0.1]} />
        <meshStandardMaterial color={material.glowColor} emissive={material.emissive} metalness={0.4} roughness={0.3} />
      </mesh>
    </group>
  );
}
