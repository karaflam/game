# Animations 3D — Sous-projet 2 : Pierre-Feuille-Ciseaux multijoueur

## Contexte

Le sous-projet 1 (voir `docs/superpowers/specs/2026-08-03-3d-animations-rps-pilot-design.md` et son implémentation) a livré les fondations 3D réutilisables (`GameCanvas`, `HandDuelScene`, `LowPolyHand`, `useAdaptiveQuality`, `getThemeMaterial`) et les a validées sur Pierre-Feuille-Ciseaux en solo. Ce sous-projet applique exactement la même scène 3D à la version multijoueur du même jeu (`frontend/src/games/multiplayer/RpsMultiplayer.tsx`), qui aujourd'hui affiche encore le `DuelReveal` 2D existant.

`RpsMultiplayer.tsx` est structurellement très proche de `RpsSolo.tsx` : même composant `ScorePill`/`MatchEndOverlay`/`DuelReveal`, mais la donnée du round vient du serveur via Socket.IO (`ServerEvents.RpsResult` → `{ yourMove, opponentMove, outcome, scores, matchOver, winnerId }`) plutôt que d'un tirage aléatoire local. Le composant définit aussi son propre type `RpsMove` local (`['pierre','feuille','ciseau']`), structurellement identique à celui de `frontend/src/lib/rpsLogic.ts` utilisé par `HandDuelScene`.

Une différence de flux existe : le multijoueur a un état `waiting` (en attente du coup de l'adversaire) qui n'a pas d'équivalent en solo, où le round démarre dès que le joueur clique.

## Approche retenue

Aucune nouvelle fondation 3D n'est nécessaire. Ce sous-projet est une intégration : reproduire dans `RpsMultiplayer.tsx` exactement le pattern déjà en place dans `RpsSolo.tsx` (voir `docs/superpowers/plans/2026-08-03-3d-animations-rps-pilot.md`, Task 12, comme référence directe pour la structure du diff) :

- `useTheme()` et `useAdaptiveQuality()` pour obtenir `theme`/`quality`.
- Le bloc de reveal se branche sur `quality` : `fallback2d` → `DuelReveal` inchangé (comportement actuel, zéro régression) ; sinon → `GameCanvas` + `HandDuelScene`, alimentée par `{ player: round.yourMove, machine: round.opponentMove, outcome: round.outcome }` (le type `RpsMove` local du fichier est structurellement identique à celui de `@/lib/rpsLogic`, donc compatible sans conversion).
- Le texte de résultat (`solo.rps.duelOutcomeWin/Lose/Draw` — mêmes clés i18n déjà utilisées par `DuelReveal`) s'affiche en overlay 2D par-dessus le canvas, comme en solo.

**Différence avec le solo — scène d'ambiance pendant l'attente :** la scène 3D continue (mains flottantes + particules) doit rester visible non seulement quand `!round`, mais aussi pendant `waiting` (`!round` est déjà vrai pendant l'attente dans le code actuel — `waiting` et `round` ne se chevauchent pas — donc la condition `!round && quality !== 'fallback2d'` de la version solo fonctionne ici sans modification supplémentaire).

## Composant héros

Identique à `HandDuelScene` du sous-projet 1, sans modification. Aucune nouvelle tâche de choréographie n'est nécessaire.

## Tests

- Aucune nouvelle logique pure à tester : ce sous-projet ne touche à aucun fichier de `frontend/src/three/`, seulement à l'intégration dans `RpsMultiplayer.tsx`.
- Le fichier `frontend/src/games/multiplayer/RpsMultiplayer.tsx` n'a pas de test unitaire dédié aujourd'hui (logique socket testée manuellement) — cela reste inchangé ; la vérification se fait par lecture attentive du diff (le flux socket/score n'est pas touché) et par test manuel en navigateur avec deux sessions (un onglet par joueur), dans chacun des 4 thèmes.

## Hors périmètre

- Pair ou Impair (sous-projet 3).
- Jeux à cartes (sous-projet 4).
