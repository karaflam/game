import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { gameThemes } from '../data/gameThemes';
import { GameCard } from '../components/GameCard';
import type { GameTheme } from '../types/game';
import { useSocket } from '../hooks/useSocket';
import { useGameStore, type Player } from '../store/useGameStore';
import { ClientEvents, ServerEvents } from '../lib/socketEvents';
import { getActiveRoom, clearActiveRoom, getPlayerToken, getStoredPseudo } from '../lib/playerSession';

export function HomePage() {
  const navigate = useNavigate();
  const { socket, connected } = useSocket();
  const [rejoining, setRejoining] = useState(false);
  const setGameId = useGameStore(state => state.setGameId);
  const setRoomCode = useGameStore(state => state.setRoomCode);
  const setPlayers = useGameStore(state => state.setPlayers);
  const setStatus = useGameStore(state => state.setStatus);
  const setScores = useGameStore(state => state.setScores);

  useEffect(() => {
    if (!socket || !connected) {
      return;
    }

    const session = getActiveRoom();
    const pseudo = getStoredPseudo().trim();
    if (!session || !pseudo) {
      return;
    }

    setRejoining(true);
    socket.emit(ClientEvents.JoinRoom, { roomId: session.roomCode, name: pseudo, gameId: session.gameId, token: getPlayerToken() });

    const handleUpdate = ({
      players,
      started,
      scores
    }: {
      roomId: string;
      players: Player[];
      started?: boolean;
      scores?: Record<string, number>;
    }) => {
      setRejoining(false);
      setGameId(session.gameId);
      setRoomCode(session.roomCode);
      setPlayers(players);
      setScores(scores ?? {});
      setStatus(started ? 'in-game' : 'waiting');
      navigate(started ? `/jeu/${session.gameId}/salon/${session.roomCode}/partie` : `/jeu/${session.gameId}/salon/${session.roomCode}`);
    };

    const handleError = () => {
      setRejoining(false);
      clearActiveRoom();
    };

    socket.once(ServerEvents.RoomUpdate, handleUpdate);
    socket.once(ServerEvents.RoomError, handleError);

    return () => {
      socket.off(ServerEvents.RoomUpdate, handleUpdate);
      socket.off(ServerEvents.RoomError, handleError);
    };
  }, [socket, connected, navigate, setGameId, setRoomCode, setPlayers, setStatus, setScores]);

  const handleSelectGame = (game: GameTheme) => {
    navigate(`/jeu/${game.id}/mode`);
  };

  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
    >
      <section className="mb-10 rounded-[2rem] bg-card p-10 shadow-lg shadow-slate-900/5">
        <div className="space-y-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">Bienvenue</p>
            <h1 className="mt-4 text-4xl font-bold text-foreground sm:text-5xl">Choisissez un jeu et lancez une partie.</h1>
          </div>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">Sélectionnez votre jeu favori, choisissez Solo ou Multijoueur, puis rejoignez un salon en ligne avec un code unique.</p>
          {rejoining ? (
            <p className="text-sm font-semibold text-primary">Reconnexion à votre salon en cours...</p>
          ) : null}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {gameThemes.map(game => (
          <GameCard key={game.id} game={game} selected={false} onSelect={handleSelectGame} />
        ))}
      </section>
    </motion.main>
  );
}
