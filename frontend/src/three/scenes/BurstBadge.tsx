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

function IconShape({ variant, color }: { variant: BurstVariant; color: string }) {
  if (variant === 'success') {
    // Checkmark: two short bars meeting at an angle.
    return (
      <group>
        <mesh position={[-0.08, -0.05, 0]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.22, 0.08, 0.08]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <mesh position={[0.06, 0.05, 0]} rotation={[0, 0, -Math.PI / 4]}>
          <boxGeometry args={[0.34, 0.08, 0.08]} />
          <meshStandardMaterial color={color} />
        </mesh>
      </group>
    );
  }
  if (variant === 'fail') {
    // X: two crossed bars.
    return (
      <group>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.4, 0.08, 0.08]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <mesh rotation={[0, 0, -Math.PI / 4]}>
          <boxGeometry args={[0.4, 0.08, 0.08]} />
          <meshStandardMaterial color={color} />
        </mesh>
      </group>
    );
  }
  // Neutral: a single horizontal dash.
  return (
    <mesh>
      <boxGeometry args={[0.32, 0.08, 0.08]} />
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
  // particleColor (not a fixed gray) when there's no card override: cardColor
  // is light in clair and dark in every other theme, so a fixed muted tone
  // tuned for a dark card would go low-contrast the moment the card itself is
  // light. With an override, reuse the same contrast-safe color as the
  // headline for consistency.
  const detailColor = cardColorOverride ? textColor : material.particleColor;

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
                gray sits between light and dark cards by construction. */}
            <circleGeometry args={[0.32, 32]} />
            <meshStandardMaterial color="#3A4152" metalness={material.metalness} roughness={material.roughness} />
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
