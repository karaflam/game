# Multiplayer RPS Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Porter le score cible, l'overlay de fin de partie et l'animation de révélation de manche (déjà construits pour le solo) sur Pierre-Feuille-Ciseau en mode multijoueur, comme pilote avant de répliquer aux 5 autres jeux.

**Architecture:** Le serveur (`RoomManager`) suit désormais le `gameId` et un score cumulé par joueur pour chaque salon. La manche RPS envoie à chaque joueur un résultat enrichi et personnalisé (son coup, le coup adverse, l'issue, les scores à jour, si la partie est terminée). Le frontend consomme ça dans un nouveau composant dédié `RpsMultiplayer.tsx` qui réutilise tel quel `ScorePill`, `DuelReveal` et `MatchEndOverlay` du solo — aucune modification à ces trois composants partagés.

**Tech Stack:** Node/Express/socket.io (backend, TypeScript), React/Zustand (frontend, TypeScript).

## Global Constraints

- Seul Pierre-Feuille-Ciseau est traité cette session. Les 5 autres jeux multijoueur restent inchangés (branches existantes de `GamePlayPage.tsx` non touchées).
- Score cible RPS multijoueur : **5** (identique au solo).
- `ScorePill`, `DuelReveal`, `MatchEndOverlay` (dans `frontend/src/components/solo/`) sont réutilisés **sans modification** — leurs props actuelles suffisent.
- Aucun changement à `ResultsPage`, à la gestion de plus de 2 joueurs par salon, ni aux 5 autres jeux.

---

### Task 1: Nouveaux événements `ResetMatchScore` / `ScoreReset`

**Files:**
- Modify: `backend/src/events.ts`
- Modify: `frontend/src/lib/socketEvents.ts`

**Interfaces:**
- Produces (backend `events.ts`): `ClientEvents.ResetMatchScore = 'reset-match-score'`, `ServerEvents.ScoreReset = 'score:reset'`.
- Produces (frontend `socketEvents.ts`) : mêmes valeurs, mêmes clés.
- Consumed by: Task 3 (`index.ts`), Task 5 (`RpsMultiplayer.tsx`).

- [ ] **Step 1: Ajouter les valeurs côté backend**

Dans `backend/src/events.ts`, ajouter dans `ServerEvents` (après `RoomError`) :

```ts
  RoomError = 'room:error',
  ScoreReset = 'score:reset'
```

et dans `ClientEvents` (après `LeaveRoom`) :

```ts
  LeaveRoom = 'leave-room',
  ResetMatchScore = 'reset-match-score'
```

- [ ] **Step 2: Ajouter les mêmes valeurs côté frontend**

Dans `frontend/src/lib/socketEvents.ts`, ajouter dans `ClientEvents` (après `LeaveRoom: 'leave-room',`) :

```ts
  LeaveRoom: 'leave-room',
  ResetMatchScore: 'reset-match-score',
```

et dans `ServerEvents` (après `RoomError: 'room:error',`) :

```ts
  RoomError: 'room:error',
  ScoreReset: 'score:reset',
```

- [ ] **Step 3: Vérifier la compilation des deux projets**

Run: `cd backend && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit`
Expected: aucune erreur (ajouts de constantes seulement, rien ne les consomme encore).

- [ ] **Step 4: Commit**

```bash
git add backend/src/events.ts frontend/src/lib/socketEvents.ts
git commit -m "feat: add reset-match-score / score:reset socket events"
```

---

### Task 2: `RoomManager` — `gameId`, scores cumulés, `setRpsChoice`, `resetScores`

**Files:**
- Modify: `backend/src/roomManager.ts`

**Interfaces:**
- Produces:
  - `createRoom(socketId: string, name: string, gameId: string): { roomId: string; players: Player[] }`
  - `joinRoom(roomId: string, socketId: string, name: string, gameId: string): Player[]` (lève une erreur si `gameId` ne correspond pas à celui de la salle)
  - `setRpsChoice(socketId: string, choice: string): { roomId: string; entries: Array<{ socketId: string; yourMove: string; opponentMove: string; outcome: 'player' | 'machine' | 'draw' }>; scores: Record<string, number>; matchOver: boolean; winnerId: string | null } | null`
  - `resetScores(socketId: string): { roomId: string; scores: Record<string, number> }`
- Consumed by: Task 3 (`index.ts`).

- [ ] **Step 1: Remplacer le contenu du fichier**

Remplacer entièrement `backend/src/roomManager.ts` par :

```ts
export type Player = { id: string; name: string };

const TARGET_SCORES: Record<string, number> = {
  rps: 5
};

type RoomState = {
  gameId: string;
  players: Player[];
  choices: Map<string, string>;
  gameData: Record<string, any>;
  scores: Record<string, number>;
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
      scores: { [socketId]: 0 }
    });
    this.socketRoom.set(socketId, roomId);
    return { roomId, players: [player] };
  }

  getRoomId(socketId: string) {
    return this.socketRoom.get(socketId) ?? null;
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

    const firstSum = firstChoice.value + secondChoice.value;
    const firstParity = firstSum % 2 === 0 ? 'pair' : 'impair';
    const firstWon = firstChoice.prediction === firstParity;
    const secondWon = secondChoice.prediction === firstParity;

    if (firstWon === secondWon) {
      return {
        roomId,
        result: [
          { socketId: firstSocket, message: `Égalité (${firstChoice.value} + ${secondChoice.value} = ${firstSum} ${firstParity}).`, score: 0 },
          { socketId: secondSocket, message: `Égalité (${firstChoice.value} + ${secondChoice.value} = ${firstSum} ${firstParity}).`, score: 0 }
        ]
      };
    }

    return {
      roomId,
      result: [
        {
          socketId: firstSocket,
          message: firstWon
            ? `Vous gagnez ! (${firstChoice.value} + ${secondChoice.value} = ${firstSum} ${firstParity}).`
            : `Vous perdez... (${firstChoice.value} + ${secondChoice.value} = ${firstSum} ${firstParity}).`,
          score: firstWon ? 1 : -1
        },
        {
          socketId: secondSocket,
          message: secondWon
            ? `Vous gagnez ! (${firstChoice.value} + ${secondChoice.value} = ${firstSum} ${firstParity}).`
            : `Vous perdez... (${firstChoice.value} + ${secondChoice.value} = ${firstSum} ${firstParity}).`,
          score: secondWon ? 1 : -1
        }
      ]
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
Expected: erreurs dans `index.ts` (attendu — corrigé à la Task 3, qui appelle encore l'ancienne signature de `createRoom`/`joinRoom` et l'ancienne `setChoice`), aucune erreur dans `roomManager.ts` lui-même.

- [ ] **Step 3: Commit**

```bash
git add backend/src/roomManager.ts
git commit -m "feat: track gameId and cumulative scores per room, add setRpsChoice/resetScores"
```

---

### Task 3: `index.ts` — gameId sur les salons, nouveau payload RPS, handler de reset

**Files:**
- Modify: `backend/src/index.ts`

**Interfaces:**
- Consumes: signatures mises à jour de `RoomManager` (Task 2), `ClientEvents.ResetMatchScore`/`ServerEvents.ScoreReset` (Task 1).

- [ ] **Step 1: Mettre à jour le handler `create-room`**

Remplacer :

```ts
  socket.on(ClientEvents.CreateRoom, ({ name }: { name: string }) => {
    try {
      const { roomId, players } = roomManager.createRoom(socket.id, name);
      socket.join(roomId);
      socket.emit(ServerEvents.RoomCreated, { roomId, players });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });
```

par :

```ts
  socket.on(ClientEvents.CreateRoom, ({ name, gameId }: { name: string; gameId: string }) => {
    try {
      const { roomId, players } = roomManager.createRoom(socket.id, name, gameId);
      socket.join(roomId);
      socket.emit(ServerEvents.RoomCreated, { roomId, players });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });
```

- [ ] **Step 2: Mettre à jour le handler `join-room`**

Remplacer :

```ts
  socket.on(ClientEvents.JoinRoom, ({ roomId, name }: { roomId: string; name: string }) => {
    try {
      const players = roomManager.joinRoom(roomId, socket.id, name);
      socket.join(roomId);
      io.to(roomId).emit(ServerEvents.RoomUpdate, { roomId, players });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });
```

par :

```ts
  socket.on(ClientEvents.JoinRoom, ({ roomId, name, gameId }: { roomId: string; name: string; gameId: string }) => {
    try {
      const players = roomManager.joinRoom(roomId, socket.id, name, gameId);
      socket.join(roomId);
      io.to(roomId).emit(ServerEvents.RoomUpdate, { roomId, players });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });
```

- [ ] **Step 3: Mettre à jour le handler `RpsPlay`**

Remplacer :

```ts
  socket.on(ServerEvents.RpsPlay, ({ choice }) => {
    try {
      const result = roomManager.setChoice(socket.id, choice);
      if (!result) {
        socket.emit(ServerEvents.Greeting, { type: ServerEvents.Greeting, payload: 'Choix reçu, en attente du second joueur.' });
        return;
      }

      for (const entry of result.result) {
        io.to(entry.socketId).emit(ServerEvents.RpsResult, entry);
      }
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });
```

par :

```ts
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
```

- [ ] **Step 4: Ajouter le handler `ResetMatchScore`**

Ajouter, juste après le handler `RpsPlay` :

```ts
  socket.on(ClientEvents.ResetMatchScore, () => {
    try {
      const { roomId, scores } = roomManager.resetScores(socket.id);
      io.to(roomId).emit(ServerEvents.ScoreReset, { scores });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });
```

- [ ] **Step 5: Vérifier la compilation TypeScript**

Run: `cd backend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add backend/src/index.ts
git commit -m "feat: pass gameId on room create/join, enrich RPS result payload, add reset-match-score handler"
```

---

### Task 4: `RoomLobbyPage` envoie `gameId` à la création/connexion

**Files:**
- Modify: `frontend/src/pages/RoomLobbyPage.tsx`

**Interfaces:**
- Consumes: aucune nouvelle interface — `gameId` est déjà disponible via `useParams()` dans ce composant.

- [ ] **Step 1: Mettre à jour `handleCreateRoom`**

Remplacer :

```ts
    socket.emit(ClientEvents.CreateRoom, { name: trimmedPseudo });
```

par :

```ts
    socket.emit(ClientEvents.CreateRoom, { name: trimmedPseudo, gameId });
```

- [ ] **Step 2: Mettre à jour `handleJoinRoom`**

Remplacer :

```ts
    socket.emit(ClientEvents.JoinRoom, { roomId: code, name: trimmedPseudo });
```

par :

```ts
    socket.emit(ClientEvents.JoinRoom, { roomId: code, name: trimmedPseudo, gameId });
```

- [ ] **Step 3: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/RoomLobbyPage.tsx
git commit -m "feat: send gameId when creating or joining a multiplayer room"
```

---

### Task 5: Nouveau composant `RpsMultiplayer`

**Files:**
- Create: `frontend/src/games/multiplayer/RpsMultiplayer.tsx`

**Interfaces:**
- Consumes: `useSocket` (`@/hooks/useSocket`), `useGameStore` (`@/store/useGameStore`), `ClientEvents`/`ServerEvents` (`@/lib/socketEvents`, Task 1), `ScorePill` (`@/components/solo/ScorePill`, inchangé), `MatchEndOverlay` (`@/components/solo/MatchEndOverlay`, inchangé), `DuelReveal` (`@/components/solo/reveals/DuelReveal`, inchangé), `type Winner` (`@/lib/soloScore`).
- Produces: `RpsMultiplayer(): JSX.Element`. Consommé par Task 6 (`GamePlayPage.tsx`).

- [ ] **Step 1: Créer le composant**

Créer `frontend/src/games/multiplayer/RpsMultiplayer.tsx` :

```tsx
import { useEffect, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/store/useGameStore';
import { ClientEvents, ServerEvents } from '@/lib/socketEvents';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { DuelReveal } from '@/components/solo/reveals/DuelReveal';
import type { Winner } from '@/lib/soloScore';

const RPS_TARGET_SCORE = 5;
const RPS_MOVES = ['pierre', 'feuille', 'ciseau'] as const;
type RpsMove = (typeof RPS_MOVES)[number];

const moveLabels: Record<RpsMove, string> = {
  pierre: 'Pierre',
  feuille: 'Feuille',
  ciseau: 'Ciseau'
};

const moveEmojis: Record<RpsMove, string> = {
  pierre: '✊',
  feuille: '✋',
  ciseau: '✌️'
};

type RoundResult = {
  yourMove: RpsMove;
  opponentMove: RpsMove;
  outcome: 'player' | 'machine' | 'draw';
};

type RpsResultPayload = {
  yourMove: RpsMove;
  opponentMove: RpsMove;
  outcome: 'player' | 'machine' | 'draw';
  scores: Record<string, number>;
  matchOver: boolean;
  winnerId: string | null;
};

export function RpsMultiplayer() {
  const { socket, socketId } = useSocket();
  const players = useGameStore(state => state.players);
  const [waiting, setWaiting] = useState(false);
  const [round, setRound] = useState<RoundResult | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [matchOver, setMatchOver] = useState(false);
  const [winner, setWinner] = useState<Winner>(null);

  useEffect(() => {
    if (!socket || !socketId) {
      return;
    }

    const handleResult = (data: RpsResultPayload) => {
      setWaiting(false);
      setRound({ yourMove: data.yourMove, opponentMove: data.opponentMove, outcome: data.outcome });
      setScores(data.scores);
      setMatchOver(data.matchOver);
      setWinner(data.winnerId ? (data.winnerId === socketId ? 'player' : 'machine') : null);
    };

    const handleScoreReset = (data: { scores: Record<string, number> }) => {
      setScores(data.scores);
      setMatchOver(false);
      setWinner(null);
      setRound(null);
      setWaiting(false);
    };

    socket.on(ServerEvents.RpsResult, handleResult);
    socket.on(ServerEvents.ScoreReset, handleScoreReset);

    return () => {
      socket.off(ServerEvents.RpsResult, handleResult);
      socket.off(ServerEvents.ScoreReset, handleScoreReset);
    };
  }, [socket, socketId]);

  const opponentId = players.find(player => player.id !== socketId)?.id ?? null;
  const myScore = socketId ? scores[socketId] ?? 0 : 0;
  const opponentScore = opponentId ? scores[opponentId] ?? 0 : 0;

  const playRound = (move: RpsMove) => {
    if (!socket || waiting || round || matchOver) {
      return;
    }
    socket.emit(ClientEvents.RpsPlay, { choice: move });
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
      <ScorePill player={myScore} machine={opponentScore} targetScore={RPS_TARGET_SCORE} onReset={handleReplay} />

      {round ? (
        <DuelReveal
          playerEmoji={moveEmojis[round.yourMove]}
          playerLabel={moveLabels[round.yourMove]}
          machineEmoji={moveEmojis[round.opponentMove]}
          machineLabel={moveLabels[round.opponentMove]}
          outcome={round.outcome}
          onComplete={handleRevealComplete}
        />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {waiting ? 'Choix envoyé, en attente de l’adversaire...' : 'Choisissez pierre, feuille ou ciseau.'}
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            {RPS_MOVES.map(move => (
              <button
                key={move}
                type="button"
                onClick={() => playRound(move)}
                disabled={waiting || matchOver}
                className="flex flex-col items-center gap-2 rounded-2xl border-2 border-border bg-card p-5 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                <span className="text-4xl">{moveEmojis[move]}</span>
                <span className="text-sm font-semibold text-foreground">{moveLabels[move]}</span>
              </button>
            ))}
          </div>
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
git add frontend/src/games/multiplayer/RpsMultiplayer.tsx
git commit -m "feat: add RpsMultiplayer component with score, DuelReveal and match-end overlay"
```

---

### Task 6: Brancher `RpsMultiplayer` dans `GamePlayPage`

**Files:**
- Modify: `frontend/src/pages/GamePlayPage.tsx`

**Interfaces:**
- Consumes: `RpsMultiplayer` (Task 5).

- [ ] **Step 1: Importer le composant**

Ajouter en haut du fichier, après les imports existants :

```ts
import { RpsMultiplayer } from '../games/multiplayer/RpsMultiplayer';
```

- [ ] **Step 2: Retirer la logique RPS devenue inutile**

Supprimer la fonction `handleRpsResult` et son enregistrement/désenregistrement dans le `useEffect` :

```ts
    const handleRpsResult = (data: { socketId: string; message: string; score: number }) => {
      setStatusMessage(data.message);
    };

```
(supprimer ce bloc)

```ts
    socket.on(ServerEvents.RpsResult, handleRpsResult);
```
(supprimer cette ligne dans la liste des `socket.on`)

```ts
      socket.off(ServerEvents.RpsResult, handleRpsResult);
```
(supprimer cette ligne dans la liste des `socket.off`)

Supprimer aussi la fonction `handleRpsPlay` (devenue inutile, gérée par `RpsMultiplayer`) :

```ts
  const handleRpsPlay = (choice: string) => {
    if (!socket) {
      setStatusMessage('Connexion serveur non disponible.');
      return;
    }
    socket.emit(ClientEvents.RpsPlay, { choice });
    setStatusMessage(`Vous avez choisi ${choice}. En attente du résultat...`);
  };

```
(supprimer ce bloc entier)

- [ ] **Step 3: Remplacer le rendu de la zone de jeu**

Remplacer :

```tsx
        <div className="mt-8 rounded-3xl border border-border bg-background p-8 space-y-6">
          <div className="rounded-3xl border border-border bg-surface p-4">
            <p className="text-sm text-muted-foreground">{statusMessage}</p>
          </div>

          {gameId === 'rps' ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {['pierre', 'feuille', 'ciseau'].map(choice => (
                <Button key={choice} onClick={() => handleRpsPlay(choice)}>
                  {choice}
                </Button>
              ))}
            </div>
          ) : gameId === 'odd-or-even' ? (
```

par :

```tsx
        <div className="mt-8">
          {gameId === 'rps' ? (
            <RpsMultiplayer />
          ) : (
          <div className="rounded-3xl border border-border bg-background p-8 space-y-6">
          <div className="rounded-3xl border border-border bg-surface p-4">
            <p className="text-sm text-muted-foreground">{statusMessage}</p>
          </div>

          {gameId === 'odd-or-even' ? (
```

Puis, à la toute fin du bloc `<div className="mt-8 rounded-3xl ...">` (juste avant sa fermeture actuelle `</div>` qui suit le `)` du switch), ajouter la fermeture du nouveau `div` et du conditionnel. Concrètement, la fin du bloc doit passer de :

```tsx
          ) : (
            <div className="rounded-3xl border border-border bg-surface p-6 text-sm text-muted-foreground">
              Ce jeu est en cours de développement. Revenez bientôt pour plus d’options.
            </div>
          )}
        </div>
      </section>
```

à :

```tsx
          ) : (
            <div className="rounded-3xl border border-border bg-surface p-6 text-sm text-muted-foreground">
              Ce jeu est en cours de développement. Revenez bientôt pour plus d’options.
            </div>
          )}
          </div>
          )}
        </div>
      </section>
```

(le premier `)}` ferme le switch interne des 5 autres jeux, la ligne `</div>` ferme le `rounded-3xl border ... space-y-6` ouvert dans ce Step, et le second `)}` ferme le conditionnel `gameId === 'rps' ? <RpsMultiplayer /> : (...)` ouvert au début de ce Step.

- [ ] **Step 4: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur. Vérifier en particulier qu'aucune référence résiduelle à `handleRpsPlay`/`handleRpsResult` ne subsiste (recherche texte si besoin).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/GamePlayPage.tsx
git commit -m "feat: wire RpsMultiplayer into GamePlayPage for the rps game"
```

---

### Task 7: Vérification finale (build, tests, playtest à deux clients)

**Files:** aucun nouveau fichier — vérification de bout en bout.

- [ ] **Step 1: Compilation complète des deux projets**

Run: `cd backend && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 2: Suite de tests frontend existante (inchangée)**

Run: `cd frontend && npm test`
Expected: les 30 tests passent toujours (aucun changement à `frontend/src/lib/*`).

- [ ] **Step 3: Builds de production**

Run: `cd backend && npm run build && cd ../frontend && npm run build`
Expected: build réussi dans les deux cas.

- [ ] **Step 4: Playtest à deux clients**

Démarrer le backend (`cd backend && npm run dev`) et le frontend (`cd frontend && npm run dev`). Avec deux onglets/navigateurs sur le jeu RPS :
- Créer un salon (Alice), rejoindre avec un second pseudo (Bob).
- Démarrer la partie.
- Jouer plusieurs manches : vérifier que `DuelReveal` s'affiche avec les bons emojis pour chaque joueur (son propre coup vs celui de l'adversaire, pas l'inverse), que les barres de score progressent des deux côtés de façon cohérente (si Alice gagne, son score monte et celui de Bob non, et vice versa côté Bob).
- Jouer jusqu'à ce qu'un joueur atteigne 5 points : vérifier que `MatchEndOverlay` s'affiche avec l'emoji géant correspondant (🎉 côté gagnant, 😢 côté perdant) chez les deux joueurs simultanément.
- Cliquer « Nouvelle partie » d'un côté : vérifier que les deux joueurs reviennent à 0-0 et peuvent rejouer.

- [ ] **Step 5: Commit final si des ajustements ont été faits pendant le playtest**

```bash
git add -A
git commit -m "fix: address issues found during multiplayer RPS pilot playtest"
```

(Ne committer que s'il y a effectivement eu des changements.)

---

## Self-Review Notes

- **Spec coverage** : `gameId` sur les salons (Tasks 2-4), score cumulé + cible + fin de partie pour RPS (Task 2-3, 5-6), réutilisation sans modification de `ScorePill`/`DuelReveal`/`MatchEndOverlay` (Task 5), les 5 autres jeux intacts (Task 6 ne touche que la branche `rps`).
- **Cohérence des types** : `outcome: 'player' | 'machine' | 'draw'` (backend `setRpsChoice`, Task 2) correspond exactement au type attendu par `DuelReveal.outcome` (déjà défini dans le solo, inchangé) et à ce que consomme `RpsMultiplayer` (Task 5). `Winner` (`'player' | 'machine' | null'`) vient de `@/lib/soloScore`, réutilisé tel quel sans redéfinition.
- **Risque identifié** : Task 6 modifie un fichier existant volumineux avec des instructions de remplacement de blocs imbriqués (parenthèses/accolades) — l'implémenteur doit relire `GamePlayPage.tsx` en entier après modification pour vérifier que les blocs `{...}`/`(...)` s'équilibrent avant de considérer la tâche terminée, la compilation TypeScript (Step 4) étant le filet de sécurité final.
