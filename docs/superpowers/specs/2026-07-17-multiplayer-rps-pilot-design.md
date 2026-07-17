# Mode multijoueur RPS — pilote score + animations — Design

Date: 2026-07-17

## Contexte

Le mode solo a reçu (sessions précédentes) : score cible par manche (premier à N), overlay de fin de partie animé (emoji géant), et des animations de révélation de manche occupant tout l'espace de jeu (`DuelReveal`, `FlipReveal`, `BurstReveal`), plus des contrôles repensés (cartes emoji RPS, jetons de chiffres, roue de joueurs).

Le mode multijoueur (`GamePlayPage.tsx`) n'a reçu qu'un pseudo joueur (session précédente) et un correctif de connectivité réseau. Il reste sur l'ancienne UI `Button` texte brute, sans score cumulatif, sans notion de fin de partie, et chaque résultat de manche n'est qu'un message texte générique envoyé par le serveur (pas de données structurées permettant d'animer une révélation).

## Objectif de cette session

Porter le traitement complet (score cible, `MatchEndOverlay`, `DuelReveal`) sur **Pierre-Feuille-Ciseau en multijoueur uniquement**, comme preuve de concept avant de répliquer aux 5 autres jeux dans une session suivante.

## Catégorisation (reprise du solo)

- **Compétitifs** (score cible + reveal + fin de partie) : RPS (cette session), Pair ou Impair, 20 Questions, 2 Vérités 1 Mensonge — ces 3 derniers dans une prochaine session.
- **Contenu seul** (pas de score) : Action ou Vérité, Tu Préfères ? — dans une prochaine session, avec la roue `PlayerWheel` alimentée par les vrais joueurs de la salle (pas juste "Vous") et `FlipReveal`.

## Architecture — RPS multijoueur

### Backend

- `RoomState` (`roomManager.ts`) gagne deux champs : `gameId: string` et `scores: Record<string, number>` (score courant par `socket.id`, initialisé à 0 quand un joueur rejoint).
- `createRoom(socketId, name, gameId)` et `joinRoom(roomId, socketId, name, gameId)` acceptent désormais `gameId`. `joinRoom` lève une erreur si le `gameId` fourni ne correspond pas à celui de la salle (« Ce salon ne correspond pas à ce jeu. »).
- Constante `TARGET_SCORES: Record<string, number>` avec au moins `{ rps: 5 }` pour l'instant (les autres jeux seront ajoutés avec leur propre tâche plus tard).
- `setChoice` (utilisé par RPS) est restructuré pour retourner, par joueur, un objet enrichi au lieu d'un simple message texte :
  ```ts
  type RpsRoundResult = {
    yourMove: string;
    opponentMove: string;
    outcome: 'player' | 'machine' | 'draw'; // réutilise le vocabulaire du solo, "machine" = adversaire ici
    yourScore: number;
    opponentScore: number;
    matchOver: boolean;
    winnerId: string | null;
  };
  ```
  Le score est incrémenté dans `room.scores` à chaque manche gagnée (comme le score solo), et `matchOver`/`winnerId` sont dérivés dès qu'un score atteint `TARGET_SCORES.rps`.
- Nouvel événement client `ClientEvents.ResetMatchScore` (`reset-match-score`) : remet `room.scores` à 0 pour tous les joueurs de la salle et rediffuse l'état à 0 — déclenché par le bouton « Nouvelle partie » de `MatchEndOverlay`.

### Frontend

- `frontend/src/pages/RoomLobbyPage.tsx` : `handleCreateRoom`/`handleJoinRoom` envoient désormais `gameId` (déjà disponible via `useParams`) en plus du pseudo.
- Nouveau fichier `frontend/src/games/multiplayer/RpsMultiplayer.tsx`, remplaçant la branche RPS du switch dans `GamePlayPage.tsx`. Reprend le style de `RpsSolo.tsx` : cartes emoji (✊✋✌️), mais :
  - Après un coup joué, affiche un état « En attente de l'adversaire » (pas de reveal tant que le serveur n'a pas répondu — contrairement au solo où l'issue est connue immédiatement).
  - À la réception du résultat serveur, affiche `DuelReveal` (réutilisé tel quel) avec `yourMove`/`opponentMove`.
  - `ScorePill` (réutilisé tel quel) alimenté par `yourScore`/`opponentScore` reçus du serveur (pas de hook `useSoloScore` — le score vit côté serveur, pas dans un state local).
  - `MatchEndOverlay` (réutilisé tel quel) affiché quand `matchOver` est vrai ; le bouton « Nouvelle partie » émet `ResetMatchScore`.
- `GamePlayPage.tsx` : la branche `gameId === 'rps'` du switch délègue à `<RpsMultiplayer />` ; les 5 autres jeux restent inchangés (branches existantes) jusqu'à leur propre tâche.

## Hors scope (cette session)

- Pair ou Impair, 20 Questions, 2 Vérités 1 Mensonge, Action ou Vérité, Tu Préfères ? — traités dans une session suivante en répliquant le même patron.
- Gestion de plus de 2 joueurs par salon (déjà hors scope depuis la session pseudo).
- `ResultsPage` reste statique/factice.
