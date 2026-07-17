import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

export type FlipCard = { id: string; content: ReactNode; highlight?: boolean };

type FlipRevealProps = {
  cards: FlipCard[];
  outcomeLabel?: string;
  cardSize?: 'sm' | 'lg';
  onComplete: () => void;
};

const DURATION_MS = 2000;

const SIZE_CLASSES: Record<'sm' | 'lg', { wrapper: string; text: string }> = {
  sm: { wrapper: 'h-28 w-20', text: 'text-3xl font-bold' },
  lg: { wrapper: 'min-h-32 w-64 px-4 py-3', text: 'text-sm font-medium leading-6' }
};

export function FlipReveal({ cards, outcomeLabel, cardSize = 'sm', onComplete }: FlipRevealProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, DURATION_MS);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const sizeClasses = SIZE_CLASSES[cardSize];

  return (
    <div className="flex min-h-56 flex-col items-center justify-center gap-6 rounded-2xl bg-muted p-6">
      <div className="flex flex-wrap items-center justify-center gap-6">
        {cards.map((card, index) => (
          <div key={card.id} className={`relative ${sizeClasses.wrapper}`} style={{ perspective: 800 }}>
            <motion.div
              className="relative h-full w-full"
              style={{ transformStyle: 'preserve-3d' }}
              initial={{ rotateY: 0 }}
              animate={{ rotateY: 180 }}
              transition={{ duration: 0.6, delay: 0.3 + index * 0.15, ease: 'easeInOut' }}
            >
              <div
                className="absolute inset-0 flex items-center justify-center rounded-2xl bg-primary text-2xl text-primary-foreground"
                style={{ backfaceVisibility: 'hidden' }}
              >
                ?
              </div>
              <div
                className={`absolute inset-0 flex items-center justify-center rounded-2xl border-2 bg-card text-center text-foreground ${sizeClasses.text} ${
                  card.highlight ? 'border-primary shadow-lg shadow-primary/30' : 'border-border'
                }`}
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              >
                {card.content}
              </div>
            </motion.div>
          </div>
        ))}
      </div>

      {outcomeLabel ? (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 + cards.length * 0.15 + 0.5, duration: 0.4 }}
          className="text-center text-sm font-semibold text-foreground"
        >
          {outcomeLabel}
        </motion.p>
      ) : null}
    </div>
  );
}
