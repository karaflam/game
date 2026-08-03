// troika-three-text@0.52.5 ships .d.ts files under dist/types/, but its package.json
// declares no "types" (or "exports") field, so TypeScript cannot resolve them and the
// module falls back to implicit `any`. Declare the single API surface we use directly.
// (Everything else in the package is consumed indirectly via @react-three/drei's <Text>,
// which brings its own typings.)
declare module 'troika-three-text' {
  export function preloadFont(
    options: { font?: string; characters?: string | string[]; sdfGlyphSize?: number },
    callback?: () => void
  ): void;
}
