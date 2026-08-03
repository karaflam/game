// frontend/src/three/scenes/NumberDrum.tsx
import { useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { FACE_COUNT, angleToFaceIndex, faceIndexToAngle } from './drumMath';
import { getRollAngle, isRollSettled } from './rollTimeline';
import type { ThemeMaterial } from '../themeMaterials';

export type NumberDrumMode =
  | { kind: 'interactive'; value: number; onChange: (value: number) => void }
  | { kind: 'masked' }
  | { kind: 'rolling'; targetValue: number; elapsedMs: number }
  | { kind: 'settled'; value: number };

type NumberDrumProps = {
  mode: NumberDrumMode;
  material: ThemeMaterial;
  position: [number, number, number];
};

const DRUM_RADIUS = 0.55;
const FACE_WIDTH = 0.5;
const FACE_HEIGHT = 0.32;
const DRAG_SENSITIVITY = 0.012; // radians per pixel of horizontal drag

function faceLabel(mode: NumberDrumMode, faceIndexZeroBased: number): string {
  if (mode.kind === 'masked') return '?';
  if (mode.kind === 'rolling') return String(faceIndexZeroBased + 1);
  return String(faceIndexZeroBased + 1);
}

export function NumberDrum({ mode, material, position }: NumberDrumProps) {
  const drumRef = useRef<THREE.Group>(null);
  const dragStateRef = useRef<{ dragging: boolean; lastX: number; angle: number }>({
    dragging: false,
    lastX: 0,
    angle: mode.kind === 'interactive' ? faceIndexToAngle(mode.value - 1) : 0
  });

  useFrame(() => {
    const drum = drumRef.current;
    if (!drum) return;

    if (mode.kind === 'rolling') {
      drum.rotation.x = getRollAngle(mode.elapsedMs, mode.targetValue - 1);
    } else if (mode.kind === 'settled') {
      drum.rotation.x = faceIndexToAngle(mode.value - 1);
    } else if (mode.kind === 'masked') {
      drum.rotation.x = 0;
    } else {
      drum.rotation.x = dragStateRef.current.angle;
    }
  });

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (mode.kind !== 'interactive') return;
    dragStateRef.current.dragging = true;
    dragStateRef.current.lastX = event.clientX;
    (event.target as Element).setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (mode.kind !== 'interactive' || !dragStateRef.current.dragging) return;
    const dx = event.clientX - dragStateRef.current.lastX;
    dragStateRef.current.lastX = event.clientX;
    dragStateRef.current.angle += dx * DRAG_SENSITIVITY;
    // No re-render needed here: useFrame reads dragStateRef.current.angle every
    // frame and applies it directly to the mesh, so rotation stays smooth without
    // React state churn on every pointer-move event.
  };

  const handlePointerUp = () => {
    if (mode.kind !== 'interactive') return;
    dragStateRef.current.dragging = false;
    const snappedFace = angleToFaceIndex(dragStateRef.current.angle);
    dragStateRef.current.angle = faceIndexToAngle(snappedFace);
    mode.onChange(snappedFace + 1);
  };

  const isMasked = mode.kind === 'masked';

  return (
    <group position={position}>
      <group
        ref={drumRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {Array.from({ length: FACE_COUNT }).map((_, i) => (
          <group key={i} rotation={[i * ((2 * Math.PI) / FACE_COUNT), 0, 0]}>
            <mesh position={[0, 0, DRUM_RADIUS]}>
              <planeGeometry args={[FACE_WIDTH, FACE_HEIGHT]} />
              <meshStandardMaterial
                color={isMasked ? '#1a1a2444' : material.baseColor}
                emissive={isMasked ? '#000000' : material.emissive}
                metalness={material.metalness}
                roughness={material.roughness}
                side={THREE.DoubleSide}
              />
            </mesh>
            <Text
              position={[0, 0, DRUM_RADIUS + 0.01]}
              fontSize={0.22}
              color={isMasked ? '#5b5f72' : material.glowColor}
              anchorX="center"
              anchorY="middle"
            >
              {faceLabel(mode, i)}
            </Text>
          </group>
        ))}
      </group>
    </group>
  );
}
