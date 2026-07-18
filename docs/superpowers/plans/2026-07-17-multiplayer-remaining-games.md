# Mode multijoueur — 5 jeux restants — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Étendre le patron validé par le pilote RPS (score cumulé par salon, composant `*Multiplayer.tsx` dédié réutilisant `ScorePill`/`MatchEndOverlay`/les révélations du solo) aux 5 jeux multijoueur restants : Pair ou Impair, 2 Vérités 1 Mensonge, Tu Préfères ?, Action ou Vérité, 20 Questions — avec les changements de mécanique déjà actés pour Action ou Vérité et 20 Questions.

**Architecture:** `RoomManager` (backend) porte toute la logique de jeu par salon (choix, score cumulé, tirage anti-répétition, état de tour). `index.ts` reste un mince routeur événements → `RoomManager` → diffusion socket.io. Chaque jeu multijoueur devient un composant frontend autonome dans `frontend/src/games/multiplayer/`, branché depuis `GamePlayPage.tsx` par un switch sur `gameId` (comme `rps` déjà livré). Les 4 jeux solo à contenu généré par le système gagnent l'anti-répétition déjà utilisée par `TruthOrDareSolo`.

**Tech Stack:** Node/Express/socket.io (backend, TypeScript, pas de framework de test — vérification par `tsc --noEmit`), React/Zustand/framer-motion (frontend, TypeScript, vitest pour la logique pure uniquement — pas de test de composants dans ce repo).

## Global Constraints

- Cible de score : **5** pour `odd-or-even`, `would-you-rather`, `two-truths-one-lie`, `truth-or-dare` (comme `rps`). `20-questions` n'a **pas** de cible de score — sa fin de partie dépend d'un nombre de tours fixe (6).
- `ScorePill`/`MatchEndOverlay`/`PlayerWheel`/`FlipReveal`/`BurstReveal`/`DuelReveal`/`NumberTokenPicker` (dans `frontend/src/components/solo/`) sont réutilisés **sans changement de leur code** (seul `ScorePill`/`MatchEndOverlay` ont déjà été étendus lors de la session précédente — ne pas les re-modifier).
- `pickRandomIndexExcluding` (`frontend/src/lib/randomPick.ts`, déjà livré) est utilisé pour l'anti-répétition **solo**. Le backend a sa **propre** copie de cette logique (`RoomManager.pickIndexExcluding`, privée) — pas de partage de code entre les deux packages npm séparés (`backend/`, `frontend/`).
- Pas de limite stricte à 2 joueurs par salon (dette déjà connue, hors scope).
- 20 Questions : pas de manche supplémentaire en cas d'égalité de mots pendant un tour (l'égalité ne se gère qu'au niveau du score final de la partie, à l'issue des 6 tours).

---

### Task 1: Commit du travail préparatoire déjà en cours

**Files:**
- Commit (déjà modifiés, non commités) : `backend/src/events.ts`, `backend/src/gamePrompts.ts`, `frontend/src/lib/socketEvents.ts`, `frontend/src/games/solo/TruthOrDareSolo.tsx`, `.gitignore`

**Interfaces:**
- Produces : les constantes d'événements socket (`ServerEvents`/`ClientEvents`, backend et frontend) pour Action ou Vérité et 20 Questions, déjà correctement nommées pour tout ce plan — consommées par toutes les tâches suivantes.

Une session précédente a déjà modifié ces 5 fichiers dans l'arbre de travail (non commités) : nouveaux noms d'événements Action ou Vérité / 20 Questions, prompts étendus à 8 entrées, suppression de `twentyQuestionsWords`, retrofit anti-répétition de `TruthOrDareSolo`. Ce travail est correct et sert de fondation à ce plan — il faut le committer avant de continuer, sans le modifier.

- [ ] **Step 1: Vérifier l'état actuel**

Run: `git status`
Expected: les 5 fichiers listés ci-dessus apparaissent modifiés, rien d'autre.

Run: `git diff -- backend/src/events.ts backend/src/gamePrompts.ts frontend/src/lib/socketEvents.ts frontend/src/games/solo/TruthOrDareSolo.tsx .gitignore`
Expected: confirmer que le diff correspond à — nouveaux événements `TruthOrDareSpin`/`TruthOrDareContent`/`TruthOrDareAnswer`/`TruthOrDareAnswerSubmitted`/`TruthOrDareValidate` (backend `events.ts` + frontend `socketEvents.ts`), nouveaux événements `TwentyQuestionsSetWord`/`TwentyQuestionsJudge`/`TwentyQuestionsRoundReady`/`TwentyQuestionsGuessSubmitted`/`TwentyQuestionsRoundResult` (idem), `truthOrDarePrompts`/`wouldYouRatherPrompts` à 8 entrées chacun, suppression de `twentyQuestionsWords`, retrofit `pickRandomIndexExcluding` dans `TruthOrDareSolo.tsx`, ajout de `.aider*` au `.gitignore`.

- [ ] **Step 2: Committer**

```bash
git add backend/src/events.ts backend/src/gamePrompts.ts frontend/src/lib/socketEvents.ts frontend/src/games/solo/TruthOrDareSolo.tsx .gitignore
git commit -m "feat: rename truth-or-dare/twenty-questions socket events, extend prompt pools, retrofit TruthOrDareSolo anti-repetition"
```

- [ ] **Step 3: Confirmer que le backend ne compile pas encore (attendu)**

Run: `cd backend && npx tsc --noEmit`
Expected: erreurs dans `backend/src/index.ts` — `twentyQuestionsWords` n'existe plus dans `gamePrompts.ts`, et plusieurs valeurs de `ServerEvents` référencées (`TruthOrDareUpdate`, `TwentyQuestionsStart`, `TwentyQuestionsUpdate`, `TwentyQuestionsResult`) n'existent plus dans `events.ts`. C'est normal — corrigé par les Tasks 2 et 3.

---

### Task 2: `RoomManager` — logique complète des 5 jeux

**Files:**
- Modify: `backend/src/roomManager.ts` (remplacement intégral)

**Interfaces:**
- Produces (nouvelles méthodes publiques, en plus de celles déjà existantes `createRoom`/`getRoomId`/`getPlayers`/`joinRoom`/`leaveRoom`/`setGameData`/`getGameData`/`clearGameData`/`setRpsChoice`/`resetScores`, inchangées) :
  - `getGameId(roomId: string): string | null`
  - `setOddOrEvenChoice(socketId, value, prediction)` — signature inchangée, **comportement/retour restructuré** : `{ roomId, entries: [{ socketId, yourValue, yourPrediction, opponentValue, opponentPrediction, sum, parity, outcome: 'player'|'machine'|'draw' }, ...], scores, matchOver, winnerId } | null`
  - `startWouldYouRatherRound(socketId): { roomId, prompt: { left, right } }`
  - `setWouldYouRatherChoice(socketId, selected: 'left'|'right'): { roomId, entries: [{ socketId, yourChoice, opponentChoice }, ...], sameChoice, scores, matchOver, winnerId } | null`
  - `voteTwoTruthsOneLie(socketId, voteIndex): { roomId, voterSocketId, correct, lieIndex, scores, matchOver, winnerId }`
  - `startTruthOrDare(socketId): { roomId, activePlayerId, activePlayerName }`
  - `chooseTruthOrDareType(socketId, type: 'action'|'truth'): { roomId, type, text }`
  - `submitTruthOrDareAnswer(socketId, answer): { roomId, answer }`
  - `validateTruthOrDare(socketId, approved): { roomId, approved, activePlayerId, scores, matchOver, winnerId }`
  - `beginTwentyQuestionsMatch(socketId): { roomId, setterId, guesserId, attemptsRemaining, turnIndex }`
  - `setTwentyQuestionsWord(socketId, word): { roomId }`
  - `submitTwentyQuestionsGuess(socketId, guess): { roomId, guess, attemptsRemaining }`
  - `judgeTwentyQuestionsGuess(socketId, correct, hint?): { roomId, correct, hint, attemptsRemaining, roundOver, turnIndex, nextSetterId, nextGuesserId, scores, matchOver, isDraw, winnerId }`
- Consumed by: Task 3 (`index.ts`).

- [ ] **Step 1: Remplacer le contenu du fichier**

Remplacer entièrement `backend/src/roomManager.ts` par :

