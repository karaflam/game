# Animations 3D — Sous-projet 4 : Action ou Vérité (carte 3D) + 20 Questions / Tu Préfères / Deux Vérités Un Mensonge (badge 3D), solo + multijoueur

## Contexte

Correction par rapport à l'hypothèse initiale du sous-projet 1 : les 4 jeux "à texte" ne partagent pas tous le même composant de reveal. En lisant le code :

- **Action ou Vérité** (`TruthOrDareSolo.tsx`/`TruthOrDareMultiplayer.tsx`) utilise `FlipReveal` avec `cardSize="lg"` — une vraie carte qui se retourne pour révéler le prompt (action ou vérité).
- **20 Questions, Tu Préfères, Deux Vérités Un Mensonge** utilisent `BurstReveal` — une icône (`success`/`fail`/`neutral`, via `lucide-react`) qui apparaît avec un éclat de particules 2D, accompagnée d'un titre et d'un détail texte. Ce n'est pas une carte : c'est un badge de résultat (bonne/mauvaise réponse, ou choix neutre pour Tu Préfères).

Ce sous-projet couvre donc **deux scènes héros distinctes**, chacune remplaçant un composant de reveal existant, dans les deux modes (solo + multijoueur), soit 8 fichiers de jeu au total (4 jeux × 2 modes).

## Approche retenue

Réutilise sans modification les fondations du sous-projet 1 : `GameCanvas`, thèmes, `useAdaptiveQuality`, fallback 2D vers le composant existant (`FlipReveal` ou `BurstReveal` selon le jeu) quand `quality === 'fallback2d'`.

### Scène héros 1 — `CardFlipScene` (Action ou Vérité)

Une carte 3D unique (plan avec épaisseur, `RoundedBoxGeometry` fine) :
1. **Idle continu** : la carte flotte doucement, face "dos" visible (motif/logo du thème), tant qu'aucun round n'est en cours.
2. **Reveal** : rotation à 180° sur l'axe Y (comme `rotateY(180deg)` en CSS aujourd'hui), avec léger overshoot en fin de rotation pour un effet "carte posée avec un petit rebond".
3. **Face révélée** : le texte du prompt (action ou vérité) s'affiche en overlay 2D par-dessus la face avant de la carte 3D (le texte reste en DOM/HTML, pas en géométrie 3D, pour garder le rendu net et accessible à toutes les longueurs de texte) — même approche que le texte de résultat en overlay du sous-projet 1.
4. Fin → callback `onComplete`, même contrat que l'actuel `FlipReveal`.

### Scène héros 2 — `BadgeBurstScene` (20 Questions, Tu Préfères, Deux Vérités Un Mensonge)

Un badge/médaillon 3D (disque ou icône extrudée) qui remplace l'icône 2D de `BurstReveal` :
1. **Idle continu** : pas de badge visible, juste la scène d'ambiance (particules) derrière le contenu de jeu normal.
2. **Reveal** : le badge apparaît avec un effet de pop (scale-in avec overshoot, comme le `spring` Framer Motion actuel), coloré selon la variante (`success` → vert/couleur primaire du thème, `fail` → rouge/atténué, `neutral` → couleur neutre du thème) — matérialisé via `getThemeMaterial`, pas de nouvelles couleurs arbitraires.
3. **Particules d'éclat** : réutilisation du système de particules déjà construit (`ParticleField` du sous-projet 1) en mode "burst" ponctuel plutôt que dérive continue — un mode/paramètre supplémentaire à ajouter à `ParticleField` ou un petit composant frère dédié à l'éclat, à trancher pendant l'écriture du plan.
4. Le titre/détail texte reste en overlay 2D HTML par-dessus (comme aujourd'hui), seule l'icône devient un objet 3D.
5. Fin → callback `onComplete`, même contrat que l'actuel `BurstReveal`.

### Intégration

Chacun des 8 fichiers de jeu (`TruthOrDareSolo/Multiplayer`, `TwentyQuestionsSolo/Multiplayer`, `WouldYouRatherSolo/Multiplayer`, `TwoTruthsOneLieSolo/Multiplayer`) reçoit le même pattern de branchement sur `quality` déjà utilisé dans les sous-projets 1 et 2 : `fallback2d` → composant 2D existant inchangé ; sinon → nouvelle scène 3D correspondante.

## Dégradation automatique

Identique au sous-projet 1 : `GameCanvas` retourne `null` si `quality === 'fallback2d'`, et chaque jeu retombe sur son composant 2D existant sans aucune régression.

## Tests

- Aucune nouvelle logique de jeu touchée (les fichiers `lib/*Logic.ts` de chacun des 4 jeux restent inchangés).
- Logique pure testable si extraite : mapping variante (`success`/`fail`/`neutral`) → couleur/matériau, et la timeline de la carte flip (par analogie avec `duelTimeline.ts` du sous-projet 1).
- Rendu WebGL non testable en CI — vérification manuelle en navigateur pour les 8 combinaisons (4 jeux × 2 modes), dans les 4 thèmes, avant de considérer ce sous-projet terminé.

## Hors périmètre

Aucun — c'est le dernier des 4 sous-projets planifiés lors du brainstorming initial.
