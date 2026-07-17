import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { soloWouldYouRatherPrompts } from '@/data/soloPrompts';
import { pickRandomItem } from '@/lib/randomPick';

const SIDES = ['left', 'right'] as const;
type Side = (typeof SIDES)[number];

export function WouldYouRatherSolo() {
  const [dilemma, setDilemma] = useState(() => pickRandomItem(soloWouldYouRatherPrompts));
  const [playerChoice, setPlayerChoice] = useState<Side | null>(null);
  const [machineChoice, setMachineChoice] = useState<Side | null>(null);

  const chooseOption = (side: Side) => {
    if (playerChoice) {
      return;
    }
    setPlayerChoice(side);
    setMachineChoice(pickRandomItem(SIDES));
  };

  const nextDilemma = () => {
    setDilemma(pickRandomItem(soloWouldYouRatherPrompts));
    setPlayerChoice(null);
    setMachineChoice(null);
  };

  return (
    <div className="space-y-6 rounded-3xl border border-border bg-background p-8">
      <p className="text-sm text-muted-foreground">Tu préfères...</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          variant={playerChoice === 'left' ? 'default' : 'outline'}
          onClick={() => chooseOption('left')}
          disabled={!!playerChoice}
          className="h-auto whitespace-normal px-4 py-3 text-left"
        >
          {dilemma.left}
        </Button>
        <Button
          type="button"
          variant={playerChoice === 'right' ? 'default' : 'outline'}
          onClick={() => chooseOption('right')}
          disabled={!!playerChoice}
          className="h-auto whitespace-normal px-4 py-3 text-left"
        >
          {dilemma.right}
        </Button>
      </div>

      {playerChoice && machineChoice ? (
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-foreground">
          Vous avez choisi « {dilemma[playerChoice]} », l’IA a choisi « {dilemma[machineChoice]} »
          {playerChoice === machineChoice ? ' — vous êtes sur la même longueur d’onde !' : ' — vous n’êtes pas d’accord cette fois.'}
        </motion.p>
      ) : null}

      <Button type="button" variant="secondary" onClick={nextDilemma}>
        Prochain dilemme
      </Button>
    </div>
  );
}
