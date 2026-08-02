import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { gameThemes } from '../data/gameThemes';
import { GameCard } from '../components/GameCard';
import { Button } from '../components/ui/button';
import type { GameTheme } from '../types/game';
import { useSocket } from '../hooks/useSocket';
import { useGameStore } from '../store/useGameStore';
import { getActiveRoom } from '../lib/playerSession';

export function HomePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  // The actual (re)join handshake lives in useSocket — calling it here just ensures the shared
  // socket exists and its "resume my active room" logic runs even if HomePage is the very first
  // page the app renders (fresh load / bookmark landing on "/"). The global ReconnectingOverlay
  // (driven by the same hook) already shows a "please wait" state while that's in flight.
  useSocket();
  const roomCode = useGameStore(state => state.roomCode);
  const status = useGameStore(state => state.status);

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
      className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
    >
      <section className="mb-10 rounded-2xl bg-card p-10 shadow-lg shadow-slate-900/5">
        <div className="space-y-6">
          <div>
            <p className="font-mono-label text-sm font-semibold uppercase tracking-[0.28em] text-primary">{t('home.eyebrow')}</p>
            <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-foreground sm:text-6xl">{t('home.title')}</h1>
          </div>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">{t('home.subtitle')}</p>
          <Button variant="secondary" onClick={() => navigate('/rejoindre')}>
            {t('home.joinButton')}
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {gameThemes.map(game => (
          <GameCard key={game.id} game={game} selected={false} onSelect={handleSelectGame} />
        ))}
      </section>
    </motion.main>
  );
}
