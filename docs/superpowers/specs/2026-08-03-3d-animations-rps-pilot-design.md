# Animations 3D — Sous-projet 1 : Fondations + pilote Pierre-Feuille-Ciseaux (solo)

## Contexte

L'app propose 6 party games (Pierre-Feuille-Ciseaux, Pair ou Impair, Action ou Vérité, 20 Questions, Deux Vérités Un Mensonge, Tu Préfères) en solo et multijoueur, avec 4 thèmes visuels (`clair`, `sombre`, `luxueux`, `romantique` — voir `frontend/src/hooks/useTheme.ts` et `frontend/src/index.css`). Les animations actuelles sont en 2D (Framer Motion), via des composants de reveal partagés (`components/solo/reveals/*`).

Objectif global (décomposé en 4 sous-projets successifs) : ajouter de la vraie 3D (WebGL, style gaming) à tous les jeux, avec une scène 3D continue (pas seulement au moment du résultat), un rendu qui épouse les 4 thèmes existants, et une dégradation automatique sur appareils bas de gamme.

**Ce spec ne couvre que le sous-projet 1** : poser les fondations 3D réutilisables et les valider sur un seul jeu pilote — Pierre-Feuille-Ciseaux en mode solo. Les sous-projets suivants (PFC multijoueur ; Pair ou Impair solo+multi avec dé physique ; jeux à cartes solo+multi) auront chacun leur propre spec, en réutilisant les fondations posées ici.

## Approche retenue

Stack : `@react-three/fiber` + `@react-three/drei` + `@react-three/postprocessing` (bloom/glow). Pas de moteur physique dans ce sous-projet (`@react-three/rapier` arrivera au sous-projet 3 pour le dé).

Le layer 3D est strictement présentationnel : aucune logique de jeu (`lib/rpsLogic.ts`, `useSoloScore`) n'est modifiée. La scène 3D lit l'état existant (`round`, `ThemeId`) et déclenche ses propres animations ; en cas de souci de performance elle se désactive et le rendu retombe sur le `DuelReveal` Framer Motion déjà en prod — aucune régression fonctionnelle possible.

## Architecture

Nouveau dossier `frontend/src/three/` :

- **`GameCanvas.tsx`** — wrapper `<Canvas>` réutilisable pour tous les jeux (pas seulement PFC). Props : `theme: ThemeId`, `quality: Quality`. Monte l'éclairage (ambiante + spot directionnel selon le thème), un léger brouillard de fond, et le `ParticleField` ambiant. Les jeux futurs y monteront leur propre scène "héros" en `children`.
- **`themeMaterials.ts`** — fonction pure `getThemeMaterial(themeId: ThemeId): ThemeMaterial` avec `{ baseColor, emissive, metalness, roughness, glowColor, particleColor }`, une entrée codée en dur par thème, dérivée des couleurs déjà définies dans `index.css` (ex. `sombre` → cyan `#22D3EE` + violet `#A855F7`, glow fort ; `luxueux` → or `#FBBF24`, métal poli ; `romantique` → rose `#F43F5E`/`#F472B4`, glow doux ; `clair` → bleu `#2563EB`/violet `#7C3AED`, reflets nets).
- **`useAdaptiveQuality.ts`** — hook qui échantillonne le framerate réel (`requestAnimationFrame`) pendant ~2s au montage puis en continu par fenêtres glissantes, et retourne `quality: 'high' | 'medium' | 'low' | 'fallback2d'`. Seuils : FPS moyen < 45 → `medium` (coupe le bloom, réduit les particules) ; < 30 → `low` (particules minimales, pas de post-processing) ; < 20 → `fallback2d` (démonte le Canvas, le jeu se comporte comme aujourd'hui).
- **`ambient/ParticleField.tsx`** — fond continu de particules lumineuses dérivant lentement, densité pilotée par `quality`, couleur par `themeMaterials`. C'est la "scène 3D en continu" visible pendant toute la partie, pas seulement au reveal.
- **`scenes/HandDuelScene.tsx`** — scène héros spécifique à PFC : deux mains low-poly stylisées (poing / paume / ciseaux).

## Composant héros : `HandDuelScene`

Représentation : vraies mains 3D low-poly (pas des icônes extrudées), une pose par mouvement (`pierre`/`feuille`/`ciseau`), matériau/glow selon `themeMaterials`.

Choréographie, pilotée par le même `round: RoundData | null` que `RpsSolo.tsx` utilise déjà :

1. **Idle continu** : les deux mains flottent doucement en poing neutre de part et d'autre de la scène, tant qu'aucun round n'est en cours (c'est la partie "3D continue").
2. **Compte à rebours** : au lancement d'un round, 3 pulsations de lumière synchronisées (style "3-2-1"), mains toujours neutres.
3. **Reveal** : chaque main pivote vers sa pose finale en ~250ms avec léger overshoot (spring), puis avance vers l'autre jusqu'à quasi-contact.
4. **Résultat** : la main perdante recule et s'assombrit (émissivité réduite) ; la gagnante pulse en glow (`--color-primary` du thème actif) avec de courtes micro-particules en cas de victoire nette ; égalité → pulse symétrique des deux mains.
5. Fin d'animation → callback `onComplete`, avec le même contrat que l'actuel `DuelReveal` (le texte de résultat 2D s'affiche par-dessus, inchangé).

## Intégration dans `RpsSolo.tsx`

- `RpsSolo` lit le `ThemeId` courant via le hook `useTheme()` existant et le passe à `<GameCanvas theme={theme} quality={quality}>`, monté en fond de la carte de jeu (derrière les boutons de choix, qui restent en 2D/HTML).
- `quality` vient de `useAdaptiveQuality()`, appelé une fois au niveau de `RpsSolo` (réutilisable tel quel par les futurs jeux).
- Quand `quality === 'fallback2d'`, `GameCanvas` ne rend rien (ou un fond statique léger) et `RpsSolo` continue d'afficher `DuelReveal` comme avant. Sinon, `HandDuelScene` remplace `DuelReveal` pour le moment du clash ; le texte de résultat reste géré par `RpsSolo`/`DuelReveal` logic existante.

## Tests

- `themeMaterials.ts` : test unitaire (Vitest) — une entrée par `ThemeId`, valeurs cohérentes (couleurs valides, pas de `undefined`).
- `useAdaptiveQuality.ts` : test unitaire avec `requestAnimationFrame`/`performance.now` mockés — vérifie les transitions de palier (high→medium→low→fallback2d) selon des framerates simulés.
- Le rendu WebGL n'est pas testable en CI. Vérification manuelle obligatoire dans le navigateur (page PFC solo, dans chacun des 4 thèmes) avant de considérer ce sous-projet terminé.

## Hors périmètre (sous-projets suivants)

- PFC en mode multijoueur (sous-projet 2).
- Pair ou Impair : dé 3D avec physique réelle via `@react-three/rapier` (sous-projet 3).
- Scène de carte 3D (flip) pour Action ou Vérité, 20 Questions, Tu Préfères, Deux Vérités Un Mensonge, solo + multijoueur (sous-projet 4).
