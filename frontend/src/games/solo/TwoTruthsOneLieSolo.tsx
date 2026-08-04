import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { BurstReveal } from '@/components/solo/reveals/BurstReveal';
import { getThemeMaterial } from '@/three/themeMaterials';
import { useAdaptiveQuality } from '@/three/useAdaptiveQuality';
import useTheme from '@/hooks/useTheme';
import { useSoloScore } from '@/hooks/useSoloScore';
import { soloTwoTruthsOneLieTriplets } from '@/data/soloPrompts';
import { pickRandomIndexExcluding } from '@/lib/randomPick';
import { shuffleTriplet } from '@/lib/twoTruthsLogic';

const GameCanvas = lazy(() => import('@/three/GameCanvas').then(m => ({ default: m.GameCanvas })));
const BadgeBurstScene = lazy(() => import('@/three/scenes/BadgeBurstScene').then(m => ({ default: m.BadgeBurstScene })));

const TWO_TRUTHS_TARGET_SCORE = 5;

type RoundResult = { outcome: 'player' | 'machine'; lieText: string };

export function TwoTruthsOneLieSolo() {
  const { t, i18n } = useTranslation();
  const triplets = soloTwoTruthsOneLieTriplets[i18n.language === 'en' ? 'en' : 'fr'];
  const { score, winner, isMatchOver, recordRound, reset } = useSoloScore(TWO_TRUTHS_TARGET_SCORE);
  const [usedIndices, setUsedIndices] = useState<Set<number>>(() => new Set());
  const [tripletIndex, setTripletIndex] = useState<number>(() => Math.floor(Math.random() * triplets.length));
  const [triplet, setTriplet] = useState(() => shuffleTriplet(triplets[tripletIndex]));
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [roundOver, setRoundOver] = useState(false);
  const { theme } = useTheme();
  const quality = useAdaptiveQuality();

  const nextRound = () => {
    const currentUsed = new Set(usedIndices);
    currentUsed.add(tripletIndex);

    let activeUsed = currentUsed;
    if (activeUsed.size >= triplets.length) {
      activeUsed = new Set();
    }
    const nextIdx = pickRandomIndexExcluding(triplets.length, activeUsed);
    const newUsed = new Set(activeUsed).add(nextIdx);

    setUsedIndices(newUsed);
    setTripletIndex(nextIdx);
    setTriplet(shuffleTriplet(triplets[nextIdx]));
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
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-4 sm:p-8">
      <ScorePill player={score.player} machine={score.machine} targetScore={TWO_TRUTHS_TARGET_SCORE} onReset={reset} />

      {roundResult && quality === 'fallback2d' ? (
        <BurstReveal
          icon={roundResult.outcome === 'player' ? 'success' : 'fail'}
          headline={roundResult.outcome === 'player' ? t('solo.twoTruthsOneLie.won') : t('solo.twoTruthsOneLie.lost')}
          detail={t('solo.twoTruthsOneLie.detail', { lie: roundResult.lieText })}
          onComplete={handleRevealComplete}
        />
      ) : roundResult ? (
        <div
          role="button"
          tabIndex={0}
          onClick={handleRevealComplete}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              handleRevealComplete();
            }
          }}
          className="relative -mx-4 aspect-square w-[calc(100%+2rem)] cursor-pointer overflow-hidden rounded-2xl bg-muted sm:mx-0 sm:aspect-auto sm:h-[26rem] sm:w-full"
        >
          <Suspense fallback={null}>
            <GameCanvas theme={theme} quality={quality}>
              <BadgeBurstScene
                variant={roundResult.outcome === 'player' ? 'success' : 'fail'}
                material={getThemeMaterial(theme)}
                headline={roundResult.outcome === 'player' ? t('solo.twoTruthsOneLie.won') : t('solo.twoTruthsOneLie.lost')}
                detail={t('solo.twoTruthsOneLie.detail', { lie: roundResult.lieText })}
              />
            </GameCanvas>
          </Suspense>
          <p className="absolute inset-x-0 bottom-4 text-center text-xs text-muted-foreground">{t('solo.reveals.continueHint')}</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{t('solo.twoTruthsOneLie.instructions')}</p>

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
          {t('solo.twoTruthsOneLie.nextSetButton')}
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
