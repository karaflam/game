// frontend/src/three/scenes/PlayerWheelScene.tsx
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { WHEEL_SPIN_DURATION_MS, getWheelRotation, isWheelSpinSettled, wedgeCenterAngle } from './wheelTimeline';
import { DRUM_FONT_URL } from './textFont';
import { getContrastTextColor } from '../colorContrast';
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
const BEVEL_THICKNESS = 0.02;
const RIM_RADIUS = 1.18;
const RIM_THICKNESS = 0.08;
const HUB_RADIUS = 0.18;
const HUB_HEIGHT = 0.2;
// Text must clear the wedge's true beveled front face, which sits at
// WEDGE_THICKNESS + BEVEL_THICKNESS (ExtrudeGeometry's bevel adds its own
// thickness on top of `depth`), not just WEDGE_THICKNESS. The extra +0.13
// keeps this at the same total offset (0.30) already confirmed visible.
const TEXT_Z_OFFSET = WEDGE_THICKNESS + BEVEL_THICKNESS + 0.13;

// Fixed, theme-independent brushed-steel tone for the rim and hub, rather
// than a theme color: baseColor/drumBaseColor were tuned for small carousel
// cards against a background, not a large solid metal disc, and in practice
// stayed too close to sceneBackground in more than one theme (clair and
// romantique, not just the sombre/luxueux pair drumBaseColor was written
// for). A neutral mid-gray sits distinctly between every theme's near-white
// and near-black background by construction, so it can't repeat this bug.
const RIM_HUB_COLOR = '#9CA6B5';

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
  const center = wedgeCenterAngle(index, wedgeCount);
  const mathStart = clockwiseToMathAngle(center - wedgeAngle / 2);
  const mathEnd = clockwiseToMathAngle(center + wedgeAngle / 2);

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.absarc(0, 0, WHEEL_RADIUS, mathStart, mathEnd, true);
  shape.lineTo(0, 0);

  return new THREE.ExtrudeGeometry(shape, {
    depth: WEDGE_THICKNESS,
    bevelEnabled: true,
    bevelThickness: BEVEL_THICKNESS,
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

  // R3F only auto-disposes geometries it constructs from JSX (<bufferGeometry>
  // etc.) — geometries passed in via a `geometry={...}` prop, like these, are
  // the caller's responsibility. Without this, every remount/round or
  // wedgeCount change (players joining/leaving) leaks the old GPU buffers.
  useEffect(() => {
    return () => {
      wedgeGeometries.forEach(g => g.dispose());
    };
  }, [wedgeGeometries]);

  return (
    <group>
      <WheelCamera />

      {/* Rim: a slightly larger metal disc behind the wedges, peeking out
          around the edge — the "sleek modern metallic" look, driven entirely
          by theme metalness/roughness so it reads differently per theme
          without any wheel-specific color logic. */}
      <mesh position={[0, 0, -RIM_THICKNESS / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[RIM_RADIUS, RIM_RADIUS, RIM_THICKNESS, 48]} />
        <meshStandardMaterial color={RIM_HUB_COLOR} metalness={0.85} roughness={0.25} />
      </mesh>

      {/* Fixed pointer, outside the rotating group — stays at "up" regardless
          of wheel rotation, matching the 2D wheel's fixed pointer. */}
      <mesh position={[0, WHEEL_RADIUS + 0.12, 0.05]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.09, 0.18, 3]} />
        <meshStandardMaterial color={material.glowColor} emissive={material.glowColor} emissiveIntensity={0.4} metalness={0.6} roughness={0.3} />
      </mesh>

      <group ref={wedgeGroupRef}>
        {Array.from({ length: wedgeCount }).map((_, i) => {
          // glowColor/particleColor (not baseColor/drumBaseColor): both are
          // already proven to read clearly against every theme's background
          // — they're what the pointer, the digit text, and the ambient
          // particles already use. baseColor-family colors kept turning out
          // too close to sceneBackground in one theme or another (sombre and
          // luxueux, then clair and romantique too) to trust for a wedge
          // that's a large chunk of the wheel's visible surface.
          const fillColor = i % 2 === 0 ? material.glowColor : material.particleColor;
          const textAngle = wedgeCenterAngle(i, wedgeCount);
          const mathAngle = clockwiseToMathAngle(textAngle);
          const textRadius = WHEEL_RADIUS * 0.62;

          return (
            <group key={i}>
              <mesh geometry={wedgeGeometries[i]}>
                <meshStandardMaterial color={fillColor} metalness={material.metalness} roughness={material.roughness} />
              </mesh>
              {/* Keyed on the wedge's fill color: switching themes live
                  changes the derived text color in place on an existing
                  troika-three-text instance, which can leave its SDF glyph
                  render stuck blank instead of redrawing — see
                  NumberDrum.tsx's identical fix. */}
              {/* TEXT_Z_OFFSET must clear the wedge's true beveled front face
                  at WEDGE_THICKNESS + BEVEL_THICKNESS, not just
                  WEDGE_THICKNESS. The earlier bug (offset WEDGE_THICKNESS +
                  0.01) sat behind that beveled face, so the text was simply
                  occluded by the wedge geometry — not z-fighting against it —
                  confirmed by moving the text far in front (z=1) as a debug
                  check, where it rendered correctly, then dialing the offset
                  back down to the smallest value that stayed visible. */}
              <Text
                key={`${i}-${fillColor}`}
                // See NumberDrum.tsx: troika's async glyph build can leave a
                // stale/empty bounding sphere on the first frame, which default
                // frustum culling can mistake for off-screen — worse here since
                // this text also sits inside a group that rotates every frame.
                frustumCulled={false}
                position={[textRadius * Math.cos(mathAngle), textRadius * Math.sin(mathAngle), TEXT_Z_OFFSET]}
                rotation={[0, 0, -textAngle]}
                fontSize={0.2}
                color={getContrastTextColor(fillColor)}
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
        <meshStandardMaterial color={RIM_HUB_COLOR} metalness={0.85} roughness={0.25} />
      </mesh>
    </group>
  );
}
