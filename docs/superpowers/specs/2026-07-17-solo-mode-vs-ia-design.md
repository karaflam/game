# Mode Solo vs IA — Design

Date: 2026-07-17

## Contexte

L'application propose 6 mini-jeux jouables en multijoueur via socket.io (`backend/src/roomManager.ts`, `frontend/src/pages/GamePlayPage.tsx`). La route solo (`/jeu/:gameId/salon/solo` → `SoloPlayPage.tsx`) existe mais n'affiche qu'un placeholder. Il existe aussi un ensemble de fichiers non routés et non importés (`frontend/src/games/*.tsx`, `frontend/src/components/GameContent.tsx`, `frontend/src/events.ts`, `frontend/src/data/gamePrompts.ts`) qui contenaient une première tentative de logique solo, avec des styles inline incohérents avec le design system actuel (Tailwind + shadcn).

## Objectif

Permettre de jouer aux 6 jeux en solo contre une IA locale, sans backend, avec un score courant affiché et la possibilité d'enchaîner les manches.

## Architecture

- **100% client** : aucune requête réseau. Toute la logique IA (coups aléatoires, mots à deviner, génération de mensonges) tourne dans le navigateur.
- Un composant par jeu, sous `frontend/src/games/solo/`:
  - `RpsSolo.tsx`
  - `OddOrEvenSolo.tsx`
  - `TwentyQuestionsSolo.tsx`
  - `TruthOrDareSolo.tsx`
  - `WouldYouRatherSolo.tsx`
  - `TwoTruthsOneLieSolo.tsx`
- `SoloPlayPage.tsx` fait un switch sur `gameId` (même pattern que `GamePlayPage.tsx`) et rend le composant solo correspondant.
- Hook partagé `useSoloScore()` (`frontend/src/hooks/useSoloScore.ts`) exposant `{ player, machine, roundPlayer, roundMachine, recordRound(outcome), reset() }`. Affiché via un composant `ScorePill` en haut de `SoloPlayPage`.
- Nouveau fichier de données `frontend/src/data/soloPrompts.ts` regroupant : défis vérité/action, dilemmes "Tu préfères", mots à deviner (avec indices), triplets vérité/mensonge. Reprend le contenu français existant de `backend/src/gamePrompts.ts` / `frontend/src/data/gamePrompts.ts` et l'étoffe pour varier les parties (au moins 8-10 entrées par catégorie).

## Nettoyage (dead code)

Suppression de :
- `frontend/src/games/RpsGame.tsx`, `OddOrEvenGame.tsx`, `TruthOrDareGame.tsx`, `WouldYouRatherGame.tsx`, `TwentyQuestionsGame.tsx`, `TwoTruthsOneLieGame.tsx`
- `frontend/src/components/GameContent.tsx`
- `frontend/src/events.ts`
- `frontend/src/data/gamePrompts.ts`

