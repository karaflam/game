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
