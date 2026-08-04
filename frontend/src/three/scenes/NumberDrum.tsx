// frontend/src/three/scenes/NumberDrum.tsx
import { useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { getCarouselOffset } from './carouselTimeline';
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
  /** 'horizontal' (default) for a single centered picker. 'vertical' for the
   * duel reveal, where two carousels sit side by side — horizontal neighbor
   * cards from each one reached toward the middle and interleaved with each
   * other there; stacking each carousel's neighbors above/below instead
   * keeps the two fully separate. */
  orientation?: 'horizontal' | 'vertical';
};

// A flat card carousel (1 card per number, 1-9) rather than a rotating
// cylinder: every card always faces the camera dead-on, so there's no
// "back of the plane" to ever render mirrored, and no per-face lighting
// angle that could black a face out on some device's GPU — the two classes
// of bug the drum kept hitting on real hardware.
const CARD_COUNT = 9;
const CARD_WIDTH = 1.05;
const CARD_HEIGHT = 0.75;
const HORIZONTAL_CARD_SPACING = 1.3;
// Tighter than the horizontal spacing on purpose: the desktop reveal
// container keeps a fixed (non-responsive) vertical camera FOV of 45°, which
// at this scene's camera distance only has about ±1.3 world units of
// vertical room to work with in total — split between the carousel and the
// sum/parity plate below it. A vertical spacing as generous as the
// horizontal one pushed neighbor cards (and, at larger DRUM_Y offsets, the
// plate itself) outside that budget and off-screen.
const VERTICAL_CARD_SPACING = 0.6;
const DRAG_SENSITIVITY = 1 / 130; // card-units per pixel of drag
const CARD_TILT_MAX = Math.PI / 3.5; // ~51°, full tilt reached one card-width away from center

function clampIndex(index: number): number {
  return Math.min(Math.max(Math.round(index), 0), CARD_COUNT - 1);
}

export function NumberDrum({ mode, material, position, orientation = 'horizontal' }: NumberDrumProps) {
  const isVertical = orientation === 'vertical';
  const spacing = isVertical ? VERTICAL_CARD_SPACING : HORIZONTAL_CARD_SPACING;
  const rowRef = useRef<THREE.Group>(null);
  const cardRefs = useRef<(THREE.Group | null)[]>(Array(CARD_COUNT).fill(null));
  const dragStateRef = useRef<{ dragging: boolean; lastPos: number; offset: number }>({
    dragging: false,
    lastPos: 0,
    offset: mode.kind === 'interactive' ? mode.value - 1 : 0
  });

  useFrame(() => {
    const row = rowRef.current;
    if (!row) return;

    let offset: number;
    switch (mode.kind) {
      case 'rolling':
        offset = getCarouselOffset(mode.elapsedMs, mode.targetValue - 1, CARD_COUNT);
        break;
      case 'settled':
        offset = mode.value - 1;
        break;
      case 'masked':
        offset = 0;
        break;
      case 'interactive':
        offset = dragStateRef.current.offset;
        break;
      default: {
        const _exhaustive: never = mode;
        offset = 0;
      }
    }

    if (isVertical) {
      row.position.y = offset * spacing;
    } else {
      row.position.x = -offset * spacing;
    }

    // Coverflow-style depth cue: the centered card faces the camera flat-on
    // and full size; cards further away turn on their tilt axis (like album
    // covers, or a Rolodex, angling away) as they shrink and recede — that
    // rotation is what actually reads as 3D, not just a flat card shrinking.
    for (let i = 0; i < CARD_COUNT; i++) {
      const card = cardRefs.current[i];
      if (!card) continue;
      const signedDistance = i - offset;
      const distance = Math.abs(signedDistance);
      card.scale.setScalar(Math.max(0.55, 1 - distance * 0.28));
      card.position.z = -Math.min(distance, 3) * 0.12;
      const tilt = -Math.sign(signedDistance) * Math.min(distance, 1) * CARD_TILT_MAX;
      if (isVertical) {
        card.rotation.x = -tilt;
      } else {
        card.rotation.y = tilt;
      }
    }
  });

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (mode.kind !== 'interactive') return;
    dragStateRef.current.dragging = true;
    dragStateRef.current.lastPos = isVertical ? event.clientY : event.clientX;
    (event.target as Element).setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (mode.kind !== 'interactive' || !dragStateRef.current.dragging) return;
    const pos = isVertical ? event.clientY : event.clientX;
    const delta = pos - dragStateRef.current.lastPos;
    dragStateRef.current.lastPos = pos;
    // Content follows the pointer: dragging right/down reveals earlier
    // cards, so it *decreases* the offset.
    const next = dragStateRef.current.offset - delta * DRAG_SENSITIVITY;
    dragStateRef.current.offset = Math.min(Math.max(next, 0), CARD_COUNT - 1);
  };

  const handlePointerUp = () => {
    // Always clear the drag flag, even if `mode` has changed away from
    // 'interactive' mid-drag (e.g. the round started while the pointer was
    // still down). Otherwise a stale `dragging: true` would make the next
    // plain pointermove — once this carousel becomes interactive again — be
    // treated as an active drag with no preceding pointerdown.
    const wasDragging = dragStateRef.current.dragging;
    dragStateRef.current.dragging = false;
    // This is also the onPointerLeave handler, so bail out unless a drag was
    // genuinely in progress — a plain hover-out must not commit a value.
    if (mode.kind !== 'interactive' || !wasDragging) return;
    const snapped = clampIndex(dragStateRef.current.offset);
    dragStateRef.current.offset = snapped;
    mode.onChange(snapped + 1);
  };

  const isMasked = mode.kind === 'masked';

  return (
    <group position={position}>
      {/* Invisible hit target spanning a few card-widths, centered on the
          carousel — big enough that a drag started slightly off from the
          exact front card still registers. */}
      {mode.kind === 'interactive' && (
        <mesh
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {isVertical ? (
            <planeGeometry args={[CARD_WIDTH + 0.6, spacing * 3]} />
          ) : (
            <planeGeometry args={[spacing * 3, CARD_HEIGHT + 0.6]} />
          )}
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      <group ref={rowRef}>
        {Array.from({ length: CARD_COUNT }).map((_, i) => (
          <group
            key={i}
            ref={el => {
              cardRefs.current[i] = el;
            }}
            position={isVertical ? [0, -i * spacing, 0] : [i * spacing, 0, 0]}
          >
            <mesh>
              <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
              <meshBasicMaterial color={isMasked ? '#1a1a24' : material.drumBaseColor ?? material.baseColor} />
            </mesh>
            <Text
              position={[0, 0, 0.01]}
              fontSize={0.5}
              color={isMasked ? '#5b5f72' : material.glowColor}
              anchorX="center"
              anchorY="middle"
              font={DRUM_FONT_URL}
            >
              {isMasked ? '?' : String(i + 1)}
            </Text>
          </group>
        ))}
      </group>
    </group>
  );
}