Ces fichiers ne sont référencés par aucune route active (vérifié : seul `GameContent.tsx` importait les jeux, et rien n'importe `GameContent.tsx`).

## Fin de partie (jeux compétitifs uniquement)

Les 4 jeux compétitifs (RPS, Pair ou Impair, 20 Questions, 2 Vérités 1 Mensonge) ont désormais une **condition de victoire par score cible**, propre à chacun pour respecter leur rythme :

| Jeu | Score cible | Justification |
|---|---|---|
| Pierre-Feuille-Ciseau | 5 points | Manche quasi instantanée (1 clic), 5 permet une partie courte et rejouable. |
| Pair ou Impair | 5 points | Même rythme rapide que RPS. |
| 20 Questions | 3 points | Chaque manche peut demander jusqu'à 20 essais, donc un match plus court en nombre de manches. |
| 2 Vérités, 1 Mensonge | 5 points | Manche rapide (lecture + 1 clic). |

Quand le joueur ou l'IA atteint le score cible :
- Le jeu se **verrouille** (plus d'interaction possible) et affiche un **écran de fin en overlay** dans le conteneur du jeu (pas de redirection vers `ResultsPage`, conformément au scope initial).
- **Victoire** (joueur atteint le score cible en premier) : animation `framer-motion` de célébration (scale + fade-in du message, légère confetti/particules CSS ou icône `PartyPopper`/`Trophy` de lucide-react qui rebondit), message "Vous avez gagné la partie !".
- **Défaite** (IA atteint le score cible en premier) : animation plus sobre (fade-in, icône `Frown`/`RotateCcw`), message "L'IA a gagné cette fois...".
- Un bouton **"Nouvelle partie"** réinitialise le score (`reset()`) et referme l'overlay pour rejouer.
- Tant que le score cible n'est pas atteint, le jeu se comporte comme décrit ci-dessous (manches enchaînables via `useSoloScore`).

Le hook `useSoloScore(targetScore)` expose donc aussi `isMatchOver: boolean` et `winner: 'player' | 'machine' | null`, calculés dès que `player >= targetScore || machine >= targetScore`. Chaque composant de jeu compétitif bloque les actions de jeu quand `isMatchOver` est vrai.

## Mécaniques par jeu

### 1. Pierre-Feuille-Ciseau (compétitif, cible 5 points)
- Le joueur choisit pierre/feuille/ciseau.
- L'IA choisit aléatoirement.
- Résultat immédiat (règles classiques), score +1/-1/0 (égalité ne compte pas comme point).
- Bouton pour rejouer une manche, désactivé si `isMatchOver`.

### 2. Pair ou Impair (compétitif, cible 5 points)
- Le joueur choisit un chiffre 1-9 et prédit pair/impair de la somme avec le chiffre de l'IA.
- L'IA choisit un chiffre aléatoire 1-9.
- Score +1 si prédiction correcte, -1 sinon.

### 3. 20 Questions (compétitif, guessing, cible 3 points)
- L'IA "pense" à un mot tiré aléatoirement dans `soloPrompts.ts` (mot + liste d'indices).
- Un indice est révélé au démarrage, puis un nouvel indice après chaque essai raté (cycle sur la liste d'indices si moins de 20 indices).
- 20 essais max. Victoire de la manche = mot trouvé, défaite de la manche = essais épuisés (le mot est révélé).
- Score +1 si trouvé, -1 sinon (compte comme un point vers le score cible de la partie).

### 4. Action ou Vérité (contenu, pas de score)
- L'IA tire un défi aléatoire (couple truth/dare) dans `soloPrompts.ts`.
- Le joueur choisit "Action" ou "Vérité", le texte correspondant s'affiche.
- Bouton "Prochain tour" pour tirer un nouveau défi.

### 5. Tu Préfères ? (contenu + comparaison, pas de score)
- L'IA affiche un dilemme (deux options).
- Le joueur clique une option.
- L'IA révèle ensuite son propre choix (tiré aléatoirement, indépendamment du choix du joueur) pour comparer ("Vous avez choisi X, l'IA a choisi Y").
- Bouton "Prochain dilemme".

### 6. 2 Vérités, 1 Mensonge (compétitif, déduction, cible 5 points)
- L'IA génère un triplet de 3 affirmations (2 vraies, 1 fausse) tiré de `soloPrompts.ts`, position du mensonge randomisée à chaque manche.
- Le joueur clique sur l'affirmation qu'il pense être le mensonge.
- Score +1 si correct, -1 sinon. La bonne réponse est révélée.

## UI / Style

Chaque composant solo suit le design system actuel :
- Conteneurs `rounded-3xl border border-border bg-background p-8`.
- `Button` de `components/ui/button.tsx` pour toutes les actions.
- Animations légères via `framer-motion` sur l'apparition des résultats (fade/slide, cohérent avec le reste de l'app).
- `ScorePill` : petit badge affichant "Vous X — IA Y" en haut de la page solo, avec un bouton discret "Réinitialiser".

## Hors scope

- Pas de niveaux de difficulté IA (les coups de l'IA sont toujours aléatoires uniformes).
- Pas de persistance du score entre sessions (reset au rechargement de la page).
- Pas de redirection vers `ResultsPage` en fin de partie solo — le score reste affiché en continu sur la page.
