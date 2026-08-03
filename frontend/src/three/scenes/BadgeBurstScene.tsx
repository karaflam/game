import { BurstBadge, type BurstVariant } from './BurstBadge';
import { BurstParticles } from './BurstParticles';
import type { ThemeMaterial } from '../themeMaterials';

type BadgeBurstSceneProps = {
  variant: BurstVariant;
  material: ThemeMaterial;
};

export function BadgeBurstScene({ variant, material }: BadgeBurstSceneProps) {
  const burstColor = variant === 'success' ? material.glowColor : variant === 'fail' ? '#7a2b2b' : material.particleColor;

  return (
    <group>
      <BurstBadge variant={variant} material={material} />
      <BurstParticles color={burstColor} />
    </group>
  );
}
