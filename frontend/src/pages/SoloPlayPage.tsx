import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { gameThemes } from '../data/gameThemes';
import { RpsSolo } from '../games/solo/RpsSolo';
import { OddOrEvenSolo } from '../games/solo/OddOrEvenSolo';
import { TwentyQuestionsSolo } from '../games/solo/TwentyQuestionsSolo';
import { TruthOrDareSolo } from '../games/solo/TruthOrDareSolo';
import { WouldYouRatherSolo } from '../games/solo/WouldYouRatherSolo';
import { TwoTruthsOneLieSolo } from '../games/solo/TwoTruthsOneLieSolo';

export function SoloPlayPage() {
  const { gameId } = useParams();
  const { t } = useTranslation();
  const game = gameThemes.find(item => item.id === gameId);

  return (
    <motion.main initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <section className="rounded-[2rem] bg-card p-10 shadow-lg shadow-slate-900/5">
        <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">{t('soloPlayPage.title', { gameName: game ? t(`games.${game.id}.title`) : gameId?.replace(/-/g, ' ') })}</h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">{t('soloPlayPage.subtitle')}</p>

        <div className="mt-8">
          {gameId === 'rps' ? (
            <RpsSolo />
          ) : gameId === 'odd-or-even' ? (
            <OddOrEvenSolo />
          ) : gameId === '20-questions' ? (
            <TwentyQuestionsSolo />
          ) : gameId === 'truth-or-dare' ? (
            <TruthOrDareSolo />
          ) : gameId === 'would-you-rather' ? (
            <WouldYouRatherSolo />
          ) : gameId === 'two-truths-one-lie' ? (
            <TwoTruthsOneLieSolo />
          ) : (
            <div className="rounded-3xl border border-border bg-background p-8">
              <p className="text-sm leading-6 text-muted-foreground">{t('soloPlayPage.notImplemented')}</p>
            </div>
          )}
        </div>
      </section>
    </motion.main>
  );
}