```ts
import { truthOrDarePrompts, wouldYouRatherPrompts } from './gamePrompts.js';

export type Player = { id: string; name: string };

const TARGET_SCORES: Record<string, number> = {
  rps: 5,
  'odd-or-even': 5,
  'would-you-rather': 5,
  'two-truths-one-lie': 5,
  'truth-or-dare': 5
};

const TWENTY_Q_MAX_ATTEMPTS = 10;
const TWENTY_Q_MAX_TURNS = 6;

type TruthOrDareState = {
  promptIndex: number;
  activePlayerId: string;
  type: 'action' | 'truth' | null;
  answer: string | null;
};

type WouldYouRatherState = {
  promptIndex: number;
};

type TwoTruthsOneLieState = {
  statements: string[];
  lieIndex: number;
  submitter: string;
};

type TwentyQuestionsState = {
  turnIndex: number;
  setterId: string;
  guesserId: string;
  word: string | null;
  attemptsRemaining: number;
};

type RoomState = {
  gameId: string;
  players: Player[];
  choices: Map<string, string>;
  gameData: Record<string, any>;
  scores: Record<string, number>;
  usedTruthOrDare: Set<number>;
  usedWouldYouRather: Set<number>;
};

function generateRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export class RoomManager {
  private rooms = new Map<string, RoomState>();
  private socketRoom = new Map<string, string>();

  createRoom(socketId: string, name: string, gameId: string) {
    const roomId = generateRoomId();
    const player: Player = { id: socketId, name };
    this.rooms.set(roomId, {
      gameId,
      players: [player],
      choices: new Map(),
      gameData: {},
      scores: { [socketId]: 0 },
      usedTruthOrDare: new Set(),
      usedWouldYouRather: new Set()
    });
    this.socketRoom.set(socketId, roomId);
    return { roomId, players: [player] };
  }

  getRoomId(socketId: string) {
    return this.socketRoom.get(socketId) ?? null;
  }

  getGameId(roomId: string) {
    return this.rooms.get(roomId)?.gameId ?? null;
  }

  getPlayers(roomId: string) {
    return this.rooms.get(roomId)?.players ?? [];
  }

  joinRoom(roomId: string, socketId: string, name: string, gameId: string) {
    if (!this.rooms.has(roomId)) {
      throw new Error('Salle introuvable.');
    }

    const room = this.rooms.get(roomId)!;
    if (room.gameId !== gameId) {
      throw new Error('Ce salon ne correspond pas à ce jeu.');
    }

    if (room.players.some(player => player.id === socketId)) {
      return room.players;
    }

    room.players.push({ id: socketId, name });
    room.scores[socketId] = 0;
    this.socketRoom.set(socketId, roomId);
    return room.players;
  }

  leaveRoom(socketId: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      return null;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      this.socketRoom.delete(socketId);
      return null;
    }

    room.players = room.players.filter(player => player.id !== socketId);
    room.choices.delete(socketId);
    delete room.gameData[socketId];
    delete room.scores[socketId];
    this.socketRoom.delete(socketId);

    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      return null;
    }

    return { roomId, players: room.players };
  }

  setGameData(socketId: string, key: string, data: any) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    room.gameData[key] = data;
  }

  getGameData(socketId: string, key: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      return null;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    return room.gameData[key] ?? null;
  }

  clearGameData(socketId: string, key?: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    if (key) {
      delete room.gameData[key];
      return;
    }

    room.gameData = {};
  }

  setOddOrEvenChoice(socketId: string, value: number, prediction: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    if (!room.players.some(player => player.id === socketId)) {
      throw new Error('Vous n’êtes pas membre de la salle.');
    }

    room.choices.set(socketId, JSON.stringify({ value, prediction }));

    if (room.choices.size < 2) {
      return null;
    }

    const [firstSocket, firstChoiceRaw] = Array.from(room.choices.entries())[0];
    const [secondSocket, secondChoiceRaw] = Array.from(room.choices.entries())[1];

    const firstChoice = JSON.parse(firstChoiceRaw) as { value: number; prediction: string };
    const secondChoice = JSON.parse(secondChoiceRaw) as { value: number; prediction: string };

    room.choices.clear();

    const sum = firstChoice.value + secondChoice.value;
    const parity = sum % 2 === 0 ? 'pair' : 'impair';
    const firstCorrect = firstChoice.prediction === parity;
    const secondCorrect = secondChoice.prediction === parity;
    const isDraw = firstCorrect === secondCorrect;

    if (!isDraw) {
      if (firstCorrect) {
        room.scores[firstSocket] = (room.scores[firstSocket] ?? 0) + 1;
      } else {
        room.scores[secondSocket] = (room.scores[secondSocket] ?? 0) + 1;
      }
    }

    const targetScore = TARGET_SCORES[room.gameId] ?? Infinity;
    const winnerId = room.players.find(player => (room.scores[player.id] ?? 0) >= targetScore)?.id ?? null;

    return {
      roomId,
      entries: [
        {
          socketId: firstSocket,
          yourValue: firstChoice.value,
          yourPrediction: firstChoice.prediction,
          opponentValue: secondChoice.value,
          opponentPrediction: secondChoice.prediction,
          sum,
          parity,
          outcome: (isDraw ? 'draw' : firstCorrect ? 'player' : 'machine') as 'player' | 'machine' | 'draw'
        },
        {
          socketId: secondSocket,
          yourValue: secondChoice.value,
          yourPrediction: secondChoice.prediction,
          opponentValue: firstChoice.value,
          opponentPrediction: firstChoice.prediction,
          sum,
          parity,
          outcome: (isDraw ? 'draw' : secondCorrect ? 'player' : 'machine') as 'player' | 'machine' | 'draw'
        }
      ],
      scores: { ...room.scores },
      matchOver: winnerId !== null,
      winnerId
    };
  }

  setRpsChoice(socketId: string, choice: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    if (!room.players.some(player => player.id === socketId)) {
      throw new Error('Vous n’êtes pas membre de la salle.');
    }

    room.choices.set(socketId, choice);

    if (room.choices.size < 2) {
      return null;
    }

    const [firstSocket, firstChoice] = Array.from(room.choices.entries())[0];
    const [secondSocket, secondChoice] = Array.from(room.choices.entries())[1];

    if (!firstChoice || !secondChoice) {
      room.choices.clear();
      return null;
    }

    room.choices.clear();

    const winner = this.getRpsWinner(firstChoice, secondChoice);
    if (winner === 'first') {
      room.scores[firstSocket] = (room.scores[firstSocket] ?? 0) + 1;
    } else if (winner === 'second') {
      room.scores[secondSocket] = (room.scores[secondSocket] ?? 0) + 1;
    }

    const targetScore = TARGET_SCORES[room.gameId] ?? Infinity;
    const winnerId =
      (room.scores[firstSocket] ?? 0) >= targetScore
        ? firstSocket
        : (room.scores[secondSocket] ?? 0) >= targetScore
          ? secondSocket
          : null;

    return {
      roomId,
      entries: [
        {
          socketId: firstSocket,
          yourMove: firstChoice,
          opponentMove: secondChoice,
          outcome: (winner === 'first' ? 'player' : winner === 'second' ? 'machine' : 'draw') as 'player' | 'machine' | 'draw'
        },
        {
          socketId: secondSocket,
          yourMove: secondChoice,
          opponentMove: firstChoice,
          outcome: (winner === 'second' ? 'player' : winner === 'first' ? 'machine' : 'draw') as 'player' | 'machine' | 'draw'
        }
      ],
      scores: { ...room.scores },
      matchOver: winnerId !== null,
      winnerId
    };
  }

  resetScores(socketId: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    for (const player of room.players) {
      room.scores[player.id] = 0;
    }

    return { roomId, scores: { ...room.scores } };
  }

  startWouldYouRatherRound(socketId: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    const index = this.pickIndexExcluding(wouldYouRatherPrompts.length, room.usedWouldYouRather);
    room.usedWouldYouRather.add(index);
    if (room.usedWouldYouRather.size >= wouldYouRatherPrompts.length) {
      room.usedWouldYouRather.clear();
    }

    const state: WouldYouRatherState = { promptIndex: index };
    room.gameData.wouldYouRather = state;

    return { roomId, prompt: wouldYouRatherPrompts[index] };
  }

  setWouldYouRatherChoice(socketId: string, selected: 'left' | 'right') {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    if (!room.players.some(player => player.id === socketId)) {
      throw new Error('Vous n’êtes pas membre de la salle.');
    }

    if (!room.gameData.wouldYouRather) {
      throw new Error('Aucun dilemme en cours.');
    }

    room.choices.set(socketId, selected);

    if (room.choices.size < 2) {
      return null;
    }

    const [firstSocket, firstChoice] = Array.from(room.choices.entries())[0];
    const [secondSocket, secondChoice] = Array.from(room.choices.entries())[1];

    room.choices.clear();
    delete room.gameData.wouldYouRather;

    const sameChoice = firstChoice === secondChoice;
    if (sameChoice) {
      room.scores[firstSocket] = (room.scores[firstSocket] ?? 0) + 1;
      room.scores[secondSocket] = (room.scores[secondSocket] ?? 0) + 1;
    }

    const targetScore = TARGET_SCORES[room.gameId] ?? Infinity;
    const winnerId = room.players.find(player => (room.scores[player.id] ?? 0) >= targetScore)?.id ?? null;

    return {
      roomId,
      entries: [
        { socketId: firstSocket, yourChoice: firstChoice, opponentChoice: secondChoice },
        { socketId: secondSocket, yourChoice: secondChoice, opponentChoice: firstChoice }
      ],
      sameChoice,
      scores: { ...room.scores },
      matchOver: winnerId !== null,
      winnerId
    };
  }

  voteTwoTruthsOneLie(socketId: string, voteIndex: number) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    const state = room.gameData.twoTruthsOneLie as TwoTruthsOneLieState | undefined;
    if (!state) {
      throw new Error('Aucun jeu 2 Vérités 1 Mensonge en cours.');
    }

    delete room.gameData.twoTruthsOneLie;

    const correct = voteIndex === state.lieIndex;
    const submitterId = state.submitter;

    if (correct) {
      room.scores[socketId] = (room.scores[socketId] ?? 0) + 1;
    } else {
      room.scores[submitterId] = (room.scores[submitterId] ?? 0) + 1;
    }

    const targetScore = TARGET_SCORES[room.gameId] ?? Infinity;
    const winnerId = room.players.find(player => (room.scores[player.id] ?? 0) >= targetScore)?.id ?? null;

    return {
      roomId,
      voterSocketId: socketId,
      correct,
      lieIndex: state.lieIndex,
      scores: { ...room.scores },
      matchOver: winnerId !== null,
      winnerId
    };
  }

  startTruthOrDare(socketId: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    if (room.players.length < 2) {
      throw new Error('Il faut au moins 2 joueurs pour jouer.');
    }

    const promptIndex = this.pickIndexExcluding(truthOrDarePrompts.length, room.usedTruthOrDare);
    room.usedTruthOrDare.add(promptIndex);
    if (room.usedTruthOrDare.size >= truthOrDarePrompts.length) {
      room.usedTruthOrDare.clear();
    }

    const activeIndex = Math.floor(Math.random() * room.players.length);
    const activePlayer = room.players[activeIndex];

    const state: TruthOrDareState = { promptIndex, activePlayerId: activePlayer.id, type: null, answer: null };
    room.gameData.truthOrDare = state;

    return { roomId, activePlayerId: activePlayer.id, activePlayerName: activePlayer.name };
  }

  chooseTruthOrDareType(socketId: string, type: 'action' | 'truth') {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    const state = room.gameData.truthOrDare as TruthOrDareState | undefined;
    if (!state) {
      throw new Error('Aucune manche Action ou Vérité en cours.');
    }

    if (state.activePlayerId !== socketId) {
      throw new Error('Vous n’êtes pas le joueur actif de cette manche.');
    }

    state.type = type;
    const prompt = truthOrDarePrompts[state.promptIndex];
    const text = type === 'action' ? prompt.dare : prompt.truth;

    return { roomId, type, text };
  }

  submitTruthOrDareAnswer(socketId: string, answer: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    const state = room.gameData.truthOrDare as TruthOrDareState | undefined;
    if (!state) {
      throw new Error('Aucune manche Action ou Vérité en cours.');
    }

    if (state.activePlayerId !== socketId) {
      throw new Error('Vous n’êtes pas le joueur actif de cette manche.');
    }

    if (state.type !== 'truth') {
      throw new Error('Aucune réponse écrite attendue pour une action.');
    }

    state.answer = answer;
    return { roomId, answer };
  }

  validateTruthOrDare(socketId: string, approved: boolean) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    const state = room.gameData.truthOrDare as TruthOrDareState | undefined;
    if (!state) {
      throw new Error('Aucune manche Action ou Vérité en cours.');
    }

    if (!room.players.some(player => player.id === socketId)) {
      throw new Error('Vous n’êtes pas membre de la salle.');
    }

    if (state.activePlayerId === socketId) {
      throw new Error('Vous ne pouvez pas valider votre propre manche.');
    }

    delete room.gameData.truthOrDare;

    if (approved) {
      room.scores[state.activePlayerId] = (room.scores[state.activePlayerId] ?? 0) + 1;
    }

    const targetScore = TARGET_SCORES[room.gameId] ?? Infinity;
    const winnerId = room.players.find(player => (room.scores[player.id] ?? 0) >= targetScore)?.id ?? null;

    return {
      roomId,
      approved,
      activePlayerId: state.activePlayerId,
      scores: { ...room.scores },
      matchOver: winnerId !== null,
      winnerId
    };
  }

  beginTwentyQuestionsMatch(socketId: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    if (room.players.length < 2) {
      throw new Error('Il faut au moins 2 joueurs pour jouer.');
    }

    const [setter, guesser] = room.players;
    const state: TwentyQuestionsState = {
      turnIndex: 1,
      setterId: setter.id,
      guesserId: guesser.id,
      word: null,
      attemptsRemaining: TWENTY_Q_MAX_ATTEMPTS
    };
    room.gameData.twentyQuestions = state;

    return {
      roomId,
      setterId: state.setterId,
      guesserId: state.guesserId,
      attemptsRemaining: state.attemptsRemaining,
      turnIndex: state.turnIndex
    };
  }

  setTwentyQuestionsWord(socketId: string, word: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    const state = room.gameData.twentyQuestions as TwentyQuestionsState | undefined;
    if (!state) {
      throw new Error('Aucune manche 20 Questions en cours.');
    }

    if (state.setterId !== socketId) {
      throw new Error('Vous n’êtes pas le meneur de cette manche.');
    }

    state.word = word.trim().toLowerCase();
    return { roomId };
  }

  submitTwentyQuestionsGuess(socketId: string, guess: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    const state = room.gameData.twentyQuestions as TwentyQuestionsState | undefined;
    if (!state) {
      throw new Error('Aucune manche 20 Questions en cours.');
    }

    if (state.guesserId !== socketId) {
      throw new Error('Vous n’êtes pas le devineur de cette manche.');
    }

    if (!state.word) {
      throw new Error('Le mot n’est pas encore défini.');
    }

    return { roomId, guess: guess.trim(), attemptsRemaining: state.attemptsRemaining };
  }

  judgeTwentyQuestionsGuess(socketId: string, correct: boolean, hint?: string) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) {
      throw new Error('Vous n’êtes pas dans une salle.');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Salle introuvable.');
    }

    const state = room.gameData.twentyQuestions as TwentyQuestionsState | undefined;
    if (!state) {
      throw new Error('Aucune manche 20 Questions en cours.');
    }

    if (state.setterId !== socketId) {
      throw new Error('Vous n’êtes pas le meneur de cette manche.');
    }

    if (!correct) {
      state.attemptsRemaining -= 1;
    }

    const roundOver = correct || state.attemptsRemaining <= 0;

    if (!roundOver) {
      return {
        roomId,
        correct: false,
        hint,
        attemptsRemaining: state.attemptsRemaining,
        roundOver: false,
        turnIndex: state.turnIndex,
        nextSetterId: null as string | null,
        nextGuesserId: null as string | null,
        scores: { ...room.scores },
        matchOver: false,
        isDraw: false,
        winnerId: null as string | null
      };
    }

    const roundScore = correct ? state.attemptsRemaining : 0;
    room.scores[state.guesserId] = (room.scores[state.guesserId] ?? 0) + roundScore;

    const turnIndex = state.turnIndex;
    const matchDone = turnIndex >= TWENTY_Q_MAX_TURNS;

    let nextSetterId: string | null = null;
    let nextGuesserId: string | null = null;

    if (!matchDone) {
      nextSetterId = state.guesserId;
      nextGuesserId = state.setterId;
      room.gameData.twentyQuestions = {
        turnIndex: turnIndex + 1,
        setterId: nextSetterId,
        guesserId: nextGuesserId,
        word: null,
        attemptsRemaining: TWENTY_Q_MAX_ATTEMPTS
      } as TwentyQuestionsState;
    } else {
      delete room.gameData.twentyQuestions;
    }

    let winnerId: string | null = null;
    let isDraw = false;

    if (matchDone) {
      const [p0, p1] = room.players;
      const s0 = room.scores[p0.id] ?? 0;
      const s1 = room.scores[p1.id] ?? 0;
      if (s0 === s1) {
        isDraw = true;
      } else {
        winnerId = s0 > s1 ? p0.id : p1.id;
      }
    }

    return {
      roomId,
      correct,
      hint,
      attemptsRemaining: state.attemptsRemaining,
      roundOver: true,
      turnIndex,
      nextSetterId,
      nextGuesserId,
      scores: { ...room.scores },
      matchOver: matchDone,
      isDraw,
      winnerId
    };
  }

  private pickIndexExcluding(length: number, excluded: Set<number>): number {
    const all = Array.from({ length }, (_, i) => i);
    const available = all.filter(i => !excluded.has(i));
    const pool = available.length > 0 ? available : all;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private getRpsWinner(firstChoice: string, secondChoice: string): 'first' | 'second' | 'draw' {
    if (firstChoice === secondChoice) {
      return 'draw';
    }

    const beats: Record<string, string> = {
      pierre: 'ciseau',
      feuille: 'pierre',
      ciseau: 'feuille'
    };

    return beats[firstChoice] === secondChoice ? 'first' : 'second';
  }
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `cd backend && npx tsc --noEmit`
Expected: erreurs uniquement dans `index.ts` (attendu — corrigé à la Task 3), aucune erreur dans `roomManager.ts`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/roomManager.ts
git commit -m "feat: add full RoomManager logic for odd-or-even, would-you-rather, two-truths-one-lie, truth-or-dare, twenty-questions"
```

---

### Task 3: `index.ts` — routage des 5 jeux vers `RoomManager`

**Files:**
- Modify: `backend/src/index.ts` (remplacement intégral)

**Interfaces:**
- Consumes: toutes les méthodes `RoomManager` de la Task 2, `ServerEvents`/`ClientEvents` (déjà corrects depuis la Task 1).

