import { BurstBadge, type BurstVariant } from './BurstBadge';
import type { ThemeMaterial } from '../themeMaterials';

type BadgeBurstSceneProps = {
  variant: BurstVariant;
  material: ThemeMaterial;
  headline: string;
  detail?: string;
  showIcon?: boolean;
  cardColorOverride?: string;
};

export function BadgeBurstScene({ variant, material, headline, detail, showIcon, cardColorOverride }: BadgeBurstSceneProps) {
  return (
    <group>
      <BurstBadge
        variant={variant}
        material={material}
        headline={headline}
        detail={detail}
        showIcon={showIcon}
        cardColorOverride={cardColorOverride}
      />
    </group>
  );
}
