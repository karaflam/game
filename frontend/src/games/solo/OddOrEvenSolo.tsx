import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { FlipReveal } from '@/components/solo/reveals/FlipReveal';
import { NumberTokenPicker } from '@/components/solo/NumberTokenPicker';
import { useSoloScore } from '@/hooks/useSoloScore';
import { getOddOrEvenOutcome, getParity, pickRandomNumber, type Parity } from '@/lib/oddOrEvenLogic';

const ODD_OR_EVEN_TARGET_SCORE = 5;
const PARITIES: Parity[] = ['pair', 'impair'];

type RoundData = { playerNumber: number; machineNumber: number; outcome: 'player' | 'machine' };

export function OddOrEvenSolo() {
  const { t } = useTranslation();
  const { score, winner, isMatchOver, recordRound, reset } = useSoloScore(ODD_OR_EVEN_TARGET_SCORE);
  const [playerNumber, setPlayerNumber] = useState(1);
  const [prediction, setPrediction] = useState<Parity>('pair');
  const [message, setMessage] = useState(t('solo.oddOrEven.instructions'));
  const [round, setRound] = useState<RoundData | null>(null);

  const playRound = () => {
    if (isMatchOver || round) {
      return;
    }

    const machineNumber = pickRandomNumber();
    const outcome = getOddOrEvenOutcome(playerNumber, prediction, machineNumber);
    setRound({ playerNumber, machineNumber, outcome });
  };

  const handleRevealComplete = () => {
    if (!round) {
      return;
    }

    const sum = round.playerNumber + round.machineNumber;
    const actualParity = getParity(sum);
    setMessage(
      t('solo.oddOrEven.outcome', {
        playerNumber: round.playerNumber,
        machineNumber: round.machineNumber,
        sum,
        parity: actualParity,
        result: round.outcome === 'player' ? t('solo.oddOrEven.outcomeWin') : t('solo.oddOrEven.outcomeLose')
      })
    );

    recordRound(round.outcome);
    setRound(null);
  };

  return (
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">
      <ScorePill player={score.player} machine={score.machine} targetScore={ODD_OR_EVEN_TARGET_SCORE} onReset={reset} />

      {round ? (
        <FlipReveal
          cards={[
            { id: 'player', content: round.playerNumber, highlight: round.outcome === 'player' },
            { id: 'machine', content: round.machineNumber, highlight: round.outcome === 'machine' }
          ]}
          outcomeLabel={t('solo.oddOrEven.sumLabel', {
            sum: round.playerNumber + round.machineNumber,
            parity: getParity(round.playerNumber + round.machineNumber)
          })}
          onComplete={handleRevealComplete}
        />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{message}</p>

          <NumberTokenPicker value={playerNumber} onChange={setPlayerNumber} disabled={isMatchOver} />

          <div className="flex gap-3">
            {PARITIES.map(parity => (
              <Button
                key={parity}
                type="button"
                variant={prediction === parity ? 'default' : 'outline'}
                onClick={() => setPrediction(parity)}
                disabled={isMatchOver}
              >
                {parity === 'pair' ? t('solo.oddOrEven.even') : t('solo.oddOrEven.odd')}
              </Button>
            ))}
          </div>

          <Button type="button" onClick={playRound} disabled={isMatchOver}>
            {t('solo.oddOrEven.playButton')}
          </Button>
        </div>
      )}

      <MatchEndOverlay winner={winner} onReplay={reset} />
    </div>
  );
}
