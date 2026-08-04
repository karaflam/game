import type { ThemeId } from '@/hooks/useTheme';

export type ThemeMaterial = {
  baseColor: string;
  emissive: string;
  metalness: number;
  roughness: number;
  glowColor: string;
  particleColor: string;
  /** Canvas background/fog color — kept separate from baseColor so the mesh
   * itself never blends into its own backdrop (an issue on the light theme,
   * where the page background is nearly white). */
  sceneBackground: string;
  /** Optional override for the number drum's face color specifically —
   * falls back to baseColor when unset. Only defined for themes where
   * baseColor turned out too close to sceneBackground for the drum. */
  drumBaseColor?: string;
  /** Same hex as this theme's `--color-secondary` CSS variable (index.css) —
   * the fill ScorePill's frame uses. Kept in sync manually since the 3D
   * scenes can't read CSS custom properties directly. */
  cardColor: string;
};

const THEME_MATERIALS: Record<ThemeId, ThemeMaterial> = {
  clair: {
    baseColor: '#B7C4E8',
    emissive: '#2563EB',
    metalness: 0.15,
    roughness: 0.35,
    glowColor: '#2563EB',
    particleColor: '#7C3AED',
    sceneBackground: '#F0F2F7',
    // Lighter than ScorePill's actual --color-secondary (#E2E8F0) on purpose —
    // reveal cards (BurstBadge/CardFlipScene, the only readers of this field)
    // read better a shade brighter in clair specifically. sombre/luxueux/
    // romantique's cardColor still mirrors their --color-secondary exactly.
    cardColor: '#FAFBFD'
  },
  sombre: {
    baseColor: '#0F1629',
    emissive: '#22D3EE',
    metalness: 0.4,
    roughness: 0.25,
    glowColor: '#22D3EE',
    particleColor: '#A855F7',
    sceneBackground: '#030712',
    // #0F1629 (baseColor) sits close enough to #030712 (sceneBackground) in
    // luminance that the number drum's card faces blended into the canvas
    // background. Only the drum reads this — RPS hands, cards, and badges
    // still use baseColor and are unaffected.
    drumBaseColor: '#1E2A4A',
    cardColor: '#1E2A45'
  },
  luxueux: {
    baseColor: '#1A1200',
    emissive: '#FBBF24',
    metalness: 0.75,
    roughness: 0.2,
    glowColor: '#FBBF24',
    particleColor: '#FDE047',
    sceneBackground: '#0A0800',
    // Same issue as sombre: baseColor was nearly indistinguishable from
    // sceneBackground for the drum's faces specifically.
    drumBaseColor: '#3A2A08',
    cardColor: '#261A00'
  },
  romantique: {
    baseColor: '#2D1020',
    emissive: '#F43F5E',
    metalness: 0.3,
    roughness: 0.4,
    glowColor: '#F43F5E',
    particleColor: '#F472B4',
    sceneBackground: '#1A0A14',
    cardColor: '#3D1530'
  }
};

export function getThemeMaterial(theme: ThemeId): ThemeMaterial {
  return THEME_MATERIALS[theme];
}
