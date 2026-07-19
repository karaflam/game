import { create } from 'zustand';

export type Player = { id: string; name: string };

type GameStatus = 'idle' | 'waiting' | 'in-game' | 'finished';

type GameState = {
  gameId: string | null;
  roomCode: string | null;
  players: Player[];
  status: GameStatus;
  error: string | null;
  scores: Record<string, number>;
  // True from the moment the socket drops while we were in an active room session, until the
  // (re)join handshake resolves — drives a global "restoring your game..." overlay so a player
  // returning from the background sees a clear, reassuring wait instead of a seemingly-frozen
  // page that tempts them into an unnecessary manual refresh.
  reconnecting: boolean;
  setGameId: (gameId: string | null) => void;
  setRoomCode: (roomCode: string | null) => void;
  setPlayers: (players: Player[]) => void;
  setStatus: (status: GameStatus) => void;
  setError: (error: string | null) => void;
  setScores: (scores: Record<string, number>) => void;
  setReconnecting: (reconnecting: boolean) => void;
  reset: () => void;
};

export const useGameStore = create<GameState>(set => ({
  gameId: null,
  roomCode: null,
  players: [],
  status: 'idle',
  error: null,
  scores: {},
  reconnecting: false,
  setGameId: gameId => set({ gameId }),
  setRoomCode: roomCode => set({ roomCode }),
  setPlayers: players => set({ players }),
  setStatus: status => set({ status }),
  setError: error => set({ error }),
  setScores: scores => set({ scores }),
  setReconnecting: reconnecting => set({ reconnecting }),
  reset: () => set({ gameId: null, roomCode: null, players: [], status: 'idle', error: null, scores: {}, reconnecting: false })
}));
