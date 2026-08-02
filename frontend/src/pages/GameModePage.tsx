import { motion } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { gameThemes } from '../data/gameThemes';

export function GameModePage() {
  const { gameId } = useParams();
  const { t } = useTranslation();
  const game = gameThemes.find(item => item.id === gameId);

  if (!game) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-3xl px-4 py-8 text-center">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">{t('gameModePage.notFoundTitle')}</h2>
        <p className="mt-3 text-sm text-muted-foreground">{t('gameModePage.notFoundMessage')}</p>
      </motion.div>
    );
  }

  return (
    <motion.main initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <section className="mb-10 rounded-2xl bg-card p-10 shadow-lg shadow-slate-900/5">
        <div className="space-y-6">
          <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">{t(`games.${game.id}.title`)}</h1>
          <p className="max-w-3xl text-lg leading-8 text-muted-foreground">{t(`games.${game.id}.description`)}</p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Link to={`/jeu/${gameId}/salon/solo`} className="rounded-3xl border border-border bg-background p-8 transition-all hover:-translate-y-1 hover:shadow-lg">
          <span className="font-mono-label text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t('gameModePage.soloEyebrow')}</span>
          <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight text-foreground">{t('gameModePage.soloTitle')}</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{t('gameModePage.soloDescription')}</p>
        </Link>

        <Link to={`/jeu/${gameId}/salon/creer`} className="rounded-3xl border border-border bg-background p-8 transition-all hover:-translate-y-1 hover:shadow-lg">
          <span className="font-mono-label text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t('gameModePage.multiplayerEyebrow')}</span>
          <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight text-foreground">{t('gameModePage.multiplayerTitle')}</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{t('gameModePage.multiplayerDescription')}</p>
        </Link>
      </div>
    </motion.main>
  );
}
