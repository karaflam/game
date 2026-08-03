// frontend/src/three/scenes/NumberDrum.tsx
import { useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { FACE_COUNT, drumRotationToFrontFace, faceIndexToDrumRotation } from './drumMath';
import { getRollAngle, isRollSettled } from './rollTimeline';
import { DRUM_FONT_URL } from './textFont';
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
  switch (mode.kind) {
    case 'masked':
      return '?';
    case 'rolling':
      return String(faceIndexZeroBased + 1);
    case 'settled':
      return String(faceIndexZeroBased + 1);
    case 'interactive':
      return String(faceIndexZeroBased + 1);
    default: {
      const _exhaustive: never = mode;
      return '?';
    }
  }
}

export function NumberDrum({ mode, material, position }: NumberDrumProps) {
  const drumRef = useRef<THREE.Group>(null);
  const dragStateRef = useRef<{ dragging: boolean; lastX: number; angle: number }>({
    dragging: false,
    lastX: 0,
    angle: mode.kind === 'interactive' ? faceIndexToDrumRotation(mode.value - 1) : 0
  });

  useFrame(() => {
    const drum = drumRef.current;
    if (!drum) return;

    switch (mode.kind) {
      case 'rolling':
        drum.rotation.x = getRollAngle(mode.elapsedMs, mode.targetValue - 1);
        break;
      case 'settled':
        drum.rotation.x = faceIndexToDrumRotation(mode.value - 1);
        break;
      case 'masked':
        drum.rotation.x = 0;
        break;
      case 'interactive':
        drum.rotation.x = dragStateRef.current.angle;
        break;
      default: {
        const _exhaustive: never = mode;
        drum.rotation.x = 0;
      }
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
    // Always clear the drag flag, even if `mode` has changed away from
    // 'interactive' mid-drag (e.g. the round started while the pointer was
    // still down). Otherwise a stale `dragging: true` would make the next
    // plain pointermove — once this drum becomes interactive again — be
    // treated as an active drag with no preceding pointerdown.
    const wasDragging = dragStateRef.current.dragging;
    dragStateRef.current.dragging = false;
    // This is also the onPointerLeave handler, so bail out unless a drag was
    // genuinely in progress — a plain hover-out must not commit a value.
    if (mode.kind !== 'interactive' || !wasDragging) return;
    const shownFace = drumRotationToFrontFace(dragStateRef.current.angle);
    dragStateRef.current.angle = faceIndexToDrumRotation(shownFace);
    mode.onChange(shownFace + 1);
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
                color={isMasked ? '#1a1a24' : material.baseColor}
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
              font={DRUM_FONT_URL}
            >
              {faceLabel(mode, i)}
            </Text>
          </group>
        ))}
      </group>
    </group>
  );
}
