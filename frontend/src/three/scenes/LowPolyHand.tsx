import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FINGER_CURLS, type HandPose } from './handPoses';
import { easeOutBack } from '../easing';
import type { ThemeMaterial } from '../themeMaterials';

type LowPolyHandProps = {
  pose: HandPose;
  position: [number, number, number];
  mirrored: boolean;
  material: ThemeMaterial;
  transitionProgress: number; // 0..1, where the hand's pose transition currently stands
};

const FINGER_COUNT = 5;
const FINGER_SPACING = 0.16;

export function LowPolyHand({ pose, position, mirrored, material, transitionProgress }: LowPolyHandProps) {
  const fingerRefs = useRef<(THREE.Group | null)[]>([]);
  const previousPoseRef = useRef<HandPose>(pose);
  const fromCurlsRef = useRef(FINGER_CURLS[pose]);

  if (previousPoseRef.current !== pose) {
    fromCurlsRef.current = FINGER_CURLS[previousPoseRef.current];
    previousPoseRef.current = pose;
  }

  useFrame(() => {
    const targetCurls = FINGER_CURLS[pose];
    const eased = easeOutBack(Math.min(Math.max(transitionProgress, 0), 1));
    for (let i = 0; i < FINGER_COUNT; i++) {
      const group = fingerRefs.current[i];
      if (!group) continue;
      const from = fromCurlsRef.current[i];
      const to = targetCurls[i];
      group.rotation.x = -(from + (to - from) * eased);
    }
  });

  const direction = mirrored ? -1 : 1;

  return (
    <group position={position} scale={[direction, 1, 1]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.65, 0.75, 0.22]} />
        <meshStandardMaterial
          color={material.baseColor}
          emissive={material.emissive}
          metalness={material.metalness}
          roughness={material.roughness}
        />
      </mesh>
      {Array.from({ length: FINGER_COUNT }).map((_, i) => (
        <group
          key={i}
          ref={el => {
            fingerRefs.current[i] = el;
          }}
          position={[-0.26 + i * FINGER_SPACING, 0.38, 0]}
        >
          <mesh castShadow position={[0, 0.22, 0]}>
            <boxGeometry args={[0.11, 0.44, 0.16]} />
            <meshStandardMaterial
              color={material.baseColor}
              emissive={material.emissive}
              metalness={material.metalness}
              roughness={material.roughness}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
