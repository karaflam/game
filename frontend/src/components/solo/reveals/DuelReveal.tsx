import { useEffect } from 'react';
import { motion } from 'framer-motion';

type DuelRevealProps = {
  playerEmoji: string;
  playerLabel: string;
  machineEmoji: string;
  machineLabel: string;
  outcome: 'player' | 'machine' | 'draw';
  onComplete: () => void;
};

const DURATION_MS = 2200;

const outcomeText: Record<DuelRevealProps['outcome'], string> = {
  player: 'Vous gagnez la manche !',
  machine: 'Vous perdez la manche...',
  draw: 'Égalité !'
};

export function DuelReveal({ playerEmoji, playerLabel, machineEmoji, machineLabel, outcome, onComplete }: DuelRevealProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, DURATION_MS);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="flex h-56 flex-col items-center justify-center gap-6 rounded-2xl bg-muted px-6">
      <div className="flex flex-1 items-center justify-center gap-10">
        <motion.div
          initial={{ x: -80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex flex-col items-center gap-2"
        >
          <span className="text-6xl">{playerEmoji}</span>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{playerLabel}</span>
        </motion.div>

        <motion.span
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.3, 1.1, 1] }}
          transition={{ duration: 0.6, delay: 0.5, times: [0, 0.35, 0.7, 1] }}
          className="text-xl font-black text-primary"
        >
          VS
        </motion.span>

        <motion.div
          initial={{ x: 80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex flex-col items-center gap-2"
        >
          <span className="text-6xl">{machineEmoji}</span>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{machineLabel}</span>
        </motion.div>
      </div>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1, duration: 0.4 }}
        className="pb-2 text-lg font-bold text-foreground"
      >
        {outcomeText[outcome]}
      </motion.p>
    </div>
  );
}
