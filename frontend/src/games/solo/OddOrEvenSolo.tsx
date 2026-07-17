import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { useSoloScore } from '@/hooks/useSoloScore';
import { getOddOrEvenOutcome, getParity, pickRandomNumber, type Parity } from '@/lib/oddOrEvenLogic';

const ODD_OR_EVEN_TARGET_SCORE = 5;
const PARITIES: Parity[] = ['pair', 'impair'];

export function OddOrEvenSolo() {
  const { score, winner, isMatchOver, recordRound, reset } = useSoloScore(ODD_OR_EVEN_TARGET_SCORE);
  const [playerNumber, setPlayerNumber] = useState(1);
  const [prediction, setPrediction] = useState<Parity>('pair');
  const [message, setMessage] = useState('Choisissez un chiffre de 1 à 9 et prédisez la parité de la somme.');

  const playRound = () => {
    if (isMatchOver) {
      return;
    }

    const machineNumber = pickRandomNumber();
    const sum = playerNumber + machineNumber;
    const actualParity = getParity(sum);
    const outcome = getOddOrEvenOutcome(playerNumber, prediction, machineNumber);

    setMessage(
      `Vous avez joué ${playerNumber}, l’IA a joué ${machineNumber}. Somme ${sum} (${actualParity}). ${
        outcome === 'player' ? 'Vous gagnez la manche !' : 'Vous perdez la manche...'
      }`
    );

    recordRound(outcome);
  };

  return (
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">
      <ScorePill player={score.player} machine={score.machine} targetScore={ODD_OR_EVEN_TARGET_SCORE} onReset={reset} />

      <motion.p key={message} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-muted-foreground">
        {message}
      </motion.p>

      <div className="space-y-4">
        <label className="flex items-center gap-3 text-sm text-foreground">
          Votre chiffre (1-9) :
          <input
            type="number"
            min={1}
            max={9}
            value={playerNumber}
            onChange={event => setPlayerNumber(Math.min(9, Math.max(1, Number(event.target.value))))}
            disabled={isMatchOver}
            className="w-20 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>

        <div className="flex gap-3">
          {PARITIES.map(parity => (
            <Button
              key={parity}
              type="button"
              variant={prediction === parity ? 'default' : 'outline'}
              onClick={() => setPrediction(parity)}
              disabled={isMatchOver}
            >
              {parity === 'pair' ? 'Pair' : 'Impair'}
            </Button>
          ))}
        </div>

        <Button type="button" onClick={playRound} disabled={isMatchOver}>
          Jouer la manche
        </Button>
      </div>

      <MatchEndOverlay winner={winner} onReplay={reset} />
    </div>
  );
}
