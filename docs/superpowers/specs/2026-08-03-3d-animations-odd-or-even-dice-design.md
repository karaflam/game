# Animations 3D — Sous-projet 3 : Pair ou Impair (tambour 3D, solo + multijoueur)

## Contexte

Pair ou Impair (`OddOrEvenSolo.tsx` / `OddOrEvenMultiplayer.tsx`) fonctionne ainsi : le joueur choisit un nombre fixe entre 1 et 9 via `NumberTokenPicker` (une grille de bulles de chiffres) et une prédiction pair/impair ; la machine (ou l'adversaire, en multi) tire un nombre entre 1 et 9 (`pickRandomNumber`, voir `frontend/src/lib/oddOrEvenLogic.ts`) ; la parité de la somme détermine le gagnant. Le reveal actuel réutilise `FlipReveal`.

**Ce spec a été révisé après une session de maquettage visuel avec l'utilisateur** (voir historique de conversation) : contrairement au sous-projet 1 où seul le *reveal* passe en 3D, ici la **sélection du nombre elle-même** passe en 3D — les bulles de `NumberTokenPicker` ont été jugées inadéquates (trop petites, peu attrayantes sur mobile). Une comparaison de deux directions (tambour qu'on fait glisser vs dé à 12 facettes avec 3 facettes inutilisées) a été tranchée en faveur du **tambour/rouleau** : pas de contrainte géométrique arbitraire (9 nombres réels, pas 12), grandes cibles tactiles, geste de glissement naturel sur mobile.

Autre point validé : le nombre de l'adversaire/machine ne doit **jamais** être visible avant le duel — le tambour adverse affiche des faces masquées (`?`, pas de chiffre du tout, pour éviter toute confusion) tant que le round n'a pas démarré, puis roule visiblement (rotation animée, pas un pop instantané) avant de s'arrêter sur son vrai chiffre au moment du reveal.

## Approche retenue

Réutilise les fondations du sous-projet 1 (`GameCanvas`, thèmes via `getThemeMaterial`, `useAdaptiveQuality`, fallback 2D). **Pas besoin de `@react-three/rapier`/physique** : contrairement à l'idée initiale d'un lancer physique, le tambour est un cylindre à rotation contrôlée (comme `HandDuelScene` pilote ses propres animations via `useFrame`, pas une simulation physique) — plus simple, plus prévisible, et suffisant pour l'effet recherché (glisser pour choisir, puis rotation animée qui s'arrête sur un chiffre précis).

**Layout de la scène (les deux tambours + le duel) :**
- Un tambour "Toi" à gauche (9 faces, une par nombre 1-9, texte toujours visible — c'est ton propre choix).
- Un symbole "+" 3D flottant au centre, animation idle continue (léger flottement + rotation lente), séparant visuellement les deux tambours.
- Un tambour "Adversaire" à droite : faces masquées (`?`, thème sombre/atténué) tant qu'aucun round n'est en cours ou que l'adversaire n'a pas encore joué ; au moment du reveal, les faces sont remplacées par les vrais chiffres puis le tambour tourne (plusieurs tours animés, easing style `easeOutBack`/décélération) avant de s'immobiliser sur le chiffre tiré.
- Après l'arrêt : une plaque 3D flottante (matériau/glow du thème, légère oscillation idle) affiche la somme et la parité — remplace l'actuel texte 2D plat de `FlipReveal.outcomeLabel`, mais reste un overlay HTML positionné en 3D-style (texte net, pas de géométrie de caractères) comme pour le texte de résultat du sous-projet 1.

**Composants nouveaux (`frontend/src/three/scenes/`) :**
- `NumberDrum.tsx` — un tambour réutilisable : 9 faces disposées en cylindre (comme la maquette validée), avec deux modes :
  - **Interactif** (tambour du joueur, en phase de sélection) : rotation pilotée par glissement pointeur (`onPointerDown`/`onPointerMove`/`onPointerUp` de React Three Fiber), qui s'aimante (snap) sur la face la plus proche au relâchement — remplace `NumberTokenPicker`. Émet la valeur choisie au parent (même contrat que `NumberTokenPicker`'s `onChange`).
  - **Résultat** (tambour adverse) : rotation entièrement pilotée par état (`pose`-like : masqué / en train de tourner vers une valeur cible / arrêté), pas d'interaction pointeur.
- `PlusSymbol3D.tsx` — le séparateur "+" flottant, idle uniquement (pas d'état de jeu).
- `SumPlate3D.tsx` — la plaque flottante de résultat (somme + parité), reçoit le texte déjà calculé (pas de nouvelle logique de calcul, `getParity`/somme restent dans `oddOrEvenLogic.ts`).
- Réutilisation directe de `getThemeMaterial`/`GameCanvas`/`useAdaptiveQuality` sans modification.

**Solo et multijoueur en parallèle** : `OddOrEvenSolo.tsx` et `OddOrEvenMultiplayer.tsx` reçoivent la même intégration, chacun avec sa propre source de données (locale vs socket). Le tambour du joueur remplace `NumberTokenPicker` dans les deux ; le tambour adverse + le "+" + la plaque de résultat remplacent `FlipReveal` au moment du round.

## Composant héros : la scène de duel des tambours

Choréographie :

1. **Phase de sélection** : le tambour "Toi" est interactif (glisser pour choisir), le tambour "Adversaire" est visible mais masqué (`?` sur toutes les faces), le "+" flotte doucement entre les deux. En multijoueur, le tambour adverse reste masqué même après que l'adversaire a joué (pas de fuite d'information avant le duel).
2. **Lancement du round** : dès que les deux nombres sont connus (le tien confirmé, celui de l'adversaire reçu du serveur ou tiré localement en solo), les faces masquées de l'adversaire sont remplacées par les vrais chiffres (à cet instant précis seulement, jamais avant), puis le tambour adverse tourne visiblement plusieurs tours avant de décélérer et s'arrêter sur la bonne face — jamais un arrêt instantané.
3. **Résultat** : une fois les deux tambours immobiles, la plaque 3D de somme/parité apparaît (pop + flottement idle), avec le style visuel gagnant/perdant du thème actif.
4. Fin → callback `onComplete`, même contrat que l'actuel `FlipReveal`.

## Dégradation automatique

Si `quality === 'fallback2d'`, la scène 3D ne se monte jamais et le jeu retombe sur `NumberTokenPicker` (sélection) + `FlipReveal` (reveal) — comportement actuel inchangé, aucune régression. Le tambour interactif (drag-to-select) est plus coûteux en interaction qu'un simple bouton, mais reste une rotation simple (pas de physique) — pas d'inquiétude de performance particulière au-delà de ce que le ratchet de qualité gère déjà.

## Tests

- Logique pure testable : la fonction de "snap à la face la plus proche" (angle de rotation → index de face 0-8) et la fonction de calcul de la trajectoire de rotation du tambour adverse (nombre de tours + easing → angle en fonction du temps, par analogie avec `duelTimeline.ts`) peuvent être extraites et testées en Vitest.
- Le rendu WebGL et l'interaction de glissement ne sont pas testables en CI — vérification manuelle en navigateur (glisser pour choisir un nombre, vérifier qu'aucun chiffre de l'adversaire n'apparaît avant le lancement du round, vérifier que le tambour adverse tourne visiblement avant de s'arrêter) dans les 4 thèmes, en solo et en multijoueur (deux onglets), avant de considérer ce sous-projet terminé.

## Hors périmètre

- Jeux à cartes (sous-projet 4).
