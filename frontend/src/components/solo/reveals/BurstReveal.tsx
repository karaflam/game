import { motion } from 'framer-motion';
import { CheckCircle2, Minus, XCircle } from 'lucide-react';

type BurstRevealVariant = 'success' | 'fail' | 'neutral';

type BurstRevealProps = {
  icon: BurstRevealVariant;
  headline: string;
  detail?: string;
  onComplete: () => void;
};

const ICONS: Record<BurstRevealVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  fail: XCircle,
  neutral: Minus
};

const PARTICLE_OFFSETS = [
  { dx: -60, dy: -40 },
  { dx: 0, dy: -70 },
  { dx: 60, dy: -40 },
  { dx: -70, dy: 10 },
  { dx: 70, dy: 10 },
  { dx: -40, dy: 50 },
  { dx: 0, dy: 65 },
  { dx: 40, dy: 50 }
];

export function BurstReveal({ icon, headline, detail, onComplete }: BurstRevealProps) {
  const Icon = ICONS[icon];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onComplete}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          onComplete();
        }
      }}
      className="relative flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl bg-muted p-6 text-center"
    >
      {PARTICLE_OFFSETS.map((offset, index) => (
        <motion.span
          key={index}
          className="absolute h-2 w-2 rounded-full bg-primary"
          initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 0], x: offset.dx, y: offset.dy, scale: [0, 1, 1] }}
          transition={{ duration: 0.7, delay: 0.15 }}
        />
      ))}

      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
        className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"
      >
        <Icon className="h-7 w-7" />
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="text-lg font-bold text-foreground"
      >
        {headline}
      </motion.p>

      {detail ? (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="text-sm text-muted-foreground"
        >
          {detail}
        </motion.p>
      ) : null}

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.4 }}
        className="text-xs text-muted-foreground"
      >
        Cliquez pour continuer
      </motion.p>
    </div>
  );
}
