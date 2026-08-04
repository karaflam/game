// frontend/src/three/scenes/CardFlipScene.tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { getCardRotationY } from './cardFlipTimeline';
import { BOLD_FONT_URL } from './textFont';
import { FlatCardCamera } from './FlatCardCamera';
import type { ThemeMaterial } from '../themeMaterials';

type CardFlipSceneProps = {
  material: ThemeMaterial;
  message: string;
};

const CARD_WIDTH = 1.9;
const CARD_HEIGHT = 2.5;
const LEVITATE_AMPLITUDE = 0.08;

export function CardFlipScene({ material, message }: CardFlipSceneProps) {
  // Separate from cardRef: this group only handles the gentle float, so it
  // doesn't fight cardRef's own rotation.y (the flip animation).
  const floatRef = useRef<THREE.Group>(null);
  const cardRef = useRef<THREE.Group>(null);
  const startTimeRef = useRef<number | null>(null);

  useFrame(({ clock }) => {
    const card = cardRef.current;
    const float = floatRef.current;
    if (!card || !float) return;
    if (startTimeRef.current === null) {
      startTimeRef.current = clock.getElapsedTime() * 1000;
    }
    const elapsedMs = clock.getElapsedTime() * 1000 - startTimeRef.current;
    card.rotation.y = getCardRotationY(elapsedMs);
    float.position.y = Math.sin(clock.getElapsedTime() * 1.1) * LEVITATE_AMPLITUDE;
  });

  return (
    <group ref={floatRef}>
      <FlatCardCamera />
      <group ref={cardRef}>
        {/* Back face: visible at rest (rotation 0), a plain mystery side. */}
        <group position={[0, 0, 0.02]}>
          <mesh>
            <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
            <meshStandardMaterial color={material.baseColor} emissive={material.emissive} metalness={material.metalness} roughness={material.roughness} />
          </mesh>
          <Text
            key={`back-${material.glowColor}`}
            position={[0, 0, 0.02]}
            fontSize={0.6}
            color={material.glowColor}
            anchorX="center"
            anchorY="middle"
            font={BOLD_FONT_URL}
            frustumCulled={false}
          >
            ?
          </Text>
        </group>
        {/* Front face: revealed once the card has rotated past 90°, faces the
            opposite way — carries the actual prompt text directly on the card. */}
        <group position={[0, 0, -0.02]} rotation={[0, Math.PI, 0]}>
          <mesh>
            {/* Same fill as ScorePill's frame (material.cardColor === this
                theme's --color-secondary), matching BurstBadge's card. */}
            <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
            <meshStandardMaterial color={material.cardColor} metalness={material.metalness} roughness={material.roughness} />
          </mesh>
          <Text
            key={`front-${material.glowColor}`}
            position={[0, 0, 0.02]}
            fontSize={0.18}
            maxWidth={CARD_WIDTH - 0.4}
            lineHeight={1.25}
            textAlign="center"
            color={material.glowColor}
            anchorX="center"
            anchorY="middle"
            font={BOLD_FONT_URL}
            frustumCulled={false}
          >
            {message}
          </Text>
        </group>
      </group>
    </group>
  );
}
