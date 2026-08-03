// frontend/src/three/scenes/CardFlipScene.tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getCardRotationY } from './cardFlipTimeline';
import type { ThemeMaterial } from '../themeMaterials';

type CardFlipSceneProps = {
  material: ThemeMaterial;
};

export function CardFlipScene({ material }: CardFlipSceneProps) {
  const cardRef = useRef<THREE.Group>(null);
  const startTimeRef = useRef<number | null>(null);

  useFrame(({ clock }) => {
    const card = cardRef.current;
    if (!card) return;
    if (startTimeRef.current === null) {
      startTimeRef.current = clock.getElapsedTime() * 1000;
    }
    const elapsedMs = clock.getElapsedTime() * 1000 - startTimeRef.current;
    card.rotation.y = getCardRotationY(elapsedMs);
  });

  return (
    <group ref={cardRef}>
      {/* Back face: visible at rest (rotation 0), theme-decorative side. */}
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[1.4, 1.9]} />
        <meshStandardMaterial color={material.baseColor} emissive={material.emissive} metalness={material.metalness} roughness={material.roughness} />
      </mesh>
      {/* Front face: revealed once the card has rotated past 90°, faces the opposite way. */}
      <mesh position={[0, 0, -0.02]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[1.4, 1.9]} />
        <meshStandardMaterial color={material.sceneBackground} emissive={material.glowColor} metalness={material.metalness} roughness={material.roughness} />
      </mesh>
    </group>
  );
}
