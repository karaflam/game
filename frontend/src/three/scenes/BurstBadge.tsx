// frontend/src/three/scenes/BurstBadge.tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { getBadgeScale } from './burstTimeline';
import { BOLD_FONT_URL } from './textFont';
import { FlatCardCamera } from './FlatCardCamera';
import { getContrastTextColor } from '../colorContrast';
import type { ThemeMaterial } from '../themeMaterials';

export type BurstVariant = 'success' | 'fail' | 'neutral';

type BurstBadgeProps = {
  variant: BurstVariant;
  material: ThemeMaterial;
  headline: string;
  detail?: string;
  /** Hides the small icon badge — some callers (Would You Rather) prefer the
   * card read as plain text with no extra symbol. */
  showIcon?: boolean;
  /** Overrides the card's fill (normally material.cardColor) with a semantic
   * color — e.g. green/red for a match/mismatch outcome. Headline and detail
   * text automatically switch to a contrast-safe color against it. */
  cardColorOverride?: string;
};

const VARIANT_COLOR: Record<BurstVariant, (material: ThemeMaterial) => string> = {
  success: material => material.glowColor,
  fail: () => '#e5484d',
  neutral: material => material.particleColor
};

export function getVariantColor(variant: BurstVariant, material: ThemeMaterial): string {
  return VARIANT_COLOR[variant](material);
}

const CARD_WIDTH = 2.4;
const CARD_HEIGHT = 3;
const LEVITATE_AMPLITUDE = 0.08;

const STROKE_THICKNESS = 0.08;

// Points of a checkmark's two strokes (short leg down, long leg up-right).
// Pre-centered so the polyline's own bounding-box center sits at (0, 0) —
// the icon group is positioned at the bubble's center, so this is what
// actually centers the checkmark inside it. Rendered as boxes that fall
// short of touching (flat square ends meeting at an angle), so Polyline
// also drops a small sphere at every point to round the seams and endpoints
// into one continuous, gap-free stroke.
const CHECK_POINTS: [number, number][] = [
  [-0.2, 0.01],
  [-0.04, -0.17],
  [0.2, 0.17]
];

// The fail cross's two independent diagonal strokes — unlike the checkmark's
// single bent stroke, an X's two lines only ever share their center point, so
// each is its own 2-point Polyline (giving both bars rounded tips) rather
// than one continuous path.
const CROSS_STROKE_A: [number, number][] = [
  [-0.16, 0.16],
  [0.16, -0.16]
];
const CROSS_STROKE_B: [number, number][] = [
  [-0.16, -0.16],
  [0.16, 0.16]
];

function Polyline({ points, color }: { points: [number, number][]; color: string }) {
  return (
    <group>
      {points.map(([x, y], i) => (
        <mesh key={`joint-${i}`} position={[x, y, 0]}>
          <sphereGeometry args={[STROKE_THICKNESS / 2, 12, 12]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
      {points.slice(0, -1).map(([x1, y1], i) => {
        const [x2, y2] = points[i + 1];
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        return (
          <mesh key={`seg-${i}`} position={[(x1 + x2) / 2, (y1 + y2) / 2, 0]} rotation={[0, 0, angle]}>
            <boxGeometry args={[length, STROKE_THICKNESS, STROKE_THICKNESS]} />
            <meshStandardMaterial color={color} />
          </mesh>
        );
      })}
    </group>
  );
}

function IconShape({ variant, color }: { variant: BurstVariant; color: string }) {
  if (variant === 'success') {
    return <Polyline points={CHECK_POINTS} color={color} />;
  }
  if (variant === 'fail') {
    return (
      <group>
        <Polyline points={CROSS_STROKE_A} color={color} />
        <Polyline points={CROSS_STROKE_B} color={color} />
      </group>
    );
  }
  // Neutral: a single horizontal dash.
  return (
    <mesh>
      <boxGeometry args={[0.32, STROKE_THICKNESS, STROKE_THICKNESS]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

export function BurstBadge({ variant, material, headline, detail, showIcon = true, cardColorOverride }: BurstBadgeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const startTimeRef = useRef<number | null>(null);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    if (startTimeRef.current === null) {
      startTimeRef.current = clock.getElapsedTime() * 1000;
    }
    const elapsedMs = clock.getElapsedTime() * 1000 - startTimeRef.current;
    group.scale.setScalar(getBadgeScale(elapsedMs));
    group.position.y = Math.sin(clock.getElapsedTime() * 1.1) * LEVITATE_AMPLITUDE;
  });

  const iconColor = getVariantColor(variant, material);
  const cardColor = cardColorOverride ?? material.cardColor;
  const textColor = cardColorOverride ? getContrastTextColor(cardColorOverride) : iconColor;
  // glowColor (not particleColor) when there's no card override: matches the
  // headline color instead of introducing a second, off-brand accent color
  // (particleColor read as an unwanted purple against clair's blue glowColor
  // headline). With an override, reuse the same contrast-safe color as the
  // headline for the same reason.
  const detailColor = cardColorOverride ? textColor : material.glowColor;

  return (
    <group ref={groupRef}>
      <FlatCardCamera />
      <mesh>
        {/* Same fill as ScorePill's frame (material.cardColor === this theme's
            --color-secondary) unless a caller overrides it with a semantic
            color, so the reveal card visually matches the rest of the UI. */}
        <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
        <meshStandardMaterial color={cardColor} metalness={material.metalness} roughness={material.roughness} />
      </mesh>
      {showIcon ? (
        <group position={[0, CARD_HEIGHT / 2 - 0.55, 0.02]}>
          <mesh>
            {/* Fixed neutral (not cardColor or sceneBackground): cardColor is
                light in clair and dark in every other theme, so a theme-derived
                backdrop couldn't read as a distinct disc in all four — this mid
                gray sits between light and dark cards by construction. Fully
                matte (not material.metalness/roughness): a metallic surface
                picks up the scene's directional light unevenly, so part of the
                circle ended up rendering as dark as the card behind it —
                matte reflects the ambient light evenly and stays one flat,
                distinct tone regardless of viewing/light angle. */}
            <circleGeometry args={[0.32, 32]} />
            <meshStandardMaterial color="#4A5568" metalness={0} roughness={1} />
          </mesh>
          <group position={[0, 0, 0.01]}>
            <IconShape variant={variant} color={iconColor} />
          </group>
        </group>
      ) : null}
      <Text
        key={`headline-${textColor}`}
        position={[0, 0.15, 0.02]}
        fontSize={0.26}
        maxWidth={CARD_WIDTH - 0.5}
        lineHeight={1.15}
        textAlign="center"
        color={textColor}
        anchorX="center"
        anchorY="middle"
        font={BOLD_FONT_URL}
        frustumCulled={false}
      >
        {headline}
      </Text>
      {detail ? (
        <Text
          key={`detail-${detailColor}`}
          position={[0, -0.85, 0.02]}
          fontSize={0.15}
          maxWidth={CARD_WIDTH - 0.6}
          lineHeight={1.2}
          textAlign="center"
          color={detailColor}
          anchorX="center"
          anchorY="middle"
          font={BOLD_FONT_URL}
          frustumCulled={false}
        >
          {detail}
        </Text>
      ) : null}
    </group>
  );
}
