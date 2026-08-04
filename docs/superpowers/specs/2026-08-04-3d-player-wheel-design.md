# 3D Player Wheel Design

**Status:** Approved (brainstorming complete, ready for implementation planning)

## Goal

Replace the flat 2D SVG `PlayerWheel` (`frontend/src/components/solo/PlayerWheel.tsx`) — used in both `TruthOrDareSolo.tsx` and `TruthOrDareMultiplayer.tsx` to pick which player's turn it is — with a realistic, procedurally-built 3D wheel, following the same foundations (`GameCanvas`, `getThemeMaterial`, `useAdaptiveQuality`) established by the earlier 3D sub-projects (RPS hand duel, Odd or Even number carousel, card flip / badge burst reveals).

## Why procedural, not a pre-made 3D asset

The wheel needs a dynamic number of wedges with live text (player names) — the wedge count changes with player count, and multiplayer sessions can have any number of players. A pre-made Sketchfab-style wheel model bakes its wedges into one fixed, textured mesh; it can't relabel or reslice itself at runtime the way the current SVG wheel does. So the wheel is built entirely in Three.js/React Three Fiber, styled to *look* like a real physical prize wheel, rather than sourced as a static asset (unlike the RPS hand poses, which were fixed poses with no dynamic content and could be swapped whole).

## Scope

- Both call sites (`TruthOrDareSolo.tsx`, `TruthOrDareMultiplayer.tsx`) share one `PlayerWheel`-equivalent component today and will continue to after this change — no per-mode divergence.
- Only the *turn-picker* wheel is in scope. Truth/Dare category selection is a separate checkbox UI (`TRUTH_OR_DARE_CATEGORIES`, unaffected) and is not a wheel.
- The existing SVG `PlayerWheel` is not deleted — it becomes the `quality === 'fallback2d'` path.

## Architecture

New files under `frontend/src/three/scenes/`, following the established pattern:

- **`wheelTimeline.ts`** — pure spin-physics functions: given a target wedge and the current player list, compute the wheel's rotation angle over elapsed time (several full rotations plus a precise landing offset under the fixed top pointer), eased out to a stop. Mirrors the shape of `carouselTimeline.ts`/the old `rollTimeline.ts`: `SPIN_DURATION_MS` (matching the current `SPIN_DURATION_S = 2.8s` so `onSpinComplete` timing is unchanged for callers), `getWheelRotation(elapsedMs, targetIndex, wedgeCount): number`, `isSpinSettled(elapsedMs): boolean`. Tested with Vitest — same shape as `carouselTimeline.test.ts`.
- **`PlayerWheelScene.tsx`** — the 3D scene. Takes the same props the current `PlayerWheel` takes (`players: string[]`, `landedOn: string`, `spinning: boolean`, `onSpinComplete: () => void`) plus `material: ThemeMaterial`, so it's a drop-in replacement for the 3D-capable path. No automated test (WebGL) — manually verified, consistent with every other 3D scene in this app.
- **`frontend/src/components/solo/PlayerWheel.tsx`** (existing SVG version) is untouched and becomes the `quality === 'fallback2d'` branch. Each call site (`TruthOrDareSolo.tsx`, `TruthOrDareMultiplayer.tsx`) branches inline on `quality === 'fallback2d'` between the SVG `PlayerWheel` and the lazy-loaded `PlayerWheelScene` inside `GameCanvas` — no new wrapper component — matching exactly how every other 3D scene's fallback is wired today (e.g. Odd or Even's `NumberDrum`/`OddOrEvenDuelScene` call sites).

## Wedge geometry & text

Each wedge is an extruded pie-slice (`THREE.ExtrudeGeometry` built from a 2D pie-shaped `THREE.Shape`), giving the wheel real thickness and a beveled top edge — not a flat plane, unlike the old SVG's flat wedges. Player-name text is rendered with `drei`'s `Text` component mounted directly on each wedge's face, rotating and tilting as part of the wedge itself.

