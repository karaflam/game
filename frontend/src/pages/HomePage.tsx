import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { gameThemes } from '../data/gameThemes';
import { GameCard } from '../components/GameCard';
import type { GameTheme } from '../types/game';
import { useSocket } from '../hooks/useSocket';
import { useGameStore } from '../store/useGameStore';
import { getActiveRoom } from '../lib/playerSession';

export function HomePage() {
  const navigate = useNavigate();
  // The actual (re)join handshake lives in useSocket — calling it here just ensures the shared
  // socket exists and its "resume my active room" logic runs even if HomePage is the very first
  // page the app renders (fresh load / bookmark landing on "/").
  useSocket();
  const roomCode = useGameStore(state => state.roomCode);
  const status = useGameStore(state => state.status);
  const [showRejoining, setShowRejoining] = useState(() => getActiveRoom() !== null);

  useEffect(() => {
    if (!showRejoining) {
      return;
    }
    // Purely a courtesy message — self-clears whether the rejoin succeeds (we've navigated away
    // by then) or fails (nothing left to wait for), without needing extra state plumbing.
    const timer = setTimeout(() => setShowRejoining(false), 4000);
    return () => clearTimeout(timer);
  }, [showRejoining]);

  useEffect(() => {
    const session = getActiveRoom();
    if (!session || roomCode !== session.roomCode) {
      return;
    }
    navigate(
      status === 'in-game'
        ? `/jeu/${session.gameId}/salon/${session.roomCode}/partie`
        : `/jeu/${session.gameId}/salon/${session.roomCode}`
    );
  }, [roomCode, status, navigate]);

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
          {showRejoining ? (
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
