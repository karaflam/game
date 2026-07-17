import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { soloTruthOrDarePrompts } from '@/data/soloPrompts';
import { pickRandomItem } from '@/lib/randomPick';

export function TruthOrDareSolo() {
  const [prompt, setPrompt] = useState(() => pickRandomItem(soloTruthOrDarePrompts));
  const [reveal, setReveal] = useState<'truth' | 'dare' | null>(null);

  const spin = () => {
    setPrompt(pickRandomItem(soloTruthOrDarePrompts));
    setReveal(null);
  };

  return (
    <div className="space-y-6 rounded-3xl border border-border bg-background p-8">
      <p className="text-sm text-muted-foreground">L’IA a préparé un défi. Choisissez Action ou Vérité pour le découvrir.</p>

      <div className="flex gap-3">
        <Button type="button" variant={reveal === 'truth' ? 'default' : 'outline'} onClick={() => setReveal('truth')}>
          Vérité
        </Button>
        <Button type="button" variant={reveal === 'dare' ? 'default' : 'outline'} onClick={() => setReveal('dare')}>
          Action
        </Button>
      </div>

      {reveal ? (
        <motion.div
          key={reveal + prompt.truth}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-muted p-4 text-sm text-foreground"
        >
          {reveal === 'truth' ? prompt.truth : prompt.dare}
        </motion.div>
      ) : null}

      <Button type="button" variant="secondary" onClick={spin}>
        Prochain tour
      </Button>
    </div>
  );
}
