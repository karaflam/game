import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { BurstReveal } from '@/components/solo/reveals/BurstReveal';
import { useSoloScore } from '@/hooks/useSoloScore';
import { soloTwoTruthsOneLieTriplets } from '@/data/soloPrompts';
import { pickRandomItem } from '@/lib/randomPick';
import { shuffleTriplet } from '@/lib/twoTruthsLogic';

const TWO_TRUTHS_TARGET_SCORE = 5;

type RoundResult = { outcome: 'player' | 'machine'; lieText: string };

export function TwoTruthsOneLieSolo() {
  const { score, winner, isMatchOver, recordRound, reset } = useSoloScore(TWO_TRUTHS_TARGET_SCORE);
  const [triplet, setTriplet] = useState(() => shuffleTriplet(pickRandomItem(soloTwoTruthsOneLieTriplets)));
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [roundOver, setRoundOver] = useState(false);

  const nextRound = () => {
    setTriplet(shuffleTriplet(pickRandomItem(soloTwoTruthsOneLieTriplets)));
    setRoundOver(false);
  };

  const chooseStatement = (index: number) => {
    if (isMatchOver || roundOver || roundResult) {
      return;
    }

    const correct = index === triplet.lieIndex;
    setRoundResult({ outcome: correct ? 'player' : 'machine', lieText: triplet.statements[triplet.lieIndex] });
  };

  const handleRevealComplete = () => {
    if (!roundResult) {
      return;
    }
    recordRound(roundResult.outcome);
    setRoundOver(true);
    setRoundResult(null);
  };

  return (
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">
      <ScorePill player={score.player} machine={score.machine} targetScore={TWO_TRUTHS_TARGET_SCORE} onReset={reset} />

      {roundResult ? (
        <BurstReveal
          icon={roundResult.outcome === 'player' ? 'success' : 'fail'}
          headline={roundResult.outcome === 'player' ? 'Bien joué, vous avez trouvé le mensonge !' : 'Perdu, ce n’était pas le mensonge.'}
          detail={`Le mensonge était : "${roundResult.lieText}"`}
          onComplete={handleRevealComplete}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">L’IA affirme 3 choses sur elle. Trouvez le mensonge.</p>

          <div className="grid gap-3">
            {triplet.statements.map((statement, index) => (
              <Button
                key={index}
                type="button"
                variant="outline"
                onClick={() => chooseStatement(index)}
                disabled={isMatchOver || roundOver}
                className="h-auto justify-start whitespace-normal px-4 py-3 text-left"
              >
                {statement}
              </Button>
            ))}
          </div>
        </>
      )}

      {roundOver && !isMatchOver ? (
        <Button type="button" variant="secondary" onClick={nextRound}>
          Série suivante
        </Button>
      ) : null}

      <MatchEndOverlay
        winner={winner}
        onReplay={() => {
          reset();
          nextRound();
        }}
      />
    </div>
  );
}
