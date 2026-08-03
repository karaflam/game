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
};

const THEME_MATERIALS: Record<ThemeId, ThemeMaterial> = {
  clair: {
    baseColor: '#B7C4E8',
    emissive: '#2563EB',
    metalness: 0.15,
    roughness: 0.35,
    glowColor: '#2563EB',
    particleColor: '#7C3AED',
    sceneBackground: '#F0F2F7'
  },
  sombre: {
    baseColor: '#0F1629',
    emissive: '#22D3EE',
    metalness: 0.4,
    roughness: 0.25,
    glowColor: '#22D3EE',
    particleColor: '#A855F7',
    sceneBackground: '#030712'
  },
  luxueux: {
    baseColor: '#1A1200',
    emissive: '#FBBF24',
    metalness: 0.75,
    roughness: 0.2,
    glowColor: '#FBBF24',
    particleColor: '#FDE047',
    sceneBackground: '#0A0800'
  },
  romantique: {
    baseColor: '#2D1020',
    emissive: '#F43F5E',
    metalness: 0.3,
    roughness: 0.4,
    glowColor: '#F43F5E',
    particleColor: '#F472B4',
    sceneBackground: '#1A0A14'
  }
};

export function getThemeMaterial(theme: ThemeId): ThemeMaterial {
  return THEME_MATERIALS[theme];
}
