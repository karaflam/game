# Animations 3D — Sous-projet 3 : Pair ou Impair (dé 3D, solo + multijoueur)

## Contexte

Pair ou Impair (`OddOrEvenSolo.tsx` / `OddOrEvenMultiplayer.tsx`) fonctionne ainsi : le joueur choisit un nombre fixe entre 1 et 9 via `NumberTokenPicker` et une prédiction pair/impair ; la machine (ou l'adversaire, en multi) tire un nombre entre 1 et 9 (`pickRandomNumber`, voir `frontend/src/lib/oddOrEvenLogic.ts`) ; la parité de la somme détermine le gagnant. Le reveal actuel réutilise `FlipReveal` (le même composant que Pierre-Feuille-Ciseaux utilisait avant le sous-projet 1) : deux petites cartes qui se retournent pour révéler `playerNumber` et `machineNumber`.

Point important qui distingue ce jeu d'un vrai lancer de dé : **le nombre du joueur n'est pas aléatoire** — il est choisi à l'avance via les jetons numérotés. Seul le nombre de l'adversaire/machine est réellement tiré au hasard. Un dé physique classique (6 faces) ne représente pas non plus fidèlement une plage 1-9. La scène 3D doit donc traiter les deux "dés" différemment : celui du joueur affiche directement le nombre déjà choisi (pas de suspense à simuler), celui de l'adversaire/machine effectue un vrai lancer physique avant de s'arrêter sur son nombre.

## Approche retenue

Réutilise les fondations du sous-projet 1 (`GameCanvas`, thèmes, `useAdaptiveQuality`, fallback 2D) et ajoute une nouvelle brique : `@react-three/rapier` (moteur physique, compatible React 18 comme les autres paquets `@react-three/*` déjà installés — vérifier la même contrainte de version que dans le sous-projet 1) pour un vrai lancer avec rebond/rotation.

**Représentation du nombre :** plutôt qu'un cube à 6 faces numérotées de force jusqu'à 9 (anatomiquement faux), le "dé" est un cube stylisé qui roule/rebondit physiquement (spectacle du lancer, faces neutres ou à motif du thème), et le nombre réel s'affiche comme un chiffre 3D flottant qui apparaît juste après que le dé a fini de rebondir et de s'immobiliser — un peu comme un résultat de machine à sous. Ça découple l'aspect "lancer physique crédible" de la contrainte numérique 1-9, sans mentir visuellement sur un dé à 9 faces qui n'existe pas dans la réalité.

**Composants nouveaux (`frontend/src/three/scenes/`) :**
- `DiceScene.tsx` — scène héros : un `<Physics>` (rapier) contenant un `RigidBody` cube pour le dé de l'adversaire/machine (lancé avec une impulsion + rotation aléatoires au début du round, immobilisé naturellement par la physique), et un cube statique (pas de `RigidBody` dynamique, ou un `RigidBody` de type `fixed`) pour le nombre déjà choisi du joueur, qui fait juste une courte animation de pop/rotation d'arrivée (pas un vrai lancer).
- Un petit composant de texte 3D (`@react-three/drei`'s `Text` ou équivalent) pour afficher le chiffre au-dessus de chaque dé une fois celui-ci immobile — détection d'immobilité via la vélocité angulaire/linéaire du `RigidBody` (rapier expose ces valeurs), pas un minuteur fixe, pour rester crédible quel que soit le rebond réel.
- Réutilisation directe de `getThemeMaterial`/`GameCanvas`/`useAdaptiveQuality` sans modification.

**Solo et multijoueur en parallèle** (comme demandé lors du brainstorming initial) : `OddOrEvenSolo.tsx` et `OddOrEvenMultiplayer.tsx` reçoivent la même intégration, chacun avec sa propre source de données de round (locale vs socket), suivant le même pattern de branchement sur `quality` que Pierre-Feuille-Ciseaux (`fallback2d` → `FlipReveal` existant inchangé ; sinon → nouvelle scène 3D).

## Composant héros : `DiceScene`

Choréographie, déclenchée par le round (`{ playerNumber, machineNumber, outcome }`) :

1. **Idle continu** : les deux dés flottent doucement (mêmes particules d'ambiance que Pierre-Feuille-Ciseaux), faces neutres, pas de nombre affiché.
2. **Lancer** : au démarrage d'un round, le dé de l'adversaire/machine reçoit une impulsion physique (force + couple aléatoires) et rebondit sur un sol invisible (`RigidBody` fixe) pendant ~0.8-1.2s ; le dé du joueur fait une rotation de pop courte (~300ms) vers sa position de repos.
3. **Résultat** : dès que la vélocité du dé de l'adversaire/machine repasse sous un seuil (immobile), le chiffre correspondant apparaît en 3D au-dessus de chaque dé (`playerNumber` déjà connu affiché immédiatement, `machineNumber` affiché au moment de l'arrêt réel du lancer) ; la somme et sa parité s'affichent en overlay texte 2D par-dessus, comme le fait `FlipReveal.outcomeLabel` aujourd'hui.
4. Fin → callback `onComplete`, même contrat que l'actuel `FlipReveal`.

## Dégradation automatique

Si `quality === 'fallback2d'`, la scène physique ne se monte jamais (même garde que dans `GameCanvas`) et le jeu retombe sur `FlipReveal` — aucune régression possible. Le calcul physique (rapier) est plus coûteux qu'une simple rotation de main ; à `quality === 'low'`, envisager de désactiver le rebond réaliste (position finale calculée directement, sans simulation physique) plutôt que de réduire seulement les particules — à trancher pendant l'écriture du plan d'implémentation détaillé.

## Tests

- Logique pure testable : la fonction de détection "dé immobile" (seuil de vélocité) et le mapping nombre→position/rotation d'arrivée peuvent être extraits en fonctions pures et testées en Vitest, comme les modules `qualityTracker.ts`/`duelTimeline.ts` du sous-projet 1.
- Le rendu physique/WebGL lui-même n'est pas testable en CI — vérification manuelle en navigateur dans les 4 thèmes, en solo et en multijoueur (deux onglets), avant de considérer ce sous-projet terminé.

## Hors périmètre

- Jeux à cartes (sous-projet 4).
