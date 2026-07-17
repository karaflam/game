import { AnimatePresence, motion } from 'framer-motion';
import { Frown, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Winner } from '@/lib/soloScore';

type MatchEndOverlayProps = {
  winner: Winner;
  onReplay: () => void;
};

export function MatchEndOverlay({ winner, onReplay }: MatchEndOverlayProps) {
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
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary"
              >
                <PartyPopper className="h-8 w-8" />
              </motion.div>
            ) : (
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Frown className="h-8 w-8" />
              </div>
            )}
            <h3 className="text-2xl font-bold text-foreground">
              {winner === 'player' ? 'Vous avez gagné la partie !' : 'L’IA a gagné cette fois...'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {winner === 'player'
                ? 'Belle performance face à la machine.'
                : 'Retentez votre chance pour prendre votre revanche.'}
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