- [ ] **Step 1: Remplacer le contenu du fichier**

Remplacer entièrement `backend/src/index.ts` par :

```ts
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { ServerEvents, ClientEvents } from './events.js';
import { RoomManager } from './roomManager.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST']
  }
});

const roomManager = new RoomManager();

app.use(cors({ origin: true }));
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'Backend Socket.IO en marche' });
});

io.on(ClientEvents.Connect, socket => {
  console.log(`Client connecté: ${socket.id}`);
  socket.emit(ServerEvents.Greeting, { type: ServerEvents.Greeting, payload: 'Bonjour depuis le backend Socket.IO !' });

  socket.on(ServerEvents.Hello, data => {
    console.log('Message du client:', data);
    socket.emit(ServerEvents.Greeting, {
      type: ServerEvents.Greeting,
      payload: `Salut client ${socket.id}, reçu : ${JSON.stringify(data)}`
    });
  });

  socket.on(ClientEvents.CreateRoom, ({ name, gameId }: { name: string; gameId: string }) => {
    try {
      const { roomId, players } = roomManager.createRoom(socket.id, name, gameId);
      socket.join(roomId);
      socket.emit(ServerEvents.RoomCreated, { roomId, players });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ClientEvents.JoinRoom, ({ roomId, name, gameId }: { roomId: string; name: string; gameId: string }) => {
    try {
      const players = roomManager.joinRoom(roomId, socket.id, name, gameId);
      socket.join(roomId);
      io.to(roomId).emit(ServerEvents.RoomUpdate, { roomId, players });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ClientEvents.LeaveRoom, () => {
    const room = roomManager.leaveRoom(socket.id);
    if (room) {
      socket.leave(room.roomId);
      io.to(room.roomId).emit(ServerEvents.RoomUpdate, { roomId: room.roomId, players: room.players });
    }
  });

  socket.on(ServerEvents.RpsPlay, ({ choice }) => {
    try {
      const result = roomManager.setRpsChoice(socket.id, choice);
      if (!result) {
        socket.emit(ServerEvents.Greeting, { type: ServerEvents.Greeting, payload: 'Choix reçu, en attente du second joueur.' });
        return;
      }

      for (const entry of result.entries) {
        io.to(entry.socketId).emit(ServerEvents.RpsResult, {
          yourMove: entry.yourMove,
          opponentMove: entry.opponentMove,
          outcome: entry.outcome,
          scores: result.scores,
          matchOver: result.matchOver,
          winnerId: result.winnerId
        });
      }
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ClientEvents.ResetMatchScore, () => {
    try {
      const { roomId, scores } = roomManager.resetScores(socket.id);
      io.to(roomId).emit(ServerEvents.ScoreReset, { scores });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.OddOrEvenPlay, ({ value, prediction }) => {
    try {
      const result = roomManager.setOddOrEvenChoice(socket.id, value, prediction);
      if (!result) {
        socket.emit(ServerEvents.Greeting, { type: ServerEvents.Greeting, payload: 'Choix reçu, en attente du second joueur.' });
        return;
      }

      for (const entry of result.entries) {
        io.to(entry.socketId).emit(ServerEvents.OddOrEvenResult, {
          yourValue: entry.yourValue,
          yourPrediction: entry.yourPrediction,
          opponentValue: entry.opponentValue,
          opponentPrediction: entry.opponentPrediction,
          sum: entry.sum,
          parity: entry.parity,
          outcome: entry.outcome,
          scores: result.scores,
          matchOver: result.matchOver,
          winnerId: result.winnerId
        });
      }
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.TruthOrDareStart, () => {
    try {
      const result = roomManager.startTruthOrDare(socket.id);
      io.to(result.roomId).emit(ServerEvents.TruthOrDareSpin, {
        activePlayerId: result.activePlayerId,
        activePlayerName: result.activePlayerName
      });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.TruthOrDareChoice, ({ type }) => {
    try {
      const result = roomManager.chooseTruthOrDareType(socket.id, type);
      io.to(result.roomId).emit(ServerEvents.TruthOrDareContent, { type: result.type, text: result.text });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ClientEvents.TruthOrDareAnswer, ({ answer }) => {
    try {
      const result = roomManager.submitTruthOrDareAnswer(socket.id, answer);
      io.to(result.roomId).emit(ServerEvents.TruthOrDareAnswerSubmitted, { answer: result.answer });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ClientEvents.TruthOrDareValidate, ({ approved }) => {
    try {
      const result = roomManager.validateTruthOrDare(socket.id, approved);
      io.to(result.roomId).emit(ServerEvents.TruthOrDareResult, {
        approved: result.approved,
        activePlayerId: result.activePlayerId,
        scores: result.scores,
        matchOver: result.matchOver,
        winnerId: result.winnerId
      });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.WouldYouRatherStart, () => {
    try {
      const result = roomManager.startWouldYouRatherRound(socket.id);
      io.to(result.roomId).emit(ServerEvents.WouldYouRatherUpdate, { prompt: result.prompt });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.WouldYouRatherChoice, ({ selected }) => {
    try {
      const result = roomManager.setWouldYouRatherChoice(socket.id, selected);
      if (!result) {
        socket.emit(ServerEvents.Greeting, { type: ServerEvents.Greeting, payload: 'Choix reçu, en attente du second joueur.' });
        return;
      }

      for (const entry of result.entries) {
        io.to(entry.socketId).emit(ServerEvents.WouldYouRatherResult, {
          yourChoice: entry.yourChoice,
          opponentChoice: entry.opponentChoice,
          sameChoice: result.sameChoice,
          scores: result.scores,
          matchOver: result.matchOver,
          winnerId: result.winnerId
        });
      }
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.TwentyQuestionsSetWord, ({ word }) => {
    try {
      roomManager.setTwentyQuestionsWord(socket.id, word);
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.TwentyQuestionsGuess, ({ guess }) => {
    try {
      const result = roomManager.submitTwentyQuestionsGuess(socket.id, guess);
      io.to(result.roomId).emit(ServerEvents.TwentyQuestionsGuessSubmitted, {
        guess: result.guess,
        attemptsRemaining: result.attemptsRemaining
      });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.TwentyQuestionsJudge, ({ correct, hint }) => {
    try {
      const result = roomManager.judgeTwentyQuestionsGuess(socket.id, correct, hint);
      io.to(result.roomId).emit(ServerEvents.TwentyQuestionsRoundResult, {
        correct: result.correct,
        hint: result.hint,
        attemptsRemaining: result.attemptsRemaining,
        roundOver: result.roundOver,
        turnIndex: result.turnIndex,
        nextSetterId: result.nextSetterId,
        nextGuesserId: result.nextGuesserId,
        scores: result.scores,
        matchOver: result.matchOver,
        isDraw: result.isDraw,
        winnerId: result.winnerId
      });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.TwoTruthsOneLieSubmit, ({ statements }) => {
    try {
      const roomId = roomManager.getRoomId(socket.id);
      if (!roomId) {
        throw new Error('Vous n’êtes pas dans une salle.');
      }

      const lieIndex = Math.floor(Math.random() * statements.length);
      roomManager.setGameData(socket.id, 'twoTruthsOneLie', { statements, lieIndex, submitter: socket.id });
      io.to(roomId).emit(ServerEvents.TwoTruthsOneLiePrompt, {
        statements,
        message: 'Un joueur a soumis 2 vérités et 1 mensonge. Votez pour la phrase mensonge.'
      });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.TwoTruthsOneLieVote, ({ voteIndex }) => {
    try {
      const result = roomManager.voteTwoTruthsOneLie(socket.id, voteIndex);
      io.to(result.roomId).emit(ServerEvents.TwoTruthsOneLieResult, {
        voterSocketId: result.voterSocketId,
        correct: result.correct,
        lieIndex: result.lieIndex,
        scores: result.scores,
        matchOver: result.matchOver,
        winnerId: result.winnerId
      });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ServerEvents.StartGame, ({ roomId }) => {
    try {
      const ownerRoomId = roomManager.getRoomId(socket.id);
      if (!ownerRoomId || ownerRoomId !== roomId) {
        throw new Error('Impossible de démarrer la partie pour ce salon.');
      }

      const roomPlayers = roomManager.getPlayers(roomId);
      if (roomPlayers.length < 2) {
        throw new Error('Il faut au moins 2 joueurs pour démarrer la partie.');
      }

      io.to(roomId).emit(ServerEvents.GameStarted, { roomId });

      if (roomManager.getGameId(roomId) === '20-questions') {
        const round = roomManager.beginTwentyQuestionsMatch(socket.id);
        io.to(roomId).emit(ServerEvents.TwentyQuestionsRoundReady, {
          setterId: round.setterId,
          guesserId: round.guesserId,
          attemptsRemaining: round.attemptsRemaining,
          turnIndex: round.turnIndex
        });
      }
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });

  socket.on(ClientEvents.Disconnect, reason => {
    console.log(`Client déconnecté: ${socket.id} (${reason})`);
    const room = roomManager.leaveRoom(socket.id);
    if (room) {
      io.to(room.roomId).emit(ServerEvents.RoomUpdate, { roomId: room.roomId, players: room.players });
    }
  });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
server.listen(PORT, () => {
  console.log(`Serveur backend démarré sur http://localhost:${PORT}`);
});
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `cd backend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add backend/src/index.ts
git commit -m "feat: route odd-or-even, would-you-rather, two-truths-one-lie, truth-or-dare, twenty-questions events through RoomManager"
```

---

### Task 4: `useGameStore` — champ `scores` partagé + branchement dans `RpsMultiplayer`

**Files:**
- Modify: `frontend/src/store/useGameStore.ts`
- Modify: `frontend/src/games/multiplayer/RpsMultiplayer.tsx`

**Interfaces:**
- Produces: `useGameStore` gagne `scores: Record<string, number>` et `setScores: (scores: Record<string, number>) => void`, remis à `{}` par `reset()`.
- Consumed by: Task 5 à 9 (les 5 nouveaux composants), Task 11 (`ResultsPage`).

- [ ] **Step 1: Étendre le store**

Dans `frontend/src/store/useGameStore.ts`, remplacer :

```ts
type GameState = {
  gameId: string | null;
  roomCode: string | null;
  players: Player[];
  status: GameStatus;
  error: string | null;
  setGameId: (gameId: string | null) => void;
  setRoomCode: (roomCode: string | null) => void;
  setPlayers: (players: Player[]) => void;
  setStatus: (status: GameStatus) => void;
  setError: (error: string | null) => void;
  reset: () => void;
};

export const useGameStore = create<GameState>(set => ({
  gameId: null,
  roomCode: null,
  players: [],
  status: 'idle',
  error: null,
  setGameId: gameId => set({ gameId }),
  setRoomCode: roomCode => set({ roomCode }),
  setPlayers: players => set({ players }),
  setStatus: status => set({ status }),
  setError: error => set({ error }),
  reset: () => set({ gameId: null, roomCode: null, players: [], status: 'idle', error: null })
}));
```

par :

```ts
type GameState = {
  gameId: string | null;
  roomCode: string | null;
  players: Player[];
  status: GameStatus;
  error: string | null;
  scores: Record<string, number>;
  setGameId: (gameId: string | null) => void;
  setRoomCode: (roomCode: string | null) => void;
  setPlayers: (players: Player[]) => void;
  setStatus: (status: GameStatus) => void;
  setError: (error: string | null) => void;
  setScores: (scores: Record<string, number>) => void;
  reset: () => void;
};

export const useGameStore = create<GameState>(set => ({
  gameId: null,
  roomCode: null,
  players: [],
  status: 'idle',
  error: null,
  scores: {},
  setGameId: gameId => set({ gameId }),
  setRoomCode: roomCode => set({ roomCode }),
  setPlayers: players => set({ players }),
  setStatus: status => set({ status }),
  setError: error => set({ error }),
  setScores: scores => set({ scores }),
  reset: () => set({ gameId: null, roomCode: null, players: [], status: 'idle', error: null, scores: {} })
}));
```

- [ ] **Step 2: Brancher `RpsMultiplayer` sur `setScores`**

Dans `frontend/src/games/multiplayer/RpsMultiplayer.tsx`, ajouter l'import et l'action du store. Remplacer :

```ts
  const { socket, socketId } = useSocket();
  const players = useGameStore(state => state.players);
```

par :

```ts
  const { socket, socketId } = useSocket();
  const players = useGameStore(state => state.players);
  const setStoreScores = useGameStore(state => state.setScores);
```

Puis, dans `handleResult`, remplacer :

```ts
    const handleResult = (data: RpsResultPayload) => {
      setWaiting(false);
      setRound({ yourMove: data.yourMove, opponentMove: data.opponentMove, outcome: data.outcome });
      setScores(data.scores);
      setMatchOver(data.matchOver);
      setWinner(data.winnerId ? (data.winnerId === socketId ? 'player' : 'machine') : null);
    };
```

par :

```ts
    const handleResult = (data: RpsResultPayload) => {
      setWaiting(false);
      setRound({ yourMove: data.yourMove, opponentMove: data.opponentMove, outcome: data.outcome });
      setScores(data.scores);
      setStoreScores(data.scores);
      setMatchOver(data.matchOver);
      setWinner(data.winnerId ? (data.winnerId === socketId ? 'player' : 'machine') : null);
    };
```

et, dans `handleScoreReset`, remplacer :

```ts
    const handleScoreReset = (data: { scores: Record<string, number> }) => {
      setScores(data.scores);
      setMatchOver(false);
      setWinner(null);
      setRound(null);
      setWaiting(false);
    };
```

