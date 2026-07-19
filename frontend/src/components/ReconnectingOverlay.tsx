import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';

const SLOW_RECONNECT_HINT_MS = 10000;

export function ReconnectingOverlay() {
  const reconnecting = useGameStore(state => state.reconnecting);
  const [showSlowHint, setShowSlowHint] = useState(false);

  useEffect(() => {
    if (!reconnecting) {
      setShowSlowHint(false);
      return;
    }

    const timer = setTimeout(() => setShowSlowHint(true), SLOW_RECONNECT_HINT_MS);
    return () => clearTimeout(timer);
  }, [reconnecting]);

  return (
    <AnimatePresence>
      {reconnecting ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="flex flex-col items-center gap-4 px-6 text-center"
          >
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <h3 className="text-xl font-bold text-foreground">Un instant...</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              On restaure votre partie. Ça ne prend que quelques secondes — inutile de recharger la page.
            </p>
            {showSlowHint ? (
              <p className="max-w-sm text-xs text-muted-foreground">
                Ça prend plus de temps que prévu. Vérifiez votre connexion — vous pouvez recharger la page si ça
                persiste.
              </p>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
