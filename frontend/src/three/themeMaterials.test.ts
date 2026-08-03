import { describe, expect, it } from 'vitest';
import { getThemeMaterial } from './themeMaterials';

const THEMES = ['clair', 'sombre', 'luxueux', 'romantique'] as const;

describe('getThemeMaterial', () => {
  it.each(THEMES)('returns a complete material config for %s', theme => {
    const material = getThemeMaterial(theme);
    expect(material.baseColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(material.emissive).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(material.glowColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(material.particleColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(material.sceneBackground).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(material.metalness).toBeGreaterThanOrEqual(0);
    expect(material.metalness).toBeLessThanOrEqual(1);
    expect(material.roughness).toBeGreaterThanOrEqual(0);
    expect(material.roughness).toBeLessThanOrEqual(1);
  });

  it('gives each theme a distinct glow color', () => {
    const glowColors = THEMES.map(theme => getThemeMaterial(theme).glowColor);
    expect(new Set(glowColors).size).toBe(THEMES.length);
  });
});
