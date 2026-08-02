import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export function ProfilPage() {
  const { t } = useTranslation();
  return (
    <motion.main initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <section className="rounded-[2rem] bg-card p-10 shadow-lg shadow-slate-900/5">
        <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">{t('profilePage.title')}</h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">{t('profilePage.subtitle')}</p>
      </section>
    </motion.main>
  );
}
