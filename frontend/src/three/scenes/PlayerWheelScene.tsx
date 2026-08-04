// frontend/src/three/scenes/PlayerWheelScene.tsx
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { WHEEL_SPIN_DURATION_MS, getWheelRotation, isWheelSpinSettled, wedgeCenterAngle } from './wheelTimeline';
import { DRUM_FONT_URL } from './textFont';
import type { ThemeMaterial } from '../themeMaterials';

type PlayerWheelSceneProps = {
  players: string[];
  landedOn: string;
  spinning: boolean;
  onSpinComplete: () => void;
  material: ThemeMaterial;
};

const WHEEL_RADIUS = 1.1;
const WEDGE_THICKNESS = 0.15;
const RIM_RADIUS = 1.18;
const RIM_THICKNESS = 0.08;
const HUB_RADIUS = 0.18;
const HUB_HEIGHT = 0.2;

// Camera looks down at the wheel from ~36° above the horizontal instead of
// straight overhead, so the wedges' thickness, bevel, and metal shading are
// actually visible — a flat top-down view reads as "almost 2D" even with
// real geometry underneath (the same lesson the Odd or Even carousel needed
// its coverflow tilt for). Scoped to this scene only via an imperative
// camera update, not a change to GameCanvas's shared default camera.
function WheelCamera() {
  const camera = useThree(state => state.camera);

  useEffect(() => {
    camera.position.set(0, 2.2, 3.0);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return null;
}

// Converts wheelTimeline's "clockwise radians from up" angle convention into
// the standard math-angle convention THREE.Shape.absarc expects (0 = +X
// axis, increasing counter-clockwise).
function clockwiseToMathAngle(clockwiseAngle: number): number {
  return Math.PI / 2 - clockwiseAngle;
}

function buildWedgeGeometry(index: number, wedgeCount: number): THREE.ExtrudeGeometry {
  const wedgeAngle = (2 * Math.PI) / wedgeCount;
  const mathStart = clockwiseToMathAngle(index * wedgeAngle);
  const mathEnd = clockwiseToMathAngle((index + 1) * wedgeAngle);

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.absarc(0, 0, WHEEL_RADIUS, mathStart, mathEnd, true);
  shape.lineTo(0, 0);

  return new THREE.ExtrudeGeometry(shape, {
    depth: WEDGE_THICKNESS,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2
  });
}

function truncateLabel(name: string): string {
  return name.length > 12 ? `${name.slice(0, 11)}…` : name;
}

export function PlayerWheelScene({ players, landedOn, spinning, onSpinComplete, material }: PlayerWheelSceneProps) {
  const wedgeGroupRef = useRef<THREE.Group>(null);
  const startTimeRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const spinSeedRef = useRef(0);

  const wedgeCount = Math.max(1, players.length);
  const targetIndex = Math.max(0, players.indexOf(landedOn));

  // Fires whenever `spinning` transitions to true — a fresh spin — mirroring
  // the 2D wheel's own `[spinning]`-dependent effect in PlayerWheel.tsx.
  useEffect(() => {
    if (!spinning) return;
    spinSeedRef.current += 1;
    startTimeRef.current = null;
    completedRef.current = false;
  }, [spinning]);

  useFrame(({ clock }) => {
    const wedgeGroup = wedgeGroupRef.current;
    if (!wedgeGroup) return;

    if (!spinning) {
      // Settled/idle: hold the wheel at its fully-landed rotation for the
      // current target so it doesn't snap back to 0 between spins.
      wedgeGroup.rotation.z = -getWheelRotation(WHEEL_SPIN_DURATION_MS, targetIndex, wedgeCount, spinSeedRef.current);
      return;
    }

    if (startTimeRef.current === null) {
      startTimeRef.current = clock.getElapsedTime() * 1000;
    }
    const elapsedMs = clock.getElapsedTime() * 1000 - startTimeRef.current;
    // Negated: wheelTimeline's convention is clockwise-positive, but
    // Three.js's rotation.z is counter-clockwise-positive when viewed from
    // this camera's general position — negating converts one into the
    // other so the wheel visibly spins clockwise.
    wedgeGroup.rotation.z = -getWheelRotation(elapsedMs, targetIndex, wedgeCount, spinSeedRef.current);

    if (isWheelSpinSettled(elapsedMs) && !completedRef.current) {
      completedRef.current = true;
      onSpinComplete();
    }
  });

  const wedgeGeometries = useMemo(
    () => Array.from({ length: wedgeCount }, (_, i) => buildWedgeGeometry(i, wedgeCount)),
    [wedgeCount]
  );

  return (
    <group>
      <WheelCamera />

      {/* Rim: a slightly larger metal disc behind the wedges, peeking out
          around the edge — the "sleek modern metallic" look, driven entirely
          by theme metalness/roughness so it reads differently per theme
          without any wheel-specific color logic. */}
      <mesh position={[0, 0, -RIM_THICKNESS / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[RIM_RADIUS, RIM_RADIUS, RIM_THICKNESS, 48]} />
        <meshStandardMaterial
          color={material.baseColor}
          metalness={Math.min(1, material.metalness + 0.3)}
          roughness={Math.max(0.1, material.roughness - 0.1)}
        />
      </mesh>

      {/* Fixed pointer, outside the rotating group — stays at "up" regardless
          of wheel rotation, matching the 2D wheel's fixed pointer. */}
      <mesh position={[0, WHEEL_RADIUS + 0.12, 0.05]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.09, 0.18, 3]} />
        <meshStandardMaterial color={material.glowColor} emissive={material.glowColor} emissiveIntensity={0.4} metalness={0.6} roughness={0.3} />
      </mesh>

      <group ref={wedgeGroupRef}>
        {Array.from({ length: wedgeCount }).map((_, i) => {
          const fillColor = i % 2 === 0 ? material.baseColor : material.particleColor;
          const textAngle = wedgeCenterAngle(i, wedgeCount);
          const mathAngle = clockwiseToMathAngle(textAngle);
          const textRadius = WHEEL_RADIUS * 0.62;

          return (
            <group key={i}>
              <mesh geometry={wedgeGeometries[i]}>
                <meshStandardMaterial color={fillColor} metalness={material.metalness} roughness={material.roughness} />
              </mesh>
              {/* Keyed on the color it renders: switching themes live changes
                  this color in place on an existing troika-three-text
                  instance, which can leave its SDF glyph render stuck blank
                  instead of redrawing — see NumberDrum.tsx's identical fix. */}
              <Text
                key={`${i}-${material.glowColor}`}
                position={[textRadius * Math.cos(mathAngle), textRadius * Math.sin(mathAngle), WEDGE_THICKNESS + 0.01]}
                rotation={[0, 0, -textAngle]}
                fontSize={0.14}
                color={material.glowColor}
                anchorX="center"
                anchorY="middle"
                font={DRUM_FONT_URL}
              >
                {truncateLabel(players[i] ?? '')}
              </Text>
            </group>
          );
        })}
      </group>

      {/* Hub: sits in front of the wedges, covering their inner point. */}
      <mesh position={[0, 0, WEDGE_THICKNESS + 0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[HUB_RADIUS, HUB_RADIUS, HUB_HEIGHT, 24]} />
        <meshStandardMaterial
          color={material.baseColor}
          metalness={Math.min(1, material.metalness + 0.3)}
          roughness={Math.max(0.1, material.roughness - 0.1)}
        />
      </mesh>
    </group>
  );
}
