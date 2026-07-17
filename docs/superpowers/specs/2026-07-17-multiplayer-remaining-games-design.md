# Mode multijoueur — 5 jeux restants — Design

Date: 2026-07-17

## Contexte

Le pilote RPS (session précédente) a validé le patron : `RoomManager` suit un score cumulé par salon, un composant `*Multiplayer.tsx` par jeu réutilise `ScorePill`/`MatchEndOverlay`/les composants de révélation du solo. Cette session étend ce patron aux 5 jeux restants, avec des changements de mécanique demandés pour Action ou Vérité et 20 Questions.

## Décisions actées avec l'utilisateur

- **`ScorePill`** : les libellés `"Vous"`/`"IA"` codés en dur deviennent des props optionnelles (`playerLabel`/`machineLabel`, défaut `"Vous"`/`"IA"` pour ne rien casser côté solo). Tous les composants multijoueur (RPS y compris, à corriger) passent `playerLabel={`${monPseudo} (vous)`}` et `machineLabel={pseudoAdverse}`.
- **Anti-répétition** : un nouvel utilitaire pur `pickRandomIndexExcluding(length, excluded, random?)` retourne un index en excluant ceux déjà vus ; si tous sont épuisés, le pool se réinitialise (recyclage). Utilisé :
  - **Solo** (retrofit) : `TruthOrDareSolo`, `WouldYouRatherSolo`, `TwentyQuestionsSolo`, `TwoTruthsOneLieSolo` — chacun garde un `Set<number>` d'indices déjà vus en state local.
  - **Multijoueur backend** : Action ou Vérité et Tu Préfères ? (contenu généré par le système). 2 Vérités 1 Mensonge et 20 Questions (nouveau design) n'ont pas besoin de cet utilitaire car leur contenu est fourni par un joueur, pas par le système.
- **Contenu backend** (`backend/src/gamePrompts.ts`) : `truthOrDarePrompts` et `wouldYouRatherPrompts` passent à 8 entrées chacun (texte repris de `soloPrompts.ts` pour la cohérence). `twentyQuestionsWords` est supprimé (plus utilisé — 20 Questions multijoueur devient piloté par les joueurs, pas par une liste système).
- **Tu Préfères ?** : garde un score (demande explicite), mais la règle change — **+1 aux deux joueurs s'ils ont fait le même choix, 0 sinon** (au lieu de « le premier qui clique gagne »). Cible 5 points, comme les autres jeux compétitifs.
- **20 Questions** : 3 allers-retours (6 tours au total, rôles alternés à chaque tour), score de manche = essais restants au moment de la bonne réponse (0 si les essais sont épuisés), le score total le plus haut après 6 tours gagne. En cas d'égalité : nouvel état **« Égalité »** géré par `MatchEndOverlay` (extension de son type `Winner` pour accepter `'draw'`, rétrocompatible — le solo ne l'utilise jamais).
- **Action ou Vérité** : la roue (`PlayerWheel`) désigne le joueur actif parmi les **vrais joueurs de la salle**. Le joueur actif choisit Action ou Vérité ; pour Vérité, il **répond par écrit** dans un champ texte du site. C'est **l'autre joueur** qui valide ou refuse la réponse/l'action. +1 point si validé, 0 sinon. Cible 5 points.

## Architecture backend

### `RoomState` (extension)

```ts
type RoomState = {
  gameId: string;
  players: Player[];
  choices: Map<string, string>;
  gameData: Record<string, any>;
  scores: Record<string, number>;
  usedTruthOrDare: Set<number>;
  usedWouldYouRather: Set<number>;
};
```

`TARGET_SCORES` gagne `'odd-or-even': 5`, `'would-you-rather': 5`, `'two-truths-one-lie': 5`, `'truth-or-dare': 5`. `20-questions` n'y figure **pas** : sa fin de partie est basée sur un nombre de tours (6), pas un score cible — logique dédiée dans une méthode séparée.

### Pair ou Impair — `setOddOrEvenChoice` restructuré

Même patron que `setRpsChoice` : accumule dans `room.scores`, calcule `matchOver`/`winnerId`, retourne une entrée par joueur avec **sa** valeur/prédiction et celle de l'adversaire (au lieu du message texte actuel).

### 2 Vérités 1 Mensonge — scores déplacés dans `room.scores`

