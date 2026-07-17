# Multiplayer Pseudo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Demander un pseudo au joueur à la création/connexion d'un salon multijoueur, et l'utiliser partout où l'identité d'un joueur est affichée à la place du `socket.id` brut.

**Architecture:** `RoomManager.players` passe de `string[]` à `Player[]` (`{ id, name }`) côté backend ; le store Zustand et les pages qui consomment `players` sont mis à jour en conséquence côté frontend. Un champ pseudo est ajouté sur `RoomLobbyPage`, envoyé dans les payloads `create-room`/`join-room`.

**Tech Stack:** Node/Express/socket.io (backend, TypeScript), React/Zustand (frontend, TypeScript).

## Global Constraints

- Pseudo requis (non vide après `trim()`), longueur max 20 caractères (`maxLength` HTML).
- Pas de vérification d'unicité des pseudos dans un salon (hors scope).
- `ResultsPage` et la limite à 2 joueurs par salon restent hors scope (spec `2026-07-17-multiplayer-pseudo-design.md`).
- Aucun nouveau nom d'événement socket.io — seuls les payloads `create-room`/`join-room` changent de forme.

---

### Task 1: Backend — `RoomManager` utilise des `Player` au lieu de `socket.id` bruts

**Files:**
- Modify: `backend/src/roomManager.ts`

**Interfaces:**
- Produces: `export type Player = { id: string; name: string }`. `createRoom(socketId: string, name: string): { roomId: string; players: Player[] }`. `joinRoom(roomId: string, socketId: string, name: string): Player[]`. `leaveRoom(socketId: string): { roomId: string; players: Player[] } | null`. `getPlayers(roomId: string): Player[]`.
- Consumed by: Task 2 (`backend/src/index.ts`).

- [ ] **Step 1: Remplacer le contenu du fichier**

Remplacer entièrement `backend/src/roomManager.ts` par :