par :

```ts
    const handleScoreReset = (data: { scores: Record<string, number> }) => {
      setScores(data.scores);
      setStoreScores(data.scores);
      setMatchOver(false);
      setWinner(null);
      setRound(null);
      setWaiting(false);
    };
```

Enfin, ajouter `setStoreScores` au tableau de dépendances du `useEffect` :

Remplacer `}, [socket, socketId]);` par `}, [socket, socketId, setStoreScores]);`

- [ ] **Step 3: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/store/useGameStore.ts frontend/src/games/multiplayer/RpsMultiplayer.tsx
git commit -m "feat: track per-room scores in useGameStore, sync from RpsMultiplayer"
```

---

### Task 5: Nouveau composant `OddOrEvenMultiplayer`

**Files:**
- Create: `frontend/src/games/multiplayer/OddOrEvenMultiplayer.tsx`

**Interfaces:**
- Consumes: `useSocket`, `useGameStore` (Task 4, champ `scores`/`setScores`), `ClientEvents`/`ServerEvents`, `ScorePill`, `MatchEndOverlay`, `FlipReveal`, `NumberTokenPicker`, `type Winner` (`@/lib/soloScore`). Payload `OddOrEvenResult` produit par `RoomManager.setOddOrEvenChoice` (Task 2/3) : `{ yourValue, yourPrediction, opponentValue, opponentPrediction, sum, parity, outcome, scores, matchOver, winnerId }`.
- Produces: `OddOrEvenMultiplayer(): JSX.Element`. Consommé par Task 10 (`GamePlayPage.tsx`).

- [ ] **Step 1: Créer le composant**

Créer `frontend/src/games/multiplayer/OddOrEvenMultiplayer.tsx` :

```tsx
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/store/useGameStore';
import { ClientEvents, ServerEvents } from '@/lib/socketEvents';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { FlipReveal } from '@/components/solo/reveals/FlipReveal';
import { NumberTokenPicker } from '@/components/solo/NumberTokenPicker';
import type { Winner } from '@/lib/soloScore';

const ODD_OR_EVEN_TARGET_SCORE = 5;
type Parity = 'pair' | 'impair';
const PARITIES: Parity[] = ['pair', 'impair'];

type RoundResult = {
  yourValue: number;
  yourPrediction: Parity;
  opponentValue: number;
  opponentPrediction: Parity;
  sum: number;
  parity: Parity;
  outcome: 'player' | 'machine' | 'draw';
};

type OddOrEvenResultPayload = RoundResult & {
  scores: Record<string, number>;
  matchOver: boolean;
  winnerId: string | null;
};