Le flux soumission/vote existant est conservé tel quel (un joueur soumet, l'autre vote). Le calcul de score (actuellement inline dans `index.ts`) migre dans une méthode `RoomManager` qui accumule dans `room.scores`, calcule `matchOver`/`winnerId` (cible 5), et le nouvel événement enrichi remplace `TwoTruthsOneLieResult`.

### Tu Préfères ? — nouveau `setWouldYouRatherChoice`

Réutilise `room.choices` (comme RPS/Pair ou Impair) : chaque joueur soumet son choix, on attend les deux avant de révéler. Le prompt est choisi une fois par manche via `pickRandomIndexExcluding` sur `usedWouldYouRather`, stocké dans `room.gameData`. Score : +1 aux deux si même choix, 0 sinon (cible 5).

### Action ou Vérité — nouveaux événements

```ts
// Client → Serveur
TruthOrDareStart        // inchangé, déclenche le tirage de la roue
TruthOrDareChoice({ type: 'action' | 'truth' })   // joueur actif uniquement
TruthOrDareAnswer({ answer: string })             // joueur actif, si type === 'truth'
TruthOrDareValidate({ approved: boolean })        // joueur non-actif uniquement

// Serveur → Clients
TruthOrDareSpin({ activePlayerId, activePlayerName })       // anime la roue, pas de contenu
TruthOrDareContent({ type, text })                          // dare décrit, ou question de vérité
TruthOrDareAnswerSubmitted({ answer })                      // réponse écrite affichée à tous
TruthOrDareResult({ approved, activePlayerId, scores, matchOver, winnerId })
```

Le serveur vérifie que l'émetteur de `TruthOrDareChoice`/`TruthOrDareAnswer` est bien le joueur actif, et que l'émetteur de `TruthOrDareValidate` est bien l'autre joueur (sinon `RoomError`). Le prompt est choisi via `pickRandomIndexExcluding` sur `usedTruthOrDare`.

### 20 Questions — nouveaux événements, état de tour dans `gameData`

```ts
// Client → Serveur
TwentyQuestionsSetWord({ word: string })   // joueur "meneur" du tour
TwentyQuestionsGuess({ guess: string })    // joueur "devineur" du tour
TwentyQuestionsJudge({ correct: boolean; hint?: string })  // meneur uniquement

// Serveur → Clients
TwentyQuestionsRoundReady({ setterId, guesserId, attemptsRemaining })
TwentyQuestionsGuessSubmitted({ guess, attemptsRemaining })
TwentyQuestionsRoundResult({
  correct, hint, attemptsRemaining, roundOver, turnIndex,
  nextSetterId, nextGuesserId, scores, matchOver, isDraw, winnerId
})
```

`room.gameData.twentyQuestions` garde l'état éphémère du tour en cours (`setterId`, `guesserId`, `word`, `attemptsRemaining`, `turnIndex` 1 à 6). `room.scores` accumule le score cumulé (réutilise le même champ que RPS — donc le `reset-match-score` existant fonctionne aussi pour 20 Questions). `MAX_ATTEMPTS_PER_TURN = 10` (plus court que le solo, car chaque essai implique une vraie interaction entre joueurs — taper un indice prend du temps). Tour 1 : `players[0]` = meneur, `players[1]` = devineur ; les rôles s'inversent à chaque tour suivant. Après le tour 6, comparaison finale des scores → victoire, défaite, ou égalité.

## Composants frontend (`frontend/src/games/multiplayer/`)

- `OddOrEvenMultiplayer.tsx` : `NumberTokenPicker` + boutons pair/impair (comme le solo), `FlipReveal` (deux jetons), `ScorePill`, `MatchEndOverlay`.
- `TwoTruthsOneLieMultiplayer.tsx` : flux soumission (3 champs texte) / vote (3 boutons) existant, `BurstReveal` pour le résultat du vote, `ScorePill`, `MatchEndOverlay`.
- `WouldYouRatherMultiplayer.tsx` : les deux joueurs choisissent pour le **même** dilemme (attente de l'adversaire comme RPS), `BurstReveal` comparant les deux choix réels, `ScorePill`, `MatchEndOverlay`.
- `TruthOrDareMultiplayer.tsx` : `PlayerWheel` avec les vrais joueurs, sélection Action/Vérité (joueur actif), champ texte pour la réponse (si Vérité), `FlipReveal` pour révéler le contenu, puis boutons Valider/Refuser (joueur non-actif), `ScorePill`, `MatchEndOverlay`.
- `TwentyQuestionsMultiplayer.tsx` : champ pour poser le mot secret (meneur), champ de proposition (devineur), boutons "Correct"/"Incorrect + indice" (meneur), `BurstReveal` en fin de tour, `ScorePill`, `MatchEndOverlay` (avec gestion du cas égalité).
- `GamePlayPage.tsx` : les 5 branches restantes du switch délèguent chacune à leur nouveau composant, à l'image de la branche `rps` actuelle. Toute la logique/état RPS-only déjà présente dans `GamePlayPage.tsx` (handlers, listeners) est retirée puisqu'elle migre dans les composants dédiés.

## Composants partagés modifiés

- `ScorePill.tsx` : ajoute `playerLabel?: string` / `machineLabel?: string` (défauts `"Vous"`/`"IA"`).
- `MatchEndOverlay.tsx` : `winner` accepte désormais `'player' | 'machine' | 'draw' | null` (type `Winner` étendu dans `lib/soloScore.ts`). Cas `'draw'` : emoji 🤝, message neutre "Égalité !".
- `RpsMultiplayer.tsx` (déjà livré) : mis à jour pour passer `playerLabel`/`machineLabel` à `ScorePill`.

## Retrofit anti-répétition en solo

`TruthOrDareSolo`, `WouldYouRatherSolo`, `TwentyQuestionsSolo`, `TwoTruthsOneLieSolo` gagnent chacun un state `usedIndices: Set<number>` et utilisent `pickRandomIndexExcluding` au lieu de `pickRandomItem` pour sélectionner leur prochain contenu, avec recyclage automatique une fois la liste épuisée.

## Hors scope

- `ResultsPage` reste statique.
- Pas de limite stricte à 2 joueurs par salon (déjà noté comme dette dans les sessions précédentes).
- 20 Questions : pas de manche supplémentaire en cas d'égalité de mots pendant un tour (l'égalité ne se gère qu'au niveau du score final de la partie).
