import type { ThemeId } from '@/hooks/useTheme';

export type ThemeMaterial = {
  baseColor: string;
  emissive: string;
  metalness: number;
  roughness: number;
  glowColor: string;
  particleColor: string;
};

const THEME_MATERIALS: Record<ThemeId, ThemeMaterial> = {
  clair: {
    baseColor: '#FFFFFF',
    emissive: '#2563EB',
    metalness: 0.15,
    roughness: 0.35,
    glowColor: '#2563EB',
    particleColor: '#7C3AED'
  },
  sombre: {
    baseColor: '#0F1629',
    emissive: '#22D3EE',
    metalness: 0.4,
    roughness: 0.25,
    glowColor: '#22D3EE',
    particleColor: '#A855F7'
  },
  luxueux: {
    baseColor: '#1A1200',
    emissive: '#FBBF24',
    metalness: 0.75,
    roughness: 0.2,
    glowColor: '#FBBF24',
    particleColor: '#FDE047'
  },
  romantique: {
    baseColor: '#2D1020',
    emissive: '#F43F5E',
    metalness: 0.3,
    roughness: 0.4,
    glowColor: '#F43F5E',
    particleColor: '#F472B4'
  }
};

export function getThemeMaterial(theme: ThemeId): ThemeMaterial {
  return THEME_MATERIALS[theme];
}
