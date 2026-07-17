import { useEffect } from 'react';
import { motion } from 'framer-motion';

type PlayerWheelProps = {
  players: string[];
  landedOn: string;
  spinning: boolean;
  onSpinComplete: () => void;
};

const SPIN_DURATION_MS = 1500;
const DECORATIVE_DOTS = 2;

export function PlayerWheel({ players, landedOn, spinning, onSpinComplete }: PlayerWheelProps) {
  useEffect(() => {
    if (!spinning) {
      return;
    }
    const timer = setTimeout(onSpinComplete, SPIN_DURATION_MS);
    return () => clearTimeout(timer);
  }, [spinning, onSpinComplete]);

  const otherPlayers = players.filter(player => player !== landedOn).slice(0, 2);

  return (
    <div className="flex items-center justify-center gap-3 rounded-2xl bg-muted py-8">
      {Array.from({ length: DECORATIVE_DOTS }).map((_, index) => (
        <div key={`left-${index}`} className="h-10 w-10 rounded-full bg-border opacity-40" />
      ))}

      <motion.div
        animate={
          spinning
            ? { x: [0, -14, 14, -8, 8, 0], opacity: [1, 0.6, 0.6, 0.8, 0.8, 1] }
            : { x: 0, opacity: 1 }
        }
        transition={{ duration: SPIN_DURATION_MS / 1000, ease: 'easeInOut' }}
        className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-card bg-primary text-center text-sm font-bold text-primary-foreground shadow-lg shadow-primary/40"
      >
        {landedOn}
      </motion.div>

      {otherPlayers.map(player => (
        <div
          key={player}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-card text-xs font-semibold text-muted-foreground opacity-70"
        >
          {player}
        </div>
      ))}

      {Array.from({ length: DECORATIVE_DOTS }).map((_, index) => (
        <div key={`right-${index}`} className="h-10 w-10 rounded-full bg-border opacity-40" />
      ))}
    </div>
  );
}