```ts
export type Player = { id: string; name: string };

type RoomState = {
  players: Player[];
  choices: Map<string, string>;
  gameData: Record<string, any>;
};

function generateRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export class RoomManager {
  private rooms = new Map<string, RoomState>();
  private socketRoom = new Map<string, string>();

  createRoom(socketId: string, name: string) {
    const roomId = generateRoomId();
    const player: Player = { id: socketId, name };
    this.rooms.set(roomId, { players: [player], choices: new Map(), gameData: {} });
    this.socketRoom.set(socketId, roomId);
    return { roomId, players: [player] };
  }

  getRoomId(socketId: string) {
    return this.socketRoom.get(socketId) ?? null;
  }

  getPlayers(roomId: string) {
    return this.rooms.get(roomId)?.players ?? [];
  }

  joinRoom(roomId: string, socketId: string, name: string) {
    if (!this.rooms.has(roomId)) {
      throw new Error('Salle introuvable.');
    }

    const room = this.rooms.get(roomId)!;
    if (room.players.some(player => player.id === socketId)) {
      return room.players;
    }

    room.players.push({ id: socketId, name });
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
    this.socketRoom.delete(socketId);

    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      return null;
    }

    return { roomId, players: room.players };
  }

  setChoice(socketId: string, choice: string) {
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

    const result = this.computeResult(firstSocket, firstChoice, secondSocket, secondChoice);
    return { roomId, result };
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

  private computeResult(
    firstSocket: string,
    firstChoice: string,
    secondSocket: string,
    secondChoice: string
  ) {
    if (firstChoice === secondChoice) {
      return [
        { socketId: firstSocket, message: `Égalité (${firstChoice} / ${secondChoice}).`, score: 0 },
        { socketId: secondSocket, message: `Égalité (${firstChoice} / ${secondChoice}).`, score: 0 }
      ];
    }

    const winMap: Record<string, string> = {
      pierre: 'ciseau',
      feuille: 'pierre',
      ciseau: 'feuille'
    };

    if (winMap[firstChoice] === secondChoice) {
      return [
        { socketId: firstSocket, message: `Vous gagnez ! (${firstChoice} bat ${secondChoice}).`, score: 1 },
        { socketId: secondSocket, message: `Vous perdez... (${secondChoice} perd contre ${firstChoice}).`, score: -1 }
      ];
    }

    return [
      { socketId: firstSocket, message: `Vous perdez... (${firstChoice} perd contre ${secondChoice}).`, score: -1 },
      { socketId: secondSocket, message: `Vous gagnez ! (${secondChoice} bat ${firstChoice}).`, score: 1 }
    ];
  }
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `cd backend && npx tsc --noEmit`
Expected: erreurs dans `index.ts` (attendu — corrigé à la Task 2), aucune erreur dans `roomManager.ts` lui-même.

- [ ] **Step 3: Commit**

```bash
git add backend/src/roomManager.ts
git commit -m "feat: track players as {id, name} in RoomManager instead of raw socket ids"
```

---

### Task 2: Backend — `index.ts` accepte le pseudo et l'utilise

**Files:**
- Modify: `backend/src/index.ts`

**Interfaces:**
- Consumes: `Player` type et signatures mises à jour de `RoomManager` (Task 1).

- [ ] **Step 1: Mettre à jour le handler `create-room`**

Dans `backend/src/index.ts`, remplacer :

```ts
  socket.on(ClientEvents.CreateRoom, () => {
    try {
      const { roomId, players } = roomManager.createRoom(socket.id);
      socket.join(roomId);
      socket.emit(ServerEvents.RoomCreated, { roomId, players });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });
```

par :

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

- [ ] **Step 2: Mettre à jour le handler `join-room`**

Remplacer :

```ts
  socket.on(ClientEvents.JoinRoom, ({ roomId }) => {
    try {
      const players = roomManager.joinRoom(roomId, socket.id);
      socket.join(roomId);
      io.to(roomId).emit(ServerEvents.RoomUpdate, { roomId, players });
    } catch (error) {
      socket.emit(ServerEvents.RoomError, { message: (error as Error).message });
    }
  });
```

par :

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

- [ ] **Step 3: Mettre à jour la boucle Action ou Vérité (`TruthOrDareStart`) pour utiliser le vrai nom**

Remplacer :

```ts
      const prompt = truthOrDarePrompts[Math.floor(Math.random() * truthOrDarePrompts.length)];
      const activeIndex = Math.floor(Math.random() * players.length);
      roomManager.setGameData(socket.id, 'truthOrDare', { prompt, activeIndex });

      io.to(roomId).emit(ServerEvents.TruthOrDareUpdate, {
        prompt,
        activePlayer: `Joueur ${activeIndex + 1}`
      });
```

par :

```ts
      const prompt = truthOrDarePrompts[Math.floor(Math.random() * truthOrDarePrompts.length)];
      const activeIndex = Math.floor(Math.random() * players.length);
      roomManager.setGameData(socket.id, 'truthOrDare', { prompt, activeIndex });

      io.to(roomId).emit(ServerEvents.TruthOrDareUpdate, {
        prompt,
        activePlayer: players[activeIndex].name
      });
```

- [ ] **Step 4: Mettre à jour la boucle `TruthOrDareChoice`**

Remplacer :

```ts
      const players = roomManager.getPlayers(roomId);

      for (const playerSocketId of players) {
        const score = playerSocketId === socket.id ? 1 : 0;
        io.to(playerSocketId).emit(ServerEvents.TruthOrDareResult, {
          socketId: socket.id,
          message,
          score
        });
      }
```

par :

```ts
      const players = roomManager.getPlayers(roomId);

      for (const player of players) {
        const score = player.id === socket.id ? 1 : 0;
        io.to(player.id).emit(ServerEvents.TruthOrDareResult, {
          socketId: socket.id,
          message,
          score
        });
      }
```

- [ ] **Step 5: Mettre à jour la boucle `WouldYouRatherChoice`**

Remplacer :

```ts
      const players = roomManager.getPlayers(roomId);

      for (const playerSocketId of players) {
        const score = playerSocketId === socket.id ? 1 : 0;
        io.to(playerSocketId).emit(ServerEvents.WouldYouRatherResult, {
          socketId: socket.id,
          message,
          score
        });
      }
```

par :

```ts
      const players = roomManager.getPlayers(roomId);

      for (const player of players) {
        const score = player.id === socket.id ? 1 : 0;
        io.to(player.id).emit(ServerEvents.WouldYouRatherResult, {
          socketId: socket.id,
          message,
          score
        });
      }
```

- [ ] **Step 6: Mettre à jour les deux boucles `TwentyQuestionsGuess` (bonne réponse et essais épuisés)**

Remplacer :

```ts
      if (guess.toLowerCase().trim() === answer) {
        roomManager.clearGameData(socket.id, 'twentyQuestions');
        for (const playerSocketId of players) {
          const score = playerSocketId === socket.id ? 1 : 0;
          io.to(playerSocketId).emit(ServerEvents.TwentyQuestionsResult, {
            socketId: socket.id,
            message: `Bravo ! Le mot était ${answer}.`,
            score
          });
        }
        return;
      }

      if (gameData.attempts >= 20) {
        roomManager.clearGameData(socket.id, 'twentyQuestions');
        for (const playerSocketId of players) {
          const score = playerSocketId === socket.id ? 0 : 1;
          io.to(playerSocketId).emit(ServerEvents.TwentyQuestionsResult, {
            socketId: socket.id,
            message: `Temps écoulé. Le mot était ${answer}.`,
            score
          });
        }
        return;
      }
```

par :

```ts
      if (guess.toLowerCase().trim() === answer) {
        roomManager.clearGameData(socket.id, 'twentyQuestions');
        for (const player of players) {
          const score = player.id === socket.id ? 1 : 0;
          io.to(player.id).emit(ServerEvents.TwentyQuestionsResult, {
            socketId: socket.id,
            message: `Bravo ! Le mot était ${answer}.`,
            score
          });
        }
        return;
      }

      if (gameData.attempts >= 20) {
        roomManager.clearGameData(socket.id, 'twentyQuestions');
        for (const player of players) {
          const score = player.id === socket.id ? 0 : 1;
          io.to(player.id).emit(ServerEvents.TwentyQuestionsResult, {
            socketId: socket.id,
            message: `Temps écoulé. Le mot était ${answer}.`,
            score
          });
        }
        return;
      }
```

- [ ] **Step 7: Mettre à jour la boucle `TwoTruthsOneLieVote`**

Remplacer :

```ts
      const submitter = gameData.submitter as string;
      const players = roomManager.getPlayers(roomId);
      const message = correct ? 'Vote correct !' : 'Vote incorrect...';

      for (const playerSocketId of players) {
        const score = playerSocketId === socket.id ? (correct ? 1 : 0) : playerSocketId === submitter ? (correct ? 0 : 1) : 0;
        io.to(playerSocketId).emit(ServerEvents.TwoTruthsOneLieResult, {
          socketId: socket.id,
          message: `${message} La phrase ${gameData.lieIndex + 1} était le mensonge.`,
          score
        });
      }
```

par :

```ts
      const submitter = gameData.submitter as string;
      const players = roomManager.getPlayers(roomId);
      const message = correct ? 'Vote correct !' : 'Vote incorrect...';

      for (const player of players) {
        const score = player.id === socket.id ? (correct ? 1 : 0) : player.id === submitter ? (correct ? 0 : 1) : 0;
        io.to(player.id).emit(ServerEvents.TwoTruthsOneLieResult, {
          socketId: socket.id,
          message: `${message} La phrase ${gameData.lieIndex + 1} était le mensonge.`,
          score
        });
      }
```

- [ ] **Step 8: Vérifier la compilation TypeScript**

Run: `cd backend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 9: Commit**

```bash
git add backend/src/index.ts
git commit -m "feat: accept player name on room create/join and use it in truth-or-dare messages"
```

---

### Task 3: Frontend — `useGameStore` utilise `Player[]`

**Files:**
- Modify: `frontend/src/store/useGameStore.ts`

**Interfaces:**
- Produces: `export type Player = { id: string; name: string }`. `players: Player[]`. `setPlayers: (players: Player[]) => void`.
- Consumed by: Task 4 (`useSocket.ts`), Task 5 (`RoomLobbyPage.tsx`), Task 6 (`RoomWaitingPage.tsx`).

- [ ] **Step 1: Remplacer le contenu du fichier**

Remplacer entièrement `frontend/src/store/useGameStore.ts` par :

```ts
import { create } from 'zustand';

export type Player = { id: string; name: string };

type GameStatus = 'idle' | 'waiting' | 'in-game' | 'finished';

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

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: erreurs dans les fichiers consommateurs (attendu — corrigées aux tâches suivantes), aucune erreur dans `useGameStore.ts` lui-même.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/store/useGameStore.ts
git commit -m "feat: type useGameStore players as Player[] ({id, name})"
```

---

### Task 4: Frontend — `useSocket` type le payload `room:update`

**Files:**
- Modify: `frontend/src/hooks/useSocket.ts`

**Interfaces:**
- Consumes: `type Player` de `../store/useGameStore` (Task 3).

- [ ] **Step 1: Mettre à jour l'import et le typage du handler**

Dans `frontend/src/hooks/useSocket.ts`, remplacer :

```ts
import { getSocket, disconnectSocket } from '../lib/socketClient';
import { ServerEvents } from '../lib/socketEvents';
import { useGameStore } from '../store/useGameStore';
```

par :

```ts
import { getSocket, disconnectSocket } from '../lib/socketClient';
import { ServerEvents } from '../lib/socketEvents';
import { useGameStore, type Player } from '../store/useGameStore';
```

Puis remplacer :

```ts
    const handleRoomUpdate = ({ players }: { roomId: string; players: string[] }) => {
      setPlayers(players);
      setStatus('waiting');
    };
```

par :

```ts
    const handleRoomUpdate = ({ players }: { roomId: string; players: Player[] }) => {
      setPlayers(players);
      setStatus('waiting');
    };
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur dans `useSocket.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useSocket.ts
git commit -m "feat: type room:update payload as Player[] in useSocket"
```

---

### Task 5: Frontend — champ pseudo sur `RoomLobbyPage`

**Files:**
- Modify: `frontend/src/pages/RoomLobbyPage.tsx`

**Interfaces:**
- Consumes: `disconnectSocket`/`getSocket` inchangés ; `useGameStore` (Task 3, `setPlayers` attend désormais `Player[]`, déjà fourni tel quel par le serveur).

- [ ] **Step 1: Remplacer le contenu du fichier**

Remplacer entièrement `frontend/src/pages/RoomLobbyPage.tsx` par :

```tsx
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { gameThemes } from '../data/gameThemes';
import { useSocket } from '../hooks/useSocket';
import { ClientEvents, ServerEvents } from '../lib/socketEvents';
import { useGameStore } from '../store/useGameStore';

const PSEUDO_STORAGE_KEY = 'game:pseudo';
const PSEUDO_MAX_LENGTH = 20;

export function RoomLobbyPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const game = useMemo(() => (gameId ? gameThemes.find(item => item.id === gameId) : null), [gameId]);
  const [pseudo, setPseudo] = useState(() => {
    try {
      return localStorage.getItem(PSEUDO_STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const setGameId = useGameStore(state => state.setGameId);
  const setRoomCode = useGameStore(state => state.setRoomCode);
  const setPlayers = useGameStore(state => state.setPlayers);
  const setStatus = useGameStore(state => state.setStatus);

  if (!game || !gameId) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-3xl px-4 py-10 text-center">
        <h2 className="text-2xl font-semibold text-foreground">Jeu introuvable</h2>
        <p className="mt-3 text-sm text-muted-foreground">Retournez à l’accueil et choisissez un jeu pour commencer.</p>
      </motion.div>
    );
  }

  const handlePseudoChange = (value: string) => {
    setPseudo(value);
    try {
      localStorage.setItem(PSEUDO_STORAGE_KEY, value);
    } catch {
      // ignore
    }
  };

  const trimmedPseudo = pseudo.trim();

  const handleCreateRoom = () => {
    if (!trimmedPseudo) {
      setError('Veuillez saisir un pseudo.');
      return;
    }

    if (!socket) {
      setError('Connexion serveur non disponible.');
      return;
    }

    socket.emit(ClientEvents.CreateRoom, { name: trimmedPseudo });
    socket.once(ServerEvents.RoomCreated, ({ roomId, players }) => {
      setGameId(gameId);
      setRoomCode(roomId);
      setPlayers(players);
      setStatus('waiting');
      navigate(`/jeu/${gameId}/salon/${roomId}`);
    });
    socket.once(ServerEvents.RoomError, ({ message }) => {
      setError(message);
    });
  };

  const handleJoinRoom = () => {
    if (!trimmedPseudo) {
      setError('Veuillez saisir un pseudo.');
      return;
    }

    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setError('Veuillez saisir un code de salon.');
      return;
    }

    if (!socket) {
      setError('Connexion serveur non disponible.');
      return;
    }

    socket.emit(ClientEvents.JoinRoom, { roomId: code, name: trimmedPseudo });
    socket.once(ServerEvents.RoomUpdate, ({ players }) => {
      setGameId(gameId);
      setRoomCode(code);
      setPlayers(players);
      setStatus('waiting');
      navigate(`/jeu/${gameId}/salon/${code}`);
    });
    socket.once(ServerEvents.RoomError, ({ message }) => {
      setError(message);
    });
  };

  return (
    <motion.main initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <section className="mb-10 rounded-[2rem] bg-card p-10 shadow-lg shadow-slate-900/5">
        <div className="space-y-6">
          <div>
            <h1 className="text-4xl font-bold text-foreground">{game.title}</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">{game.description}</p>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-border bg-background p-6">
          <label className="block text-sm font-semibold text-foreground" htmlFor="pseudo">
            Votre pseudo
          </label>
          <p className="mt-1 text-sm text-muted-foreground">C’est ce nom qui sera affiché aux autres joueurs pendant la partie.</p>
          <input
            id="pseudo"
            value={pseudo}
            onChange={event => handlePseudoChange(event.target.value)}
            maxLength={PSEUDO_MAX_LENGTH}
            placeholder="Ex : Alex"
            className="mt-3 w-full max-w-sm rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {error ? (
          <div className="mt-6 rounded-3xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-border bg-background p-6">
            <h2 className="text-xl font-semibold text-foreground">Créer un salon</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Générez un code unique et invitez vos amis pour rejoindre votre partie.</p>
            <Button className="mt-4" onClick={handleCreateRoom} disabled={!trimmedPseudo}>
              Créer un salon
            </Button>
          </div>
          <div className="rounded-3xl border border-border bg-background p-6">
            <h2 className="text-xl font-semibold text-foreground">Rejoindre un salon</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Entrez le code du salon que vous avez reçu pour intégrer la partie.</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                value={joinCode}
                onChange={event => setJoinCode(event.target.value)}
                placeholder="Code du salon"
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <Button variant="secondary" onClick={handleJoinRoom} disabled={!trimmedPseudo}>
                Rejoindre
              </Button>
            </div>
          </div>
        </div>
      </section>
    </motion.main>
  );
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur dans `RoomLobbyPage.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/RoomLobbyPage.tsx
git commit -m "feat: ask for a pseudo before creating or joining a multiplayer room"
```

---

### Task 6: Frontend — `RoomWaitingPage` affiche les pseudos

**Files:**
- Modify: `frontend/src/pages/RoomWaitingPage.tsx`

**Interfaces:**
- Consumes: `players: Player[]` du store (Task 3).

- [ ] **Step 1: Mettre à jour la logique d'hôte et le rendu de la liste**

Dans `frontend/src/pages/RoomWaitingPage.tsx`, remplacer :

```ts
  const isHost = socketId !== null && socketId === players[0];
  const canStart = players.length > 1 && isHost;
  const host = players[0] ?? 'Hôte';
```

par :

```ts
  const isHost = socketId !== null && socketId === players[0]?.id;
  const canStart = players.length > 1 && isHost;
  const host = players[0]?.name ?? 'Hôte';
```

Puis remplacer le bloc de rendu de la liste :

```tsx
              {players.length > 0 ? (
                players.map(player => (
                  <div key={player} className="rounded-2xl bg-card p-3 text-sm text-foreground shadow-sm">
                    {player === host ? `${player} (hôte)` : player}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Aucun joueur connecté pour le moment.</p>
              )}
```

par :

```tsx
              {players.length > 0 ? (
                players.map(player => (
                  <div key={player.id} className="rounded-2xl bg-card p-3 text-sm text-foreground shadow-sm">
                    {player.name === host ? `${player.name} (hôte)` : player.name}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Aucun joueur connecté pour le moment.</p>
              )}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/RoomWaitingPage.tsx
git commit -m "feat: display player pseudos instead of raw socket ids in the waiting room"
```

---

### Task 7: Vérification finale (build, tests existants, playtest multijoueur à deux clients)

**Files:** aucun nouveau fichier — vérification de bout en bout.

- [ ] **Step 1: Vérifier la compilation complète des deux projets**

Run: `cd backend && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit`
Expected: aucune erreur dans les deux.

- [ ] **Step 2: Lancer la suite de tests frontend existante (inchangée)**

Run: `cd frontend && npm test`
Expected: les 30 tests passent toujours (aucun changement à la logique pure des jeux).

- [ ] **Step 3: Build de production des deux projets**

Run: `cd backend && npm run build && cd ../frontend && npm run build`
Expected: build réussi dans les deux cas.

- [ ] **Step 4: Playtest manuel à deux clients**

Démarrer le backend (`cd backend && npm run dev`) et le frontend (`cd frontend && npm run dev`). Ouvrir deux onglets/navigateurs :
- Onglet A : saisir un pseudo (ex. "Alice"), créer un salon sur un jeu (ex. RPS).
- Onglet B : saisir un pseudo différent (ex. "Bob"), rejoindre le salon avec le code affiché dans l'onglet A.

Vérifier :
- La salle d'attente des deux onglets affiche "Alice" et "Bob" (pas de `socket.id`), avec "(hôte)" à côté du bon nom.
- Démarrer la partie, jouer une manche de RPS ou Action ou Vérité, et vérifier que le message "Action ou Vérité" affiche un vrai pseudo (`activePlayer`) plutôt que "Joueur 1"/"Joueur 2".
- Tenter de créer/rejoindre un salon sans pseudo : les boutons doivent rester désactivés.

- [ ] **Step 5: Commit final si des ajustements ont été faits pendant le playtest**

```bash
git add -A
git commit -m "fix: address issues found during multiplayer pseudo playtest"
```

(Ne committer que s'il y a effectivement eu des changements.)

---

## Self-Review Notes

- **Spec coverage** : demande du pseudo (Task 5), affichage partout où l'identité était un `socket.id` (Task 6, RoomWaitingPage ; message Action ou Vérité, Task 2 Step 3), typage `Player` bout en bout backend→frontend (Tasks 1, 3, 4).
- **Cohérence des types** : `Player = { id: string; name: string }` défini une seule fois côté backend (`roomManager.ts`) et une seule fois côté frontend (`useGameStore.ts`), réutilisé tel quel partout ailleurs (aucune redéfinition divergente).
- **Hors scope confirmé** : `ResultsPage`, limite à 2 joueurs, unicité des pseudos — non touchés, conformément à la spec.
