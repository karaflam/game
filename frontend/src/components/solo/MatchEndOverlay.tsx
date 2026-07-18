import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import type { Winner } from '@/lib/soloScore';

type MatchEndOverlayProps = {
  winner: Winner;
  onReplay: () => void;
  opponentLabel?: string;
  headlineOverride?: string;
  detailOverride?: string;
};

export function MatchEndOverlay({ winner, onReplay, opponentLabel, headlineOverride, detailOverride }: MatchEndOverlayProps) {
  return (
    <AnimatePresence>
      {winner ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-background/90 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="flex flex-col items-center gap-4 px-6 text-center"
          >
            {winner === 'player' ? (
              <motion.span
                initial={{ scale: 0.3, rotate: -20, opacity: 0 }}
                animate={{ scale: [0.3, 1.3, 1], rotate: [-20, 10, 0], opacity: 1, y: [0, -12, 0] }}
                transition={{ duration: 0.9, times: [0, 0.6, 1] }}
                className="text-8xl"
              >
                🎉
              </motion.span>
            ) : winner === 'draw' ? (
              <motion.span
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1, y: [0, -6, 0] }}
                transition={{ duration: 0.8, ease: 'easeInOut' }}
                className="text-8xl"
              >
                🤝
              </motion.span>
            ) : (
              <motion.span
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1, y: [0, 4, 0] }}
                transition={{ duration: 0.7, ease: 'easeInOut' }}
                className="text-8xl"
              >
                😢
              </motion.span>
            )}
            <h3 className="text-2xl font-bold text-foreground">
              {headlineOverride ??
                (winner === 'player'
                  ? 'Vous avez gagné la partie !'
                  : winner === 'draw'
                    ? 'Égalité !'
                    : `${opponentLabel ?? 'L’IA'} a gagné cette fois...`)}
            </h3>
            <p className="text-sm text-muted-foreground">
              {detailOverride ??
                (winner === 'player'
                  ? `Belle performance face à ${opponentLabel ?? 'la machine'}.`
                  : winner === 'draw'
                    ? 'Personne ne prend l’avantage, belle partie serrée.'
                    : 'Retentez votre chance pour prendre votre revanche.')}
            </p>
            <Button type="button" onClick={onReplay}>
              Nouvelle partie
            </Button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