export function OddOrEvenMultiplayer() {
  const { socket, socketId } = useSocket();
  const players = useGameStore(state => state.players);
  const setStoreScores = useGameStore(state => state.setScores);
  const [playerNumber, setPlayerNumber] = useState(1);
  const [prediction, setPrediction] = useState<Parity>('pair');
  const [waiting, setWaiting] = useState(false);
  const [round, setRound] = useState<RoundResult | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [matchOver, setMatchOver] = useState(false);
  const [winner, setWinner] = useState<Winner>(null);

  useEffect(() => {
    if (!socket || !socketId) {
      return;
    }

    const handleResult = (data: OddOrEvenResultPayload) => {
      setWaiting(false);
      setRound({
        yourValue: data.yourValue,
        yourPrediction: data.yourPrediction,
        opponentValue: data.opponentValue,
        opponentPrediction: data.opponentPrediction,
        sum: data.sum,
        parity: data.parity,
        outcome: data.outcome
      });
      setScores(data.scores);
      setStoreScores(data.scores);
      setMatchOver(data.matchOver);
      setWinner(data.winnerId ? (data.winnerId === socketId ? 'player' : 'machine') : null);
    };

    const handleScoreReset = (data: { scores: Record<string, number> }) => {
      setScores(data.scores);
      setStoreScores(data.scores);
      setMatchOver(false);
      setWinner(null);
      setRound(null);
      setWaiting(false);
    };

    socket.on(ServerEvents.OddOrEvenResult, handleResult);
    socket.on(ServerEvents.ScoreReset, handleScoreReset);

    return () => {
      socket.off(ServerEvents.OddOrEvenResult, handleResult);
      socket.off(ServerEvents.ScoreReset, handleScoreReset);
    };
  }, [socket, socketId, setStoreScores]);

  const me = players.find(player => player.id === socketId) ?? null;
  const opponent = players.find(player => player.id !== socketId) ?? null;
  const myScore = socketId ? scores[socketId] ?? 0 : 0;
  const opponentScore = opponent ? scores[opponent.id] ?? 0 : 0;

  const playRound = () => {
    if (!socket || waiting || round || matchOver) {
      return;
    }
    socket.emit(ClientEvents.OddOrEvenPlay, { value: playerNumber, prediction });
    setWaiting(true);
  };

  const handleRevealComplete = () => {
    setRound(null);
  };

  const handleReplay = () => {
    if (!socket) {
      return;
    }
    socket.emit(ClientEvents.ResetMatchScore);
  };

  return (
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">
      <ScorePill
        player={myScore}
        machine={opponentScore}
        targetScore={ODD_OR_EVEN_TARGET_SCORE}
        onReset={handleReplay}
        playerLabel={`${me?.name ?? 'Vous'} (vous)`}
        machineLabel={opponent?.name ?? 'Adversaire'}
      />

      {round ? (
        <FlipReveal
          cards={[
            { id: 'player', content: round.yourValue, highlight: round.outcome === 'player' },
            { id: 'opponent', content: round.opponentValue, highlight: round.outcome === 'machine' }
          ]}
          outcomeLabel={`Somme ${round.sum} (${round.parity})`}
          onComplete={handleRevealComplete}
        />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {waiting ? 'Choix envoyé, en attente de l’adversaire...' : 'Choisissez un chiffre de 1 à 9 et prédisez la parité de la somme.'}
          </p>

          <NumberTokenPicker value={playerNumber} onChange={setPlayerNumber} disabled={waiting || matchOver} />

          <div className="flex gap-3">
            {PARITIES.map(parity => (
              <Button
                key={parity}
                type="button"
                variant={prediction === parity ? 'default' : 'outline'}
                onClick={() => setPrediction(parity)}
                disabled={waiting || matchOver}
              >
                {parity === 'pair' ? 'Pair' : 'Impair'}
              </Button>
            ))}
          </div>

          <Button type="button" onClick={playRound} disabled={waiting || matchOver}>
            Jouer la manche
          </Button>
        </div>
      )}

      <MatchEndOverlay winner={winner} onReplay={handleReplay} />
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/games/multiplayer/OddOrEvenMultiplayer.tsx
git commit -m "feat: add OddOrEvenMultiplayer component with score, FlipReveal and match-end overlay"
```

---

### Task 6: Nouveau composant `WouldYouRatherMultiplayer`

**Files:**
- Create: `frontend/src/games/multiplayer/WouldYouRatherMultiplayer.tsx`

**Interfaces:**
- Consumes: `useSocket`, `useGameStore` (Task 4), `ClientEvents`/`ServerEvents`, `ScorePill`, `MatchEndOverlay`, `BurstReveal`, `type Winner`. `WouldYouRatherUpdate` payload `{ prompt: { left, right } }`, `WouldYouRatherResult` payload `{ yourChoice, opponentChoice, sameChoice, scores, matchOver, winnerId }` (Task 2/3).
- Produces: `WouldYouRatherMultiplayer(): JSX.Element`. Consommé par Task 10.

- [ ] **Step 1: Créer le composant**

Créer `frontend/src/games/multiplayer/WouldYouRatherMultiplayer.tsx` :

```tsx
import { useEffect, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/store/useGameStore';
import { ClientEvents, ServerEvents } from '@/lib/socketEvents';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { BurstReveal } from '@/components/solo/reveals/BurstReveal';
import type { Winner } from '@/lib/soloScore';

const TARGET_SCORE = 5;
type Side = 'left' | 'right';
type Prompt = { left: string; right: string };

type RoundResult = { yourChoice: Side; opponentChoice: Side; sameChoice: boolean };

type WouldYouRatherResultPayload = RoundResult & {
  scores: Record<string, number>;
  matchOver: boolean;
  winnerId: string | null;
};

export function WouldYouRatherMultiplayer() {
  const { socket, socketId } = useSocket();
  const players = useGameStore(state => state.players);
  const setStoreScores = useGameStore(state => state.setScores);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [round, setRound] = useState<RoundResult | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [matchOver, setMatchOver] = useState(false);
  const [winner, setWinner] = useState<Winner>(null);

  useEffect(() => {
    if (!socket || !socketId) {
      return;
    }

    const handleUpdate = (data: { prompt: Prompt }) => {
      setPrompt(data.prompt);
      setWaiting(false);
    };

    const handleResult = (data: WouldYouRatherResultPayload) => {
      setWaiting(false);
      setRound({ yourChoice: data.yourChoice, opponentChoice: data.opponentChoice, sameChoice: data.sameChoice });
      setScores(data.scores);
      setStoreScores(data.scores);
      setMatchOver(data.matchOver);
      setWinner(data.winnerId ? (data.winnerId === socketId ? 'player' : 'machine') : null);
    };

    const handleScoreReset = (data: { scores: Record<string, number> }) => {
      setScores(data.scores);
      setStoreScores(data.scores);
      setMatchOver(false);
      setWinner(null);
      setRound(null);
      setPrompt(null);
      setWaiting(false);
    };

    socket.on(ServerEvents.WouldYouRatherUpdate, handleUpdate);
    socket.on(ServerEvents.WouldYouRatherResult, handleResult);
    socket.on(ServerEvents.ScoreReset, handleScoreReset);

    return () => {
      socket.off(ServerEvents.WouldYouRatherUpdate, handleUpdate);
      socket.off(ServerEvents.WouldYouRatherResult, handleResult);
      socket.off(ServerEvents.ScoreReset, handleScoreReset);
    };
  }, [socket, socketId, setStoreScores]);

  useEffect(() => {
    if (!socket || matchOver || round || prompt) {
      return;
    }
    if (players[0]?.id !== socketId) {
      return;
    }
    socket.emit(ClientEvents.WouldYouRatherStart);
  }, [socket, socketId, players, matchOver, round, prompt]);

  const me = players.find(player => player.id === socketId) ?? null;
  const opponent = players.find(player => player.id !== socketId) ?? null;
  const myScore = socketId ? scores[socketId] ?? 0 : 0;
  const opponentScore = opponent ? scores[opponent.id] ?? 0 : 0;

  const chooseOption = (side: Side) => {
    if (!socket || waiting || round || matchOver || !prompt) {
      return;
    }
    socket.emit(ClientEvents.WouldYouRatherChoice, { selected: side });
    setWaiting(true);
  };

  const handleRevealComplete = () => {
    setRound(null);
    setPrompt(null);
  };

  const handleReplay = () => {
    if (!socket) {
      return;
    }
    socket.emit(ClientEvents.ResetMatchScore);
  };

  return (
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">
      <ScorePill
        player={myScore}
        machine={opponentScore}
        targetScore={TARGET_SCORE}
        onReset={handleReplay}
        playerLabel={`${me?.name ?? 'Vous'} (vous)`}
        machineLabel={opponent?.name ?? 'Adversaire'}
      />

      {round && prompt ? (
        <BurstReveal
          icon={round.sameChoice ? 'success' : 'neutral'}
          headline={`Vous : « ${prompt[round.yourChoice]} »`}
          detail={`${opponent?.name ?? 'Adversaire'} : « ${prompt[round.opponentChoice]} » ${
            round.sameChoice ? '— même choix, +1 chacun !' : '— choix différents cette fois.'
          }`}
          onComplete={handleRevealComplete}
        />
      ) : prompt ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{waiting ? 'Choix envoyé, en attente de l’adversaire...' : 'Tu préfères...'}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => chooseOption('left')}
              disabled={waiting || matchOver}
              className="h-auto whitespace-normal rounded-2xl border-2 border-border bg-card px-4 py-3 text-left text-sm font-medium text-foreground transition-all hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {prompt.left}
            </button>
            <button
              type="button"
              onClick={() => chooseOption('right')}
              disabled={waiting || matchOver}
              className="h-auto whitespace-normal rounded-2xl border-2 border-border bg-card px-4 py-3 text-left text-sm font-medium text-foreground transition-all hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {prompt.right}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Chargement du dilemme...</p>
      )}

      <MatchEndOverlay winner={winner} onReplay={handleReplay} />
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/games/multiplayer/WouldYouRatherMultiplayer.tsx
git commit -m "feat: add WouldYouRatherMultiplayer component with same-choice scoring and BurstReveal"
```

---

### Task 7: Nouveau composant `TwoTruthsOneLieMultiplayer`

**Files:**
- Create: `frontend/src/games/multiplayer/TwoTruthsOneLieMultiplayer.tsx`

**Interfaces:**
- Consumes: `useSocket`, `useGameStore` (Task 4), `ClientEvents`/`ServerEvents`, `ScorePill`, `MatchEndOverlay`, `BurstReveal`, `type Winner`. `TwoTruthsOneLiePrompt` payload `{ statements: string[], message: string }`, `TwoTruthsOneLieResult` payload `{ voterSocketId, correct, lieIndex, scores, matchOver, winnerId }` (Task 2/3).
- Produces: `TwoTruthsOneLieMultiplayer(): JSX.Element`. Consommé par Task 10.

- [ ] **Step 1: Créer le composant**

Créer `frontend/src/games/multiplayer/TwoTruthsOneLieMultiplayer.tsx` :

```tsx
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/store/useGameStore';
import { ClientEvents, ServerEvents } from '@/lib/socketEvents';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { BurstReveal } from '@/components/solo/reveals/BurstReveal';
import type { Winner } from '@/lib/soloScore';

const TARGET_SCORE = 5;

type ResultPayload = {
  voterSocketId: string;
  correct: boolean;
  lieIndex: number;
  scores: Record<string, number>;
  matchOver: boolean;
  winnerId: string | null;
};

export function TwoTruthsOneLieMultiplayer() {
  const { socket, socketId } = useSocket();
  const players = useGameStore(state => state.players);
  const setStoreScores = useGameStore(state => state.setScores);
  const [statements, setStatements] = useState(['', '', '']);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [votingStatements, setVotingStatements] = useState<string[] | null>(null);
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [matchOver, setMatchOver] = useState(false);
  const [winner, setWinner] = useState<Winner>(null);

  useEffect(() => {
    if (!socket || !socketId) {
      return;
    }

    const handlePrompt = (data: { statements: string[] }) => {
      setVotingStatements(data.statements);
    };

    const handleResult = (data: ResultPayload) => {
      setResult(data);
      setScores(data.scores);
      setStoreScores(data.scores);
      setMatchOver(data.matchOver);
      setWinner(data.winnerId ? (data.winnerId === socketId ? 'player' : 'machine') : null);
    };

    const handleScoreReset = (data: { scores: Record<string, number> }) => {
      setScores(data.scores);
      setStoreScores(data.scores);
      setMatchOver(false);
      setWinner(null);
      setResult(null);
      setVotingStatements(null);
      setHasSubmitted(false);
      setStatements(['', '', '']);
    };

    socket.on(ServerEvents.TwoTruthsOneLiePrompt, handlePrompt);
    socket.on(ServerEvents.TwoTruthsOneLieResult, handleResult);
    socket.on(ServerEvents.ScoreReset, handleScoreReset);

    return () => {
      socket.off(ServerEvents.TwoTruthsOneLiePrompt, handlePrompt);
      socket.off(ServerEvents.TwoTruthsOneLieResult, handleResult);
      socket.off(ServerEvents.ScoreReset, handleScoreReset);
    };
  }, [socket, socketId, setStoreScores]);

  const me = players.find(player => player.id === socketId) ?? null;
  const opponent = players.find(player => player.id !== socketId) ?? null;
  const myScore = socketId ? scores[socketId] ?? 0 : 0;
  const opponentScore = opponent ? scores[opponent.id] ?? 0 : 0;

  const submitStatements = () => {
    if (!socket || matchOver) {
      return;
    }
    const cleaned = statements.map(statement => statement.trim());
    if (cleaned.some(text => !text)) {
      return;
    }
    socket.emit(ClientEvents.TwoTruthsOneLieSubmit, { statements: cleaned });
    setHasSubmitted(true);
  };

  const vote = (voteIndex: number) => {
    if (!socket || matchOver) {
      return;
    }
    socket.emit(ClientEvents.TwoTruthsOneLieVote, { voteIndex });
  };

  const handleRevealComplete = () => {
    setResult(null);
    setVotingStatements(null);
    setHasSubmitted(false);
    setStatements(['', '', '']);
  };

  const handleReplay = () => {
    if (!socket) {
      return;
    }
    socket.emit(ClientEvents.ResetMatchScore);
  };

  const myOutcome = result
    ? result.voterSocketId === socketId
      ? result.correct
        ? 'success'
        : 'fail'
      : result.correct
        ? 'fail'
        : 'success'
    : null;

  return (
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">
      <ScorePill
        player={myScore}
        machine={opponentScore}
        targetScore={TARGET_SCORE}
        onReset={handleReplay}
        playerLabel={`${me?.name ?? 'Vous'} (vous)`}
        machineLabel={opponent?.name ?? 'Adversaire'}
      />

      {result && myOutcome ? (
        <BurstReveal
          icon={myOutcome === 'success' ? 'success' : 'fail'}
          headline={
            result.voterSocketId === socketId
              ? result.correct
                ? 'Bien joué, vous avez trouvé le mensonge !'
                : 'Perdu, ce n’était pas le mensonge.'
              : result.correct
                ? `${opponent?.name ?? 'Adversaire'} a trouvé votre mensonge.`
                : `${opponent?.name ?? 'Adversaire'} s’est trompé, vous gagnez le point !`
          }
          detail={`La phrase ${result.lieIndex + 1} était le mensonge.`}
          onComplete={handleRevealComplete}
        />
      ) : votingStatements && !hasSubmitted ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Un joueur a soumis 3 affirmations. Votez pour le mensonge.</p>
          <div className="grid gap-3">
            {votingStatements.map((statement, index) => (
              <Button
                key={index}
                type="button"
                variant="outline"
                onClick={() => vote(index)}
                disabled={matchOver}
                className="h-auto justify-start whitespace-normal px-4 py-3 text-left"
              >
                {statement}
              </Button>
            ))}
          </div>
        </div>
      ) : hasSubmitted ? (
        <p className="text-sm text-muted-foreground">Affirmations envoyées. En attente du vote de l’adversaire...</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Écrivez 2 vérités et 1 mensonge sur vous.</p>
          <div className="grid gap-3">
            {statements.map((text, index) => (
              <input
                key={index}
                value={text}
                onChange={event => setStatements(prev => prev.map((item, idx) => (idx === index ? event.target.value : item)))}
                placeholder={`Affirmation ${index + 1}`}
                disabled={matchOver}
                className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            ))}
          </div>
          <Button type="button" onClick={submitStatements} disabled={matchOver}>
            Soumettre
          </Button>
        </div>
      )}

      <MatchEndOverlay winner={winner} onReplay={handleReplay} />
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/games/multiplayer/TwoTruthsOneLieMultiplayer.tsx
git commit -m "feat: add TwoTruthsOneLieMultiplayer component with room-tracked score and BurstReveal"
```

---

### Task 8: Nouveau composant `TruthOrDareMultiplayer`

**Files:**
- Create: `frontend/src/games/multiplayer/TruthOrDareMultiplayer.tsx`

**Interfaces:**
- Consumes: `useSocket`, `useGameStore` (Task 4), `ClientEvents`/`ServerEvents`, `ScorePill`, `MatchEndOverlay`, `PlayerWheel`, `BurstReveal`, `type Winner`. Payloads (Task 2/3) : `TruthOrDareSpin { activePlayerId, activePlayerName }`, `TruthOrDareContent { type: 'action'|'truth', text }`, `TruthOrDareAnswerSubmitted { answer }`, `TruthOrDareResult { approved, activePlayerId, scores, matchOver, winnerId }`.
- Produces: `TruthOrDareMultiplayer(): JSX.Element`. Consommé par Task 10.

- [ ] **Step 1: Créer le composant**

Créer `frontend/src/games/multiplayer/TruthOrDareMultiplayer.tsx` :

```tsx
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/store/useGameStore';
import { ClientEvents, ServerEvents } from '@/lib/socketEvents';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { PlayerWheel } from '@/components/solo/PlayerWheel';
import { BurstReveal } from '@/components/solo/reveals/BurstReveal';
import type { Winner } from '@/lib/soloScore';

const TARGET_SCORE = 5;

type Phase = 'idle' | 'spinning' | 'choosing' | 'content' | 'result';
type ContentType = 'action' | 'truth';

export function TruthOrDareMultiplayer() {
  const { socket, socketId } = useSocket();
  const players = useGameStore(state => state.players);
  const setStoreScores = useGameStore(state => state.setScores);
  const [phase, setPhase] = useState<Phase>('idle');
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [activePlayerName, setActivePlayerName] = useState<string | null>(null);
  const [content, setContent] = useState<{ type: ContentType; text: string } | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [answerDraft, setAnswerDraft] = useState('');
  const [resultApproved, setResultApproved] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [matchOver, setMatchOver] = useState(false);
  const [winner, setWinner] = useState<Winner>(null);

  useEffect(() => {
    if (!socket || !socketId) {
      return;
    }

    const handleSpin = (data: { activePlayerId: string; activePlayerName: string }) => {
      setActivePlayerId(data.activePlayerId);
      setActivePlayerName(data.activePlayerName);
      setContent(null);
      setAnswer(null);
      setAnswerDraft('');
      setPhase('spinning');
    };

    const handleContent = (data: { type: ContentType; text: string }) => {
      setContent(data);
      setPhase('content');
    };

    const handleAnswerSubmitted = (data: { answer: string }) => {
      setAnswer(data.answer);
    };

    const handleResult = (data: { approved: boolean; scores: Record<string, number>; matchOver: boolean; winnerId: string | null }) => {
      setResultApproved(data.approved);
      setScores(data.scores);
      setStoreScores(data.scores);
      setMatchOver(data.matchOver);
      setWinner(data.winnerId ? (data.winnerId === socketId ? 'player' : 'machine') : null);
      setPhase('result');
    };

    const handleScoreReset = (data: { scores: Record<string, number> }) => {
      setScores(data.scores);
      setStoreScores(data.scores);
      setMatchOver(false);
      setWinner(null);
      setPhase('idle');
      setActivePlayerId(null);
      setActivePlayerName(null);
      setContent(null);
      setAnswer(null);
      setAnswerDraft('');
    };

    socket.on(ServerEvents.TruthOrDareSpin, handleSpin);
    socket.on(ServerEvents.TruthOrDareContent, handleContent);
    socket.on(ServerEvents.TruthOrDareAnswerSubmitted, handleAnswerSubmitted);
    socket.on(ServerEvents.TruthOrDareResult, handleResult);
    socket.on(ServerEvents.ScoreReset, handleScoreReset);

    return () => {
      socket.off(ServerEvents.TruthOrDareSpin, handleSpin);
      socket.off(ServerEvents.TruthOrDareContent, handleContent);
      socket.off(ServerEvents.TruthOrDareAnswerSubmitted, handleAnswerSubmitted);
      socket.off(ServerEvents.TruthOrDareResult, handleResult);
      socket.off(ServerEvents.ScoreReset, handleScoreReset);
    };
  }, [socket, socketId, setStoreScores]);

  const me = players.find(player => player.id === socketId) ?? null;
  const opponent = players.find(player => player.id !== socketId) ?? null;
  const myScore = socketId ? scores[socketId] ?? 0 : 0;
  const opponentScore = opponent ? scores[opponent.id] ?? 0 : 0;
  const isActive = socketId !== null && socketId === activePlayerId;

  const startSpin = () => {
    if (!socket || matchOver || phase !== 'idle') {
      return;
    }
    socket.emit(ClientEvents.TruthOrDareStart);
  };

  const handleSpinComplete = () => {
    setPhase('choosing');
  };

  const chooseType = (type: ContentType) => {
    if (!socket || !isActive) {
      return;
    }
    socket.emit(ClientEvents.TruthOrDareChoice, { type });
  };

  const submitAnswer = () => {
    if (!socket || !isActive || !answerDraft.trim()) {
      return;
    }
    socket.emit(ClientEvents.TruthOrDareAnswer, { answer: answerDraft.trim() });
  };

  const validate = (approved: boolean) => {
    if (!socket || isActive) {
      return;
    }
    socket.emit(ClientEvents.TruthOrDareValidate, { approved });
  };

  const handleResultRevealComplete = () => {
    setPhase('idle');
    setActivePlayerId(null);
    setActivePlayerName(null);
    setContent(null);
    setAnswer(null);
    setAnswerDraft('');
  };

  const handleReplay = () => {
    if (!socket) {
      return;
    }
    socket.emit(ClientEvents.ResetMatchScore);
  };

  const needsWrittenAnswer = content?.type === 'truth' && !answer;
  const readyToValidate = content && (content.type === 'action' || answer);

  return (
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">
      <ScorePill
        player={myScore}
        machine={opponentScore}
        targetScore={TARGET_SCORE}
        onReset={handleReplay}
        playerLabel={`${me?.name ?? 'Vous'} (vous)`}
        machineLabel={opponent?.name ?? 'Adversaire'}
      />

      {phase === 'idle' ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Faites tourner la roue pour désigner qui doit relever le défi.</p>
          <Button type="button" onClick={startSpin} disabled={matchOver}>
            Tourner la roue
          </Button>
        </div>
      ) : null}

      {(phase === 'spinning' || (phase === 'choosing' && activePlayerName)) ? (
        <PlayerWheel
          players={players.map(player => player.name)}
          landedOn={activePlayerName ?? ''}
          spinning={phase === 'spinning'}
          onSpinComplete={handleSpinComplete}
        />
      ) : null}

      {phase === 'choosing' ? (
        isActive ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">À vous de choisir : Action ou Vérité ?</p>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => chooseType('truth')}>
                Vérité
              </Button>
              <Button type="button" variant="outline" onClick={() => chooseType('action')}>
                Action
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">En attente du choix de {activePlayerName}...</p>
        )
      ) : null}

      {phase === 'content' && content ? (
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-primary bg-card p-4 text-sm font-medium text-foreground">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {content.type === 'truth' ? 'Vérité' : 'Action'}
            </span>
            {content.text}
          </div>

          {needsWrittenAnswer ? (
            isActive ? (
              <div className="space-y-3">
                <textarea
                  value={answerDraft}
                  onChange={event => setAnswerDraft(event.target.value)}
                  placeholder="Écrivez votre réponse..."
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  rows={3}
                />
                <Button type="button" onClick={submitAnswer} disabled={!answerDraft.trim()}>
                  Envoyer la réponse
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">En attente de la réponse écrite de {activePlayerName}...</p>
            )
          ) : null}

          {answer ? (
            <div className="rounded-2xl border border-border bg-muted p-4 text-sm text-foreground">
              <strong>Réponse :</strong> {answer}
            </div>
          ) : null}

          {readyToValidate ? (
            isActive ? (
              <p className="text-sm text-muted-foreground">En attente de la validation de {opponent?.name ?? 'l’adversaire'}...</p>
            ) : (
              <div className="flex gap-3">
                <Button type="button" onClick={() => validate(true)}>
                  Valider
                </Button>
                <Button type="button" variant="outline" onClick={() => validate(false)}>
                  Refuser
                </Button>
              </div>
            )
          ) : null}
        </div>
      ) : null}

      {phase === 'result' ? (
        <BurstReveal
          icon={resultApproved ? 'success' : 'fail'}
          headline={
            isActive
              ? resultApproved
                ? 'Validé ! +1 point.'
                : 'Refusé, 0 point.'
              : resultApproved
                ? `${activePlayerName} gagne 1 point.`
                : `${activePlayerName} ne gagne pas de point.`
          }
          onComplete={handleResultRevealComplete}
        />
      ) : null}

      <MatchEndOverlay winner={winner} onReplay={handleReplay} />
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/games/multiplayer/TruthOrDareMultiplayer.tsx
git commit -m "feat: add TruthOrDareMultiplayer component with wheel, written answers and peer validation"
```

---

### Task 9: Nouveau composant `TwentyQuestionsMultiplayer`

**Files:**
- Create: `frontend/src/games/multiplayer/TwentyQuestionsMultiplayer.tsx`

**Interfaces:**
- Consumes: `useSocket`, `useGameStore` (Task 4), `ClientEvents`/`ServerEvents`, `ScorePill`, `MatchEndOverlay`, `BurstReveal`, `type Winner`. Payloads (Task 2/3) : `TwentyQuestionsRoundReady { setterId, guesserId, attemptsRemaining, turnIndex }` (émis une seule fois, au lancement de la partie), `TwentyQuestionsGuessSubmitted { guess, attemptsRemaining }`, `TwentyQuestionsRoundResult { correct, hint, attemptsRemaining, roundOver, turnIndex, nextSetterId, nextGuesserId, scores, matchOver, isDraw, winnerId }`.
- Produces: `TwentyQuestionsMultiplayer(): JSX.Element`. Consommé par Task 10. `MatchEndOverlay` reçoit ici potentiellement `winner: 'draw'` (déjà supporté).

Note d'implémentation : `TwentyQuestionsRoundReady` n'arrive qu'une fois, pour le tour 1 (déclenché par `StartGame` côté serveur — voir Task 3). Les tours 2 à 6 démarrent directement à la réception d'un `TwentyQuestionsRoundResult` avec `roundOver: true` et `matchOver: false`, en utilisant ses champs `nextSetterId`/`nextGuesserId`/`turnIndex` et la constante locale `MAX_ATTEMPTS_PER_TURN = 10` (pas de nouvel événement `RoundReady` par tour).

- [ ] **Step 1: Créer le composant**

Créer `frontend/src/games/multiplayer/TwentyQuestionsMultiplayer.tsx` :

```tsx
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/store/useGameStore';
import { ClientEvents, ServerEvents } from '@/lib/socketEvents';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { BurstReveal } from '@/components/solo/reveals/BurstReveal';
import type { Winner } from '@/lib/soloScore';

const MAX_ATTEMPTS_PER_TURN = 10;
const TOTAL_TURNS = 6;

type RoundResultPayload = {
  correct: boolean;
  hint?: string;
  attemptsRemaining: number;
  roundOver: boolean;
  turnIndex: number;
  nextSetterId: string | null;
  nextGuesserId: string | null;
  scores: Record<string, number>;
  matchOver: boolean;
  isDraw: boolean;
  winnerId: string | null;
};

export function TwentyQuestionsMultiplayer() {
  const { socket, socketId } = useSocket();
  const players = useGameStore(state => state.players);
  const setStoreScores = useGameStore(state => state.setScores);
  const [setterId, setSetterId] = useState<string | null>(null);
  const [guesserId, setGuesserId] = useState<string | null>(null);
  const [turnIndex, setTurnIndex] = useState(1);
  const [attemptsRemaining, setAttemptsRemaining] = useState(MAX_ATTEMPTS_PER_TURN);
  const [wordSet, setWordSet] = useState(false);
  const [wordDraft, setWordDraft] = useState('');
  const [guessDraft, setGuessDraft] = useState('');
  const [pendingGuess, setPendingGuess] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [hintDraft, setHintDraft] = useState('');
  const [roundResult, setRoundResult] = useState<RoundResultPayload | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [matchOver, setMatchOver] = useState(false);
  const [winner, setWinner] = useState<Winner>(null);

  useEffect(() => {
    if (!socket || !socketId) {
      return;
    }

    const handleRoundReady = (data: { setterId: string; guesserId: string; attemptsRemaining: number; turnIndex: number }) => {
      setSetterId(data.setterId);
      setGuesserId(data.guesserId);
      setAttemptsRemaining(data.attemptsRemaining);
      setTurnIndex(data.turnIndex);
      setWordSet(false);
      setWordDraft('');
      setGuessDraft('');
      setPendingGuess(null);
      setHint(null);
      setHintDraft('');
    };

    const handleGuessSubmitted = (data: { guess: string; attemptsRemaining: number }) => {
      setPendingGuess(data.guess);
      setAttemptsRemaining(data.attemptsRemaining);
    };

    const handleRoundResult = (data: RoundResultPayload) => {
      setScores(data.scores);
      setStoreScores(data.scores);

      if (!data.roundOver) {
        setHint(data.hint ?? null);
        setAttemptsRemaining(data.attemptsRemaining);
        setPendingGuess(null);
        setGuessDraft('');
        return;
      }

      setRoundResult(data);
      setMatchOver(data.matchOver);
      setWinner(data.matchOver ? (data.isDraw ? 'draw' : data.winnerId === socketId ? 'player' : 'machine') : null);
    };

    const handleScoreReset = (data: { scores: Record<string, number> }) => {
      setScores(data.scores);
      setStoreScores(data.scores);
      setMatchOver(false);
      setWinner(null);
      setRoundResult(null);
    };

    socket.on(ServerEvents.TwentyQuestionsRoundReady, handleRoundReady);
    socket.on(ServerEvents.TwentyQuestionsGuessSubmitted, handleGuessSubmitted);
    socket.on(ServerEvents.TwentyQuestionsRoundResult, handleRoundResult);
    socket.on(ServerEvents.ScoreReset, handleScoreReset);

    return () => {
      socket.off(ServerEvents.TwentyQuestionsRoundReady, handleRoundReady);
      socket.off(ServerEvents.TwentyQuestionsGuessSubmitted, handleGuessSubmitted);
      socket.off(ServerEvents.TwentyQuestionsRoundResult, handleRoundResult);
      socket.off(ServerEvents.ScoreReset, handleScoreReset);
    };
  }, [socket, socketId, setStoreScores]);

  const me = players.find(player => player.id === socketId) ?? null;
  const opponent = players.find(player => player.id !== socketId) ?? null;
  const myScore = socketId ? scores[socketId] ?? 0 : 0;
  const opponentScore = opponent ? scores[opponent.id] ?? 0 : 0;
  const isSetter = socketId !== null && socketId === setterId;
  const isGuesser = socketId !== null && socketId === guesserId;

  const submitWord = () => {
    if (!socket || !isSetter || !wordDraft.trim()) {
      return;
    }
    socket.emit(ClientEvents.TwentyQuestionsSetWord, { word: wordDraft.trim() });
    setWordSet(true);
  };

  const submitGuess = () => {
    if (!socket || !isGuesser || !guessDraft.trim() || pendingGuess) {
      return;
    }
    socket.emit(ClientEvents.TwentyQuestionsGuess, { guess: guessDraft.trim() });
  };

  const judge = (correct: boolean) => {
    if (!socket || !isSetter || !pendingGuess) {
      return;
    }
    socket.emit(ClientEvents.TwentyQuestionsJudge, { correct, hint: correct ? undefined : hintDraft.trim() || undefined });
    setHintDraft('');
  };

  const handleRoundRevealComplete = () => {
    if (!roundResult) {
      return;
    }

    if (roundResult.matchOver) {
      setRoundResult(null);
      return;
    }

    setSetterId(roundResult.nextSetterId);
    setGuesserId(roundResult.nextGuesserId);
    setTurnIndex(roundResult.turnIndex + 1);
    setAttemptsRemaining(MAX_ATTEMPTS_PER_TURN);
    setWordSet(false);
    setWordDraft('');
    setGuessDraft('');
    setPendingGuess(null);
    setHint(null);
    setRoundResult(null);
  };

  const handleReplay = () => {
    if (!socket) {
      return;
    }
    socket.emit(ClientEvents.ResetMatchScore);
  };

  const scorePillTarget = Math.max(myScore, opponentScore, MAX_ATTEMPTS_PER_TURN);

  return (
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">
      <ScorePill
        player={myScore}
        machine={opponentScore}
        targetScore={scorePillTarget}
        onReset={handleReplay}
        playerLabel={`${me?.name ?? 'Vous'} (vous)`}
        machineLabel={opponent?.name ?? 'Adversaire'}
      />

      {roundResult ? (
        <BurstReveal
          icon={roundResult.correct ? 'success' : 'fail'}
          headline={
            roundResult.correct
              ? isGuesser
                ? `Trouvé ! +${roundResult.attemptsRemaining} point(s).`
                : `${opponent?.name ?? 'Le devineur'} a trouvé le mot.`
              : 'Essais épuisés pour cette manche, 0 point.'
          }
          detail={`Tour ${roundResult.turnIndex} / ${TOTAL_TURNS} terminé.`}
          onComplete={handleRoundRevealComplete}
        />
      ) : (
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Tour {turnIndex} / {TOTAL_TURNS} — {attemptsRemaining} essai(s) restant(s)
          </p>

          {isSetter && !wordSet ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Vous êtes le meneur. Choisissez le mot secret.</p>
              <input
                value={wordDraft}
                onChange={event => setWordDraft(event.target.value)}
                placeholder="Mot secret"
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <Button type="button" onClick={submitWord} disabled={!wordDraft.trim()}>
                Valider le mot
              </Button>
            </div>
          ) : isSetter && pendingGuess ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-border bg-muted p-4 text-sm text-foreground">
                <strong>Proposition :</strong> {pendingGuess}
              </div>
              <input
                value={hintDraft}
                onChange={event => setHintDraft(event.target.value)}
                placeholder="Indice à donner si incorrect (facultatif)"
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <div className="flex gap-3">
                <Button type="button" onClick={() => judge(true)}>
                  Correct
                </Button>
                <Button type="button" variant="outline" onClick={() => judge(false)}>
                  Incorrect
                </Button>
              </div>
            </div>
          ) : isSetter ? (
            <p className="text-sm text-muted-foreground">Mot défini. En attente d’une question de {opponent?.name ?? 'l’adversaire'}...</p>
          ) : isGuesser && pendingGuess ? (
            <p className="text-sm text-muted-foreground">En attente du jugement de {opponent?.name ?? 'l’adversaire'}...</p>
          ) : isGuesser ? (
            <div className="space-y-3">
              {hint ? (
                <div className="rounded-2xl border border-border bg-muted p-4 text-sm text-foreground">
                  <strong>Indice :</strong> {hint}
                </div>
              ) : null}
              <p className="text-sm text-muted-foreground">Vous êtes le devineur. Posez une question ou proposez un mot.</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={guessDraft}
                  onChange={event => setGuessDraft(event.target.value)}
                  placeholder="Votre question ou proposition"
                  className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <Button type="button" onClick={submitGuess} disabled={!guessDraft.trim()}>
                  Envoyer
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">En attente du début du tour...</p>
          )}
        </div>
      )}

      <MatchEndOverlay winner={winner} onReplay={handleReplay} />
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/games/multiplayer/TwentyQuestionsMultiplayer.tsx
git commit -m "feat: add TwentyQuestionsMultiplayer component with turn-based setter/guesser roles and draw support"
```

---

### Task 10: Brancher les 5 nouveaux composants dans `GamePlayPage`

**Files:**
- Modify: `frontend/src/pages/GamePlayPage.tsx` (remplacement intégral)

**Interfaces:**
- Consumes: `RpsMultiplayer` (déjà branché), `OddOrEvenMultiplayer` (Task 5), `WouldYouRatherMultiplayer` (Task 6), `TwoTruthsOneLieMultiplayer` (Task 7), `TruthOrDareMultiplayer` (Task 8), `TwentyQuestionsMultiplayer` (Task 9).

Toute la logique RPS-only déjà retirée reste retirée ; toute la logique inline des 5 autres jeux (statusMessage, prompt, optionA/optionB, guess, statements, les handlers `handle*`, le gros `useEffect` d'écoute socket) est supprimée du fichier — elle est désormais entièrement encapsulée dans les composants dédiés.

- [ ] **Step 1: Remplacer le contenu du fichier**

Remplacer entièrement `frontend/src/pages/GamePlayPage.tsx` par :

```tsx
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { gameThemes } from '../data/gameThemes';
import { useGameStore } from '../store/useGameStore';
import { RpsMultiplayer } from '../games/multiplayer/RpsMultiplayer';
import { OddOrEvenMultiplayer } from '../games/multiplayer/OddOrEvenMultiplayer';
import { WouldYouRatherMultiplayer } from '../games/multiplayer/WouldYouRatherMultiplayer';
import { TwoTruthsOneLieMultiplayer } from '../games/multiplayer/TwoTruthsOneLieMultiplayer';
import { TruthOrDareMultiplayer } from '../games/multiplayer/TruthOrDareMultiplayer';
import { TwentyQuestionsMultiplayer } from '../games/multiplayer/TwentyQuestionsMultiplayer';

export function GamePlayPage() {
  const { gameId, roomCode } = useParams();
  const navigate = useNavigate();
  const players = useGameStore(state => state.players);
  const game = useMemo(() => (gameId ? gameThemes.find(item => item.id === gameId) : null), [gameId]);

  if (!game || !gameId || !roomCode) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-3xl px-4 py-10 text-center">
        <h2 className="text-2xl font-semibold text-foreground">Jeu introuvable</h2>
        <p className="mt-3 text-sm text-muted-foreground">Retournez à l’accueil pour sélectionner un jeu.</p>
      </motion.div>
    );
  }

  return (
    <motion.main initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <section className="rounded-[2rem] bg-card p-10 shadow-lg shadow-slate-900/5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">Partie en cours</p>
            <h1 className="mt-3 text-4xl font-bold text-foreground">{game.title} — Salon {roomCode}</h1>
            <p className="mt-3 text-base leading-7 text-muted-foreground">{players.length} joueur(s) dans la salle.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate(`/jeu/${gameId}/salon/${roomCode}/resultats`)}>
              Voir résultats
            </Button>
          </div>
        </div>

        <div className="mt-8">
          {gameId === 'rps' ? (
            <RpsMultiplayer />
          ) : gameId === 'odd-or-even' ? (
            <OddOrEvenMultiplayer />
          ) : gameId === 'would-you-rather' ? (
            <WouldYouRatherMultiplayer />
          ) : gameId === 'two-truths-one-lie' ? (
            <TwoTruthsOneLieMultiplayer />
          ) : gameId === 'truth-or-dare' ? (
            <TruthOrDareMultiplayer />
          ) : gameId === '20-questions' ? (
            <TwentyQuestionsMultiplayer />
          ) : (
            <div className="rounded-3xl border border-border bg-surface p-6 text-sm text-muted-foreground">
              Ce jeu est en cours de développement. Revenez bientôt pour plus d’options.
            </div>
          )}
        </div>
      </section>
    </motion.main>
  );
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur. Vérifier en particulier qu'aucune référence résiduelle à `ClientEvents`/`ServerEvents`/`useSocket` ne subsiste dans ce fichier (toute la logique socket est désormais dans les composants dédiés).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/GamePlayPage.tsx
git commit -m "feat: wire all 6 multiplayer game components into GamePlayPage, remove inline per-game socket logic"
```

---

### Task 11: `ResultsPage` — vrais pseudos et vrais scores

**Files:**
- Modify: `frontend/src/pages/ResultsPage.tsx` (remplacement intégral)

**Interfaces:**
- Consumes: `useGameStore` (`players`, `scores` — Task 4).

- [ ] **Step 1: Remplacer le contenu du fichier**

Remplacer entièrement `frontend/src/pages/ResultsPage.tsx` par :

```tsx
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { useGameStore } from '../store/useGameStore';

export function ResultsPage() {
  const navigate = useNavigate();
  const { gameId, roomCode } = useParams();
  const players = useGameStore(state => state.players);
  const scores = useGameStore(state => state.scores);

  const ranking = [...players]
    .map(player => ({ ...player, score: scores[player.id] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  return (
    <motion.main initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <section className="rounded-[2rem] bg-card p-10 shadow-lg shadow-slate-900/5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">Résultats</p>
            <h1 className="mt-3 text-4xl font-bold text-foreground">Classement final</h1>
            <p className="mt-4 text-base leading-7 text-muted-foreground">Récapitulatif du salon {roomCode} pour {gameId?.replace(/-/g, ' ') ?? 'le jeu'}.</p>
          </div>
        </div>

        <div className="mt-8 space-y-4 rounded-3xl border border-border bg-background p-6">
          {ranking.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun score enregistré pour l’instant.</p>
          ) : (
            ranking.map((player, index) => (
              <div key={player.id} className="rounded-3xl bg-surface p-4">
                <p className="text-sm font-semibold text-foreground">
                  {index + 1}. {player.name}
                </p>
                <p className="text-sm text-muted-foreground">{player.score} point(s)</p>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button onClick={() => navigate('/')}>Retour à l'accueil</Button>
          <Button variant="secondary" onClick={() => navigate(`/jeu/${gameId}/mode`)}>
            Rejouer
          </Button>
        </div>
      </section>
    </motion.main>
  );
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ResultsPage.tsx
git commit -m "feat: show real player pseudos and room scores on ResultsPage"
```

---

### Task 12: Retrofit anti-répétition — `WouldYouRatherSolo`

**Files:**
- Modify: `frontend/src/games/solo/WouldYouRatherSolo.tsx` (remplacement intégral)

**Interfaces:**
- Consumes: `pickRandomIndexExcluding` (`@/lib/randomPick`, déjà livré).

Même patron que le retrofit déjà livré pour `TruthOrDareSolo.tsx` : un `Set<number>` d'indices déjà vus en state local, recyclé automatiquement une fois épuisé.

- [ ] **Step 1: Remplacer le contenu du fichier**

Remplacer entièrement `frontend/src/games/solo/WouldYouRatherSolo.tsx` par :

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { BurstReveal } from '@/components/solo/reveals/BurstReveal';
import { soloWouldYouRatherPrompts } from '@/data/soloPrompts';
import { pickRandomItem, pickRandomIndexExcluding } from '@/lib/randomPick';

const SIDES = ['left', 'right'] as const;
type Side = (typeof SIDES)[number];

type RoundResult = { playerChoice: Side; machineChoice: Side };

export function WouldYouRatherSolo() {
  const [usedIndices, setUsedIndices] = useState<Set<number>>(() => new Set());
  const [dilemmaIndex, setDilemmaIndex] = useState<number>(() => Math.floor(Math.random() * soloWouldYouRatherPrompts.length));
  const [revealing, setRevealing] = useState(false);
  const [result, setResult] = useState<RoundResult | null>(null);

  const dilemma = soloWouldYouRatherPrompts[dilemmaIndex];

  const nextDilemma = () => {
    const currentUsed = new Set(usedIndices);
    currentUsed.add(dilemmaIndex);

    let activeUsed = currentUsed;
    if (activeUsed.size >= soloWouldYouRatherPrompts.length) {
      activeUsed = new Set();
    }
    const nextIdx = pickRandomIndexExcluding(soloWouldYouRatherPrompts.length, activeUsed);
    const newUsed = new Set(activeUsed).add(nextIdx);

    setUsedIndices(newUsed);
    setDilemmaIndex(nextIdx);
    setResult(null);
    setRevealing(false);
  };

  const chooseOption = (side: Side) => {
    if (revealing || result) {
      return;
    }
    setResult({ playerChoice: side, machineChoice: pickRandomItem(SIDES) });
    setRevealing(true);
  };

  return (
    <div className="space-y-6 rounded-3xl border border-border bg-background p-8">
      {revealing && result ? (
        <BurstReveal
          icon="neutral"
          headline={`Vous : « ${dilemma[result.playerChoice]} »`}
          detail={`IA : « ${dilemma[result.machineChoice]} » ${
            result.playerChoice === result.machineChoice ? '— même longueur d’onde !' : '— pas d’accord cette fois.'
          }`}
          onComplete={() => setRevealing(false)}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Tu préfères...</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => chooseOption('left')}
              disabled={!!result}
              className="h-auto whitespace-normal px-4 py-3 text-left"
            >
              {dilemma.left}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => chooseOption('right')}
              disabled={!!result}
              className="h-auto whitespace-normal px-4 py-3 text-left"
            >
              {dilemma.right}
            </Button>
          </div>
        </>
      )}

      {!revealing ? (
        <Button type="button" variant="secondary" onClick={nextDilemma}>
          {result ? 'Prochain dilemme' : 'Nouveau dilemme'}
        </Button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/games/solo/WouldYouRatherSolo.tsx
git commit -m "feat: retrofit WouldYouRatherSolo with anti-repetition prompt selection"
```

---

### Task 13: Retrofit anti-répétition — `TwentyQuestionsSolo`

**Files:**
- Modify: `frontend/src/games/solo/TwentyQuestionsSolo.tsx` (remplacement intégral)

**Interfaces:**
- Consumes: `pickRandomIndexExcluding` (`@/lib/randomPick`).

- [ ] **Step 1: Remplacer le contenu du fichier**

Remplacer entièrement `frontend/src/games/solo/TwentyQuestionsSolo.tsx` par :

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { BurstReveal } from '@/components/solo/reveals/BurstReveal';
import { useSoloScore } from '@/hooks/useSoloScore';
import { soloTwentyQuestionsWords } from '@/data/soloPrompts';
import { pickRandomIndexExcluding } from '@/lib/randomPick';
import { getHintForAttempt, isCorrectGuess } from '@/lib/twentyQuestionsLogic';

const TWENTY_QUESTIONS_TARGET_SCORE = 3;
const MAX_ATTEMPTS = 20;

type RoundResult = { outcome: 'player' | 'machine'; answer: string; triesUsed: number };

export function TwentyQuestionsSolo() {
  const { score, winner, isMatchOver, recordRound, reset } = useSoloScore(TWENTY_QUESTIONS_TARGET_SCORE);
  const [usedIndices, setUsedIndices] = useState<Set<number>>(() => new Set());
  const [wordIndex, setWordIndex] = useState<number>(() => Math.floor(Math.random() * soloTwentyQuestionsWords.length));
  const [attempts, setAttempts] = useState(0);
  const [guess, setGuess] = useState('');
  const [message, setMessage] = useState('Devinez le mot en 20 essais maximum.');
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [roundOver, setRoundOver] = useState(false);

  const word = soloTwentyQuestionsWords[wordIndex];
  const hint = getHintForAttempt(word.hints, attempts);

  const startNewRound = () => {
    const currentUsed = new Set(usedIndices);
    currentUsed.add(wordIndex);

    let activeUsed = currentUsed;
    if (activeUsed.size >= soloTwentyQuestionsWords.length) {
      activeUsed = new Set();
    }
    const nextIdx = pickRandomIndexExcluding(soloTwentyQuestionsWords.length, activeUsed);
    const newUsed = new Set(activeUsed).add(nextIdx);

    setUsedIndices(newUsed);
    setWordIndex(nextIdx);
    setAttempts(0);
    setGuess('');
    setMessage('Nouveau mot ! Devinez-le en 20 essais maximum.');
    setRoundOver(false);
  };

  const submitGuess = () => {
    if (isMatchOver || roundOver || roundResult || !guess.trim()) {
      return;
    }

    if (isCorrectGuess(guess, word.answer)) {
      setRoundResult({ outcome: 'player', answer: word.answer, triesUsed: attempts + 1 });
      return;
    }

    const nextAttempts = attempts + 1;
    setGuess('');
    setAttempts(nextAttempts);

    if (nextAttempts >= MAX_ATTEMPTS) {
      setRoundResult({ outcome: 'machine', answer: word.answer, triesUsed: nextAttempts });
      return;
    }

    setMessage(`Non, ce n’est pas ça. Essai ${nextAttempts}/${MAX_ATTEMPTS}.`);
  };

  const handleRevealComplete = () => {
    if (!roundResult) {
      return;
    }

    setMessage(
      roundResult.outcome === 'player'
        ? `Bravo, c’était bien "${roundResult.answer}" !`
        : `Essais épuisés. Le mot était "${roundResult.answer}".`
    );
    recordRound(roundResult.outcome);
    setRoundOver(true);
    setRoundResult(null);
  };

  return (
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">
      <ScorePill player={score.player} machine={score.machine} targetScore={TWENTY_QUESTIONS_TARGET_SCORE} onReset={reset} />

      {roundResult ? (
        <BurstReveal
          icon={roundResult.outcome === 'player' ? 'success' : 'fail'}
          headline={roundResult.outcome === 'player' ? `Trouvé : ${roundResult.answer} !` : `Le mot était : ${roundResult.answer}`}
          detail={roundResult.outcome === 'player' ? `En ${roundResult.triesUsed} essai(s).` : undefined}
          onComplete={handleRevealComplete}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{message}</p>

          <div className="rounded-2xl border border-border bg-muted p-4 text-sm text-foreground">
            <strong>Indice :</strong> {hint}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <input
              type="text"
              value={guess}
              onChange={event => setGuess(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  submitGuess();
                }
              }}
              disabled={isMatchOver || roundOver}
              placeholder="Votre proposition"
              className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <Button type="button" onClick={submitGuess} disabled={isMatchOver || roundOver} className="h-auto px-6 py-3">
              Valider
            </Button>
          </div>
        </>
      )}

      {roundOver && !isMatchOver ? (
        <Button type="button" variant="secondary" onClick={startNewRound}>
          Manche suivante
        </Button>
      ) : null}

      <MatchEndOverlay
        winner={winner}
        onReplay={() => {
          reset();
          startNewRound();
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/games/solo/TwentyQuestionsSolo.tsx
git commit -m "feat: retrofit TwentyQuestionsSolo with anti-repetition word selection"
```

---

### Task 14: Retrofit anti-répétition — `TwoTruthsOneLieSolo`

**Files:**
- Modify: `frontend/src/games/solo/TwoTruthsOneLieSolo.tsx` (remplacement intégral)

**Interfaces:**
- Consumes: `pickRandomIndexExcluding` (`@/lib/randomPick`), `shuffleTriplet` (`@/lib/twoTruthsLogic`, inchangé).

- [ ] **Step 1: Remplacer le contenu du fichier**

Remplacer entièrement `frontend/src/games/solo/TwoTruthsOneLieSolo.tsx` par :

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { BurstReveal } from '@/components/solo/reveals/BurstReveal';
import { useSoloScore } from '@/hooks/useSoloScore';
import { soloTwoTruthsOneLieTriplets } from '@/data/soloPrompts';
import { pickRandomIndexExcluding } from '@/lib/randomPick';
import { shuffleTriplet } from '@/lib/twoTruthsLogic';

const TWO_TRUTHS_TARGET_SCORE = 5;

type RoundResult = { outcome: 'player' | 'machine'; lieText: string };

export function TwoTruthsOneLieSolo() {
  const { score, winner, isMatchOver, recordRound, reset } = useSoloScore(TWO_TRUTHS_TARGET_SCORE);
  const [usedIndices, setUsedIndices] = useState<Set<number>>(() => new Set());
  const [tripletIndex, setTripletIndex] = useState<number>(() => Math.floor(Math.random() * soloTwoTruthsOneLieTriplets.length));
  const [triplet, setTriplet] = useState(() => shuffleTriplet(soloTwoTruthsOneLieTriplets[tripletIndex]));
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [roundOver, setRoundOver] = useState(false);

  const nextRound = () => {
    const currentUsed = new Set(usedIndices);
    currentUsed.add(tripletIndex);

    let activeUsed = currentUsed;
    if (activeUsed.size >= soloTwoTruthsOneLieTriplets.length) {
      activeUsed = new Set();
    }
    const nextIdx = pickRandomIndexExcluding(soloTwoTruthsOneLieTriplets.length, activeUsed);
    const newUsed = new Set(activeUsed).add(nextIdx);

    setUsedIndices(newUsed);
    setTripletIndex(nextIdx);
    setTriplet(shuffleTriplet(soloTwoTruthsOneLieTriplets[nextIdx]));
    setRoundOver(false);
  };

  const chooseStatement = (index: number) => {
    if (isMatchOver || roundOver || roundResult) {
      return;
    }

    const correct = index === triplet.lieIndex;
    setRoundResult({ outcome: correct ? 'player' : 'machine', lieText: triplet.statements[triplet.lieIndex] });
  };

  const handleRevealComplete = () => {
    if (!roundResult) {
      return;
    }
    recordRound(roundResult.outcome);
    setRoundOver(true);
    setRoundResult(null);
  };

  return (
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">
      <ScorePill player={score.player} machine={score.machine} targetScore={TWO_TRUTHS_TARGET_SCORE} onReset={reset} />

      {roundResult ? (
        <BurstReveal
          icon={roundResult.outcome === 'player' ? 'success' : 'fail'}
          headline={roundResult.outcome === 'player' ? 'Bien joué, vous avez trouvé le mensonge !' : 'Perdu, ce n’était pas le mensonge.'}
          detail={`Le mensonge était : "${roundResult.lieText}"`}
          onComplete={handleRevealComplete}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">L’IA affirme 3 choses sur elle. Trouvez le mensonge.</p>

          <div className="grid gap-3">
            {triplet.statements.map((statement, index) => (
              <Button
                key={index}
                type="button"
                variant="outline"
                onClick={() => chooseStatement(index)}
                disabled={isMatchOver || roundOver}
                className="h-auto justify-start whitespace-normal px-4 py-3 text-left"
              >
                {statement}
              </Button>
            ))}
          </div>
        </>
      )}

      {roundOver && !isMatchOver ? (
        <Button type="button" variant="secondary" onClick={nextRound}>
          Série suivante
        </Button>
      ) : null}

      <MatchEndOverlay
        winner={winner}
        onReplay={() => {
          reset();
          nextRound();
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/games/solo/TwoTruthsOneLieSolo.tsx
git commit -m "feat: retrofit TwoTruthsOneLieSolo with anti-repetition triplet selection"
```

---

### Task 15: Vérification finale (build, tests, playtest à deux clients pour les 5 jeux)

**Files:** aucun nouveau fichier — vérification de bout en bout.

- [ ] **Step 1: Compilation complète des deux projets**

Run: `cd backend && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 2: Suite de tests frontend existante**

Run: `cd frontend && npm test`
Expected: tous les tests passent (aucun changement à `frontend/src/lib/*` — `randomPick.test.ts` couvre déjà `pickRandomIndexExcluding` depuis la session précédente).

- [ ] **Step 3: Builds de production**

Run: `cd backend && npm run build && cd ../frontend && npm run build`
Expected: build réussi dans les deux cas.

- [ ] **Step 4: Playtest à deux clients — Pair ou Impair**

Démarrer le backend (`cd backend && npm run dev`) et le frontend (`cd frontend && npm run dev`). Deux onglets/navigateurs, salon Pair ou Impair :
- Créer le salon (Alice), rejoindre (Bob), démarrer la partie.
- Jouer plusieurs manches avec des combinaisons gagnantes/perdantes/égalité pour chaque joueur : vérifier que `FlipReveal` montre le bon chiffre de chaque côté (le sien vs celui de l'adversaire), que la barre de score ne progresse que du côté du joueur qui a correctement prédit la parité (aucune progression en cas d'égalité).
- Jouer jusqu'à 5 points : vérifier `MatchEndOverlay`, puis « Nouvelle partie » remet les deux à 0.

- [ ] **Step 5: Playtest à deux clients — Tu Préfères ?**

Salon Tu Préfères ? :
- Démarrer la partie : vérifier qu'un dilemme apparaît automatiquement chez les deux joueurs sans action manuelle.
- Choisir le même côté des deux côtés : vérifier +1 pour les deux (`BurstReveal` icône succès).
- Choisir des côtés différents : vérifier 0 point des deux côtés (`BurstReveal` icône neutre).
- Jouer plusieurs manches : vérifier qu'aucun dilemme ne se répète avant d'avoir épuisé les 8 prompts.
- Jusqu'à 5 points : `MatchEndOverlay`, puis rejeu.

- [ ] **Step 6: Playtest à deux clients — 2 Vérités 1 Mensonge**

Salon 2 Vérités 1 Mensonge :
- Alice soumet 3 affirmations : vérifier qu'Alice voit "en attente du vote" et que Bob voit les 3 affirmations en boutons de vote.
- Bob vote juste : vérifier que Bob gagne le point (`BurstReveal` succès côté Bob, échec côté Alice — texte adapté à la perspective de chacun).
- Rejouer avec un vote faux : vérifier qu'Alice (la soumetteuse) gagne le point cette fois.
- Jusqu'à 5 points : `MatchEndOverlay`, puis rejeu.

- [ ] **Step 7: Playtest à deux clients — Action ou Vérité**

Salon Action ou Vérité :
- Cliquer « Tourner la roue » : vérifier que `PlayerWheel` tourne puis désigne un des deux vrais joueurs (pas un nom fictif).
- Côté joueur actif : choisir Vérité, écrire une réponse, l'envoyer : vérifier que l'autre joueur voit la question, puis la réponse écrite, puis les boutons Valider/Refuser.
- Valider : vérifier +1 pour le joueur actif des deux côtés. Refuser (sur une autre manche) : vérifier 0 point.
- Choisir Action sur une manche : vérifier qu'il n'y a pas de champ de réponse écrite, directement les boutons Valider/Refuser côté non-actif.
- Jusqu'à 5 points : `MatchEndOverlay`, puis rejeu (vérifier qu'un nouveau tour de roue fonctionne après reset).

- [ ] **Step 8: Playtest à deux clients — 20 Questions**

Salon 20 Questions :
- Démarrer la partie : vérifier que le premier joueur (créateur du salon) est meneur et voit le champ « mot secret », l'autre voit « en attente du début du tour ».
- Le meneur définit un mot : vérifier que le devineur peut alors poser une question/proposition.
- Le devineur propose un mot incorrect avec un indice : vérifier que le devineur voit l'indice et peut reproposer, que le compteur d'essais restants décrémente correctement (10 au départ).
- Faire trouver le mot juste : vérifier que le score du devineur augmente du nombre d'essais restants au moment de la bonne réponse.
- Jouer les 6 tours en alternant les rôles (vérifier l'alternance meneur/devineur à chaque tour) : à la fin, vérifier `MatchEndOverlay` avec le bon vainqueur, ou l'état « Égalité » (🤝) si les scores sont identiques.
- « Nouvelle partie » : vérifier qu'un nouveau match de 6 tours redémarre proprement (scores à 0, tour 1/6, rôles réinitialisés).

- [ ] **Step 9: Playtest solo — anti-répétition**

Sur `TruthOrDareSolo`, `WouldYouRatherSolo`, `TwentyQuestionsSolo`, `TwoTruthsOneLieSolo` : enchaîner au moins 9 manches sur chacun et confirmer qu'aucun contenu ne se répète avant que les 8 entrées du pool aient toutes été vues (recyclage ensuite autorisé).

- [ ] **Step 10: Vérifier `ResultsPage`**

Depuis n'importe quel salon en cours de partie (après quelques manches jouées), cliquer « Voir résultats » : vérifier que les vrais pseudos et scores actuels du salon s'affichent, triés par score décroissant.

- [ ] **Step 11: Commit final si des ajustements ont été faits pendant le playtest**

```bash
git add -A
git commit -m "fix: address issues found during remaining-games multiplayer playtest"
```

(Ne committer que s'il y a effectivement eu des changements.)

---

## Self-Review Notes

- **Spec coverage** : `ScorePill`/`MatchEndOverlay` labels et état `draw` déjà livrés (session précédente, Task 4 les branche). Anti-répétition solo pour les 4 jeux à contenu système (Task 1 pour `TruthOrDareSolo`, Tasks 12-14 pour les 3 autres) ; le backend a sa propre copie de la logique (`RoomManager.pickIndexExcluding`, Task 2) pour Action ou Vérité et Tu Préfères ? multijoueur. Prompts à 8 entrées et suppression de `twentyQuestionsWords` (Task 1). Score cible 5 pour `odd-or-even`/`would-you-rather`/`two-truths-one-lie`/`truth-or-dare` (Task 2 `TARGET_SCORES`), pas de cible pour `20-questions` (Task 2, logique de fin dédiée à `TWENTY_Q_MAX_TURNS`). Règle Tu Préfères ? (+1 aux deux si même choix) : Task 2 `setWouldYouRatherChoice`. Règle 20 Questions (3 allers-retours, score = essais restants, égalité gérée par `MatchEndOverlay`) : Task 2 `judgeTwentyQuestionsGuess` + Task 9. Règle Action ou Vérité (roue sur vrais joueurs, réponse écrite pour Vérité, validation par l'autre joueur) : Task 2 (`startTruthOrDare`/`chooseTruthOrDareType`/`submitTruthOrDareAnswer`/`validateTruthOrDare`) + Task 8. Les 5 composants frontend et leur branchement dans `GamePlayPage` : Tasks 5-10. `ResultsPage` avec vrais scores : Task 11 (nécessite Task 4 pour le champ `scores` du store).
- **Cohérence des types** : `outcome: 'player' | 'machine' | 'draw'` réutilisé identiquement entre `setOddOrEvenChoice` (Task 2) et `OddOrEvenMultiplayer` (Task 5). `Winner` (`'player' | 'machine' | 'draw' | null'`, déjà étendu) utilisé sans redéfinition dans les 6 composants multijoueur. Les noms de champs de payload (`yourValue`/`opponentValue`/`sum`/`parity` pour Pair ou Impair ; `yourChoice`/`opponentChoice`/`sameChoice` pour Tu Préfères ? ; `voterSocketId`/`correct`/`lieIndex` pour 2 Vérités 1 Mensonge ; `activePlayerId`/`type`/`text`/`answer`/`approved` pour Action ou Vérité ; `setterId`/`guesserId`/`attemptsRemaining`/`turnIndex`/`nextSetterId`/`nextGuesserId`/`isDraw` pour 20 Questions) sont identiques entre les retours `RoomManager` (Task 2), les émissions `index.ts` (Task 3) et les payloads consommés côté frontend (Tasks 5-9) — vérifié champ par champ lors de la rédaction.
- **Risque identifié — 20 Questions (Task 9)** : `TwentyQuestionsRoundReady` n'est émis qu'une seule fois (au lancement du match, tour 1). Les tours 2 à 6 démarrent uniquement à partir des champs `nextSetterId`/`nextGuesserId`/`turnIndex` du payload `TwentyQuestionsRoundResult` — c'est documenté explicitement dans la note d'implémentation de la Task 9 pour éviter qu'un exécutant ne s'attende à tort à un `RoundReady` par tour.
- **Risque identifié — `ScorePill` sur 20 Questions** : cette barre de score n'a pas de « cible » naturelle (fin de partie basée sur le nombre de tours, pas le score). Task 9 utilise `Math.max(myScore, opponentScore, MAX_ATTEMPTS_PER_TURN)` comme cible purement cosmétique pour la barre de progression — documenté explicitement dans le code du composant pour éviter la confusion avec une vraie cible de victoire (qui n'existe pas pour ce jeu).
- **Risque identifié — Tâches 2 et 3 (`RoomManager`/`index.ts`)** : remplacements de fichiers entiers plutôt que des diffs ciblés, car le fichier gagne ~10 nouvelles méthodes fortement couplées (constantes partagées `TARGET_SCORES`/`TWENTY_Q_MAX_*`, helper privé `pickIndexExcluding`). Un exécutant doit copier-coller le contenu intégral proposé sans en modifier la structure ; la compilation TypeScript (`tsc --noEmit`) est le filet de sécurité qui détecterait toute erreur de copie.

