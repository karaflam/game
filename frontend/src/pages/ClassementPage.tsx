import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export function ClassementPage() {
  const { t } = useTranslation();
  return (
    <motion.main initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <section className="rounded-2xl bg-card p-10 shadow-lg shadow-slate-900/5">
        <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">{t('leaderboardPage.title')}</h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">{t('leaderboardPage.subtitle')}</p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div className="rounded-3xl border border-border bg-background p-6">
            <p className="text-sm leading-6 text-muted-foreground">{t('leaderboardPage.emptyTitle')}</p>
          </div>
          <div className="rounded-3xl border border-border bg-background p-6">
            <p className="text-sm leading-6 text-muted-foreground">{t('leaderboardPage.emptySubtitle')}</p>
          </div>
        </div>
      </section>
    </motion.main>
  );
}
