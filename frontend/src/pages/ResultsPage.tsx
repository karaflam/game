import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { useGameStore } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';

export function ResultsPage() {
  const navigate = useNavigate();
  const { gameId, roomCode } = useParams();
  const { t } = useTranslation();
  const { socketId } = useSocket();
  const players = useGameStore(state => state.players);
  const scores = useGameStore(state => state.scores);

  const ranking = [...players]
    .map(player => ({ ...player, score: scores[player.id] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  return (
    <motion.main initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <section className="rounded-[2rem] bg-card p-10 shadow-lg shadow-slate-900/5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              aria-label={t('resultsPage.backAriaLabel')}
              className="mt-1 shrink-0"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <p className="font-mono-label text-xs font-semibold uppercase tracking-[0.28em] text-primary">{t('resultsPage.eyebrow')}</p>
              <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-foreground">{t('resultsPage.title')}</h1>
              <p className="mt-4 text-base leading-7 text-muted-foreground">{t('resultsPage.summary', { roomCode, gameName: gameId ? gameId.replace(/-/g, ' ') : t('resultsPage.summaryFallbackGame') })}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-4 rounded-3xl border border-border bg-background p-6">
          {ranking.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('resultsPage.empty')}</p>
          ) : (
            ranking.map((player, index) => (
              <div key={player.id} className="rounded-3xl bg-surface p-4">
                <p className="text-sm font-semibold text-foreground">
                  {index + 1}. {player.name}
                  {player.id === socketId ? t('resultsPage.youTag') : ''}
                </p>
                <p className="text-sm text-muted-foreground">{t('resultsPage.scoreLabel', { score: player.score })}</p>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button onClick={() => navigate('/')}>{t('resultsPage.backHomeButton')}</Button>
          <Button variant="secondary" onClick={() => navigate(`/jeu/${gameId}/mode`)}>
            {t('resultsPage.playAgainButton')}
          </Button>
        </div>
      </section>
    </motion.main>
  );
}
