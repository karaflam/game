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
    <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl bg-muted px-3 py-8">
      {Array.from({ length: DECORATIVE_DOTS }).map((_, index) => (
        <div key={`left-${index}`} className="hidden h-10 w-10 shrink-0 rounded-full bg-border opacity-40 sm:block" />
      ))}

      <motion.div
        animate={
          spinning
            ? { x: [0, -14, 14, -8, 8, 0], opacity: [1, 0.6, 0.6, 0.8, 0.8, 1] }
            : { x: 0, opacity: 1 }
        }
        transition={{ duration: SPIN_DURATION_MS / 1000, ease: 'easeInOut' }}
        className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-card bg-primary p-1 text-center text-xs font-bold text-primary-foreground shadow-lg shadow-primary/40 sm:h-20 sm:w-20 sm:text-sm"
      >
        <span className="truncate">{landedOn}</span>
      </motion.div>

      {otherPlayers.map(player => (
        <div
          key={player}
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card p-1 text-[10px] font-semibold text-muted-foreground opacity-70 sm:h-14 sm:w-14 sm:text-xs"
        >
          <span className="truncate">{player}</span>
        </div>
      ))}

      {Array.from({ length: DECORATIVE_DOTS }).map((_, index) => (
        <div key={`right-${index}`} className="hidden h-10 w-10 shrink-0 rounded-full bg-border opacity-40 sm:block" />
      ))}
    </div>
  );
}
