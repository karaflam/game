import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { FlipReveal } from '@/components/solo/reveals/FlipReveal';
import { NumberTokenPicker } from '@/components/solo/NumberTokenPicker';
import { getThemeMaterial } from '@/three/themeMaterials';
import { useAdaptiveQuality } from '@/three/useAdaptiveQuality';
import useTheme from '@/hooks/useTheme';
import { NumberDrum } from '@/three/scenes/NumberDrum';
import { useSoloScore } from '@/hooks/useSoloScore';
import { getOddOrEvenOutcome, getParity, pickRandomNumber, type Parity } from '@/lib/oddOrEvenLogic';

const GameCanvas = lazy(() => import('@/three/GameCanvas').then(m => ({ default: m.GameCanvas })));
const OddOrEvenDuelScene = lazy(() =>
  import('@/three/scenes/OddOrEvenDuelScene').then(m => ({ default: m.OddOrEvenDuelScene }))
);

const ODD_OR_EVEN_TARGET_SCORE = 5;
const PARITIES: Parity[] = ['pair', 'impair'];

type RoundData = { playerNumber: number; machineNumber: number; outcome: 'player' | 'machine' };

export function OddOrEvenSolo() {
  const { t } = useTranslation();
  const { score, winner, isMatchOver, recordRound, reset } = useSoloScore(ODD_OR_EVEN_TARGET_SCORE);
  const { theme } = useTheme();
  const quality = useAdaptiveQuality();
  const [playerNumber, setPlayerNumber] = useState(1);
  const [prediction, setPrediction] = useState<Parity>('pair');
  const [message, setMessage] = useState(t('solo.oddOrEven.instructions'));
  const [round, setRound] = useState<RoundData | null>(null);
  const [hasPlayed, setHasPlayed] = useState(false);

  useEffect(() => {
    if (!hasPlayed) {
      setMessage(t('solo.oddOrEven.instructions'));
    }
  }, [t, hasPlayed]);

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
    setHasPlayed(true);
  };

  return (
    <div className="relative isolate space-y-6 rounded-3xl border border-border bg-background p-4 sm:p-8">
      <ScorePill player={score.player} machine={score.machine} targetScore={ODD_OR_EVEN_TARGET_SCORE} onReset={reset} />

      {round && quality === 'fallback2d' ? (
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
      ) : round ? (
        <div className="relative -mx-4 aspect-[3/4] w-[calc(100%+2rem)] overflow-hidden rounded-2xl bg-muted sm:mx-0 sm:aspect-auto sm:h-[28rem] sm:w-full">
          <Suspense fallback={null}>
            <GameCanvas theme={theme} quality={quality} bloom={false}>
              <OddOrEvenDuelScene
                round={{
                  yourValue: round.playerNumber,
                  opponentValue: round.machineNumber,
                  sum: round.playerNumber + round.machineNumber,
                  parityLabel:
                    getParity(round.playerNumber + round.machineNumber) === 'pair' ? t('solo.oddOrEven.even') : t('solo.oddOrEven.odd'),
                  outcomeLabel: round.outcome === 'player' ? t('solo.oddOrEven.outcomeWin') : t('solo.oddOrEven.outcomeLose')
                }}
                material={getThemeMaterial(theme)}
                onComplete={handleRevealComplete}
              />
            </GameCanvas>
          </Suspense>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{message}</p>

          {quality === 'fallback2d' ? (
            <NumberTokenPicker value={playerNumber} onChange={setPlayerNumber} disabled={isMatchOver} />
          ) : (
            <div className="relative -mx-4 aspect-[4/3] w-[calc(100%+2rem)] overflow-hidden rounded-2xl bg-muted sm:mx-0 sm:aspect-auto sm:h-72 sm:w-full">
              <Suspense fallback={null}>
                <GameCanvas theme={theme} quality={quality} bloom={false}>
                  <NumberDrum
                    mode={{ kind: 'interactive', value: playerNumber, onChange: setPlayerNumber }}
                    material={getThemeMaterial(theme)}
                    position={[0, 0, 0]}
                  />
                </GameCanvas>
              </Suspense>
            </div>
          )}

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
