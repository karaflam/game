import { BurstBadge, getVariantColor, type BurstVariant } from './BurstBadge';
import { BurstParticles } from './BurstParticles';
import type { ThemeMaterial } from '../themeMaterials';

type BadgeBurstSceneProps = {
  variant: BurstVariant;
  material: ThemeMaterial;
};

export function BadgeBurstScene({ variant, material }: BadgeBurstSceneProps) {
  const burstColor = getVariantColor(variant, material);

  return (
    <group>
      <BurstBadge variant={variant} material={material} />
      <BurstParticles color={burstColor} />
    </group>
  );
}