This deliberately differs from the card-flip/badge-burst sub-project's rule of avoiding `drei` `Text` (which was about simple, non-rotating flat content where a 2D HTML overlay was strictly simpler). Here, the wheel spins continuously and the camera views it at a tilt — text needs to be genuinely part of the 3D geometry to stay correctly positioned and oriented through the spin, rather than an HTML overlay trying to track a rotating, perspective-projected position. This mirrors the Odd or Even number carousel, where `drei` `Text` mounted on rotating/tilting 3D cards was proven robust this session (unlit `meshBasicMaterial` so text never blacks out at a grazing lighting angle, and the `Text` component keyed on its rendered color so a live theme switch forces a clean remount instead of leaving the SDF glyph render stuck blank).

## Materials, colors, and lighting

Rim, hub, and pointer geometry use `getThemeMaterial(theme)` — the same `baseColor`/`metalness`/`roughness`/`glowColor`/`particleColor` fields already driving every other 3D scene. The chosen visual style ("sleek modern metallic": thin brushed-metal rim, minimal hub, no decorative light-bulb ring) is achieved via material properties (high metalness, low roughness on the rim) rather than any wheel-specific styling logic, so it automatically reads differently per theme without new per-theme code — e.g. cooler/darker in sombre, warmer gold-tinted in luxueux — the same way every other themed 3D scene in this app already works.

Wedge fill colors reuse the same rotating theme-color palette the current SVG wheel cycles through (`WEDGE_COLORS` equivalent), rendered as real lit materials instead of flat SVG fills.

## Camera

The wheel is viewed from a ~35° tilted angle (not straight overhead) so its thickness, the rim's bevel, and material shading are actually visible — a flat top-down view would look "almost 2D" despite real 3D geometry underneath, the same lesson learned from the Odd or Even carousel needing a coverflow tilt to read as genuinely 3D. This tilt is scene-local (applied only for `PlayerWheelScene`, e.g. by parameterizing camera position/rotation for this scene the way `GameCanvas`'s `ResponsiveCamera` already scopes its FOV correction to specific container aspects) — it does not change the global default camera used by other scenes.

The fixed pointer stays anchored at the top of the frame regardless of wheel rotation, matching the current SVG wheel's behavior (the wheel spins under a stationary pointer, not the other way around).

## Animation

Spin duration and easing character match the current SVG wheel (`SPIN_DURATION_S = 2.8`, several full rotations before landing with a deceleration curve) so `onSpinComplete` timing and the calling components' `phase` state machines (`spinning` → `landed`) need no changes. `wheelTimeline.ts`'s `getWheelRotation` is the 3D equivalent of the SVG version's `targetRotation` calculation (`MIN_FULL_TURNS * 360 + landing offset + jitter`), reusing the same jitter-within-wedge idea so the wheel never looks suspiciously dead-center or ambiguously close to a wedge boundary.

## Sizing and layout

Unlike the current wheel's small fixed 240×240px box, the 3D scene sits in a `GameCanvas` container sized and given the same mobile edge-to-edge bleed treatment (`-mx-4 w-[calc(100%+2rem)] ... sm:mx-0 sm:w-full`) already applied to RPS's and Odd or Even's reveal containers this session — consistent with every other 3D reveal scene's mobile-width handling, rather than staying a small inline box.

## Fallback

`quality === 'fallback2d'` renders the existing SVG `PlayerWheel` component completely unchanged — same props, same visuals, same behavior as today. Every other quality tier renders `PlayerWheelScene` inside `GameCanvas`, lazy-loaded via the same `lazy()`/`Suspense` pattern used everywhere else in this app.

## Testing

- `wheelTimeline.ts`: Vitest coverage for `getWheelRotation` (starts at 0, lands on the exact target wedge angle once settled, monotonic progress, stays in bounds) and `isSpinSettled`, following the same test shape as `carouselTimeline.test.ts`.
- `PlayerWheelScene.tsx`: WebGL component, no automated test — manually verified (both solo's single-player spin and multiplayer's multi-player spin, across at least 2 themes, plus a CPU-throttled fallback check) in the final implementation task, consistent with every other 3D scene in this app.
