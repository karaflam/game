import { useEffect, useState, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { BurstReveal } from '@/components/solo/reveals/BurstReveal';
import { useSoloScore } from '@/hooks/useSoloScore';
import { soloTwentyQuestionsWords } from '@/data/soloPrompts';
import { pickRandomIndexExcluding } from '@/lib/randomPick';
import { getHintForAttempt, isCorrectGuess } from '@/lib/twentyQuestionsLogic';
import { getThemeMaterial } from '@/three/themeMaterials';
import { useAdaptiveQuality } from '@/three/useAdaptiveQuality';
import useTheme from '@/hooks/useTheme';

const GameCanvas = lazy(() => import('@/three/GameCanvas').then(m => ({ default: m.GameCanvas })));
const BadgeBurstScene = lazy(() => import('@/three/scenes/BadgeBurstScene').then(m => ({ default: m.BadgeBurstScene })));

const TWENTY_QUESTIONS_TARGET_SCORE = 3;
const MAX_ATTEMPTS = 20;

type RoundResult = { outcome: 'player' | 'machine'; answer: string; triesUsed: number };

export function TwentyQuestionsSolo() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const quality = useAdaptiveQuality();
  const words = soloTwentyQuestionsWords[i18n.language === 'en' ? 'en' : 'fr'];
  const { score, winner, isMatchOver, recordRound, reset } = useSoloScore(TWENTY_QUESTIONS_TARGET_SCORE);
  const [usedIndices, setUsedIndices] = useState<Set<number>>(() => new Set());
  const [wordIndex, setWordIndex] = useState<number>(() => Math.floor(Math.random() * words.length));
  const [attempts, setAttempts] = useState(0);
  const [guess, setGuess] = useState('');
  const [message, setMessage] = useState(t('solo.twentyQuestions.instructions'));
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [roundOver, setRoundOver] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);

  useEffect(() => {
    if (!hasPlayed) {
      setMessage(t('solo.twentyQuestions.instructions'));
    }
  }, [t, hasPlayed]);

  const word = words[wordIndex];
  const hint = getHintForAttempt(word.hints, attempts);

  const startNewRound = () => {
    const currentUsed = new Set(usedIndices);
    currentUsed.add(wordIndex);

    let activeUsed = currentUsed;
    if (activeUsed.size >= words.length) {
      activeUsed = new Set();
    }
    const nextIdx = pickRandomIndexExcluding(words.length, activeUsed);
    const newUsed = new Set(activeUsed).add(nextIdx);

    setUsedIndices(newUsed);
    setWordIndex(nextIdx);
    setAttempts(0);
    setGuess('');
    setMessage(t('solo.twentyQuestions.newRound'));
    setRoundOver(false);
  };

  const submitGuess = () => {
    if (isMatchOver || roundOver || roundResult || !guess.trim()) {
      return;
    }

    setHasPlayed(true);

    if (isCorrectGuess(guess, word.answer)) {
      setRoundResult({ outcome: 'player', answer: word.answer, triesUsed: attempts + 1 });
      return;
    }

    const nextAttempts = attempts + 1;
    setGuess('');
    setAttempts(nextAttempts);

    if (nextAttempts >= MAX_ATTEMPTS) {
      setRoundResult({ outcome: 'machine', answer: word.answer, triesUsed: nextAttempts });
      return;
    }

    setMessage(t('solo.twentyQuestions.wrongGuess', { attempt: nextAttempts, max: MAX_ATTEMPTS }));
  };

  const handleRevealComplete = () => {
    if (!roundResult) {
      return;
    }

    setMessage(
      roundResult.outcome === 'player'
        ? t('solo.twentyQuestions.won', { answer: roundResult.answer })
        : t('solo.twentyQuestions.lost', { answer: roundResult.answer })
    );
    recordRound(roundResult.outcome);
    setRoundOver(true);
    setRoundResult(null);
  };

  return (
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">
      <ScorePill player={score.player} machine={score.machine} targetScore={TWENTY_QUESTIONS_TARGET_SCORE} onReset={reset} />

      {roundResult && quality === 'fallback2d' ? (
        <BurstReveal
          icon={roundResult.outcome === 'player' ? 'success' : 'fail'}
          headline={
            roundResult.outcome === 'player'
              ? t('solo.twentyQuestions.revealWon', { answer: roundResult.answer })
              : t('solo.twentyQuestions.revealLost', { answer: roundResult.answer })
          }
          detail={roundResult.outcome === 'player' ? t('solo.twentyQuestions.revealDetail', { tries: roundResult.triesUsed }) : undefined}
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
          className="relative flex min-h-56 cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl bg-muted p-6 text-center"
        >
          <div className="relative h-40 w-40">
            <Suspense fallback={null}>
              <GameCanvas theme={theme} quality={quality}>
                <BadgeBurstScene variant={roundResult.outcome === 'player' ? 'success' : 'fail'} material={getThemeMaterial(theme)} />
              </GameCanvas>
            </Suspense>
          </div>
          <p className="max-w-sm text-sm font-semibold text-foreground">
            {roundResult.outcome === 'player'
              ? t('solo.twentyQuestions.revealWon', { answer: roundResult.answer })
              : t('solo.twentyQuestions.revealLost', { answer: roundResult.answer })}
          </p>
          {roundResult.outcome === 'player' ? (
            <p className="text-sm text-muted-foreground">{t('solo.twentyQuestions.revealDetail', { tries: roundResult.triesUsed })}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">{t('solo.reveals.continueHint')}</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{message}</p>

          <div className="rounded-2xl border border-border bg-muted p-4 text-sm text-foreground">
            <strong>{t('solo.twentyQuestions.hintLabel')}</strong> {hint}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <input
              type="text"
              value={guess}
              onChange={event => setGuess(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  submitGuess();
                }
              }}
              disabled={isMatchOver || roundOver}
              placeholder={t('solo.twentyQuestions.guessPlaceholder')}
              className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <Button type="button" onClick={submitGuess} disabled={isMatchOver || roundOver} className="h-auto px-6 py-3">
              {t('solo.twentyQuestions.submitButton')}
            </Button>
          </div>
        </>
      )}

      {roundOver && !isMatchOver ? (
        <Button type="button" variant="secondary" onClick={startNewRound}>
          {t('solo.twentyQuestions.nextRoundButton')}
        </Button>
      ) : null}

      <MatchEndOverlay
        winner={winner}
        onReplay={() => {
          reset();
          startNewRound();
        }}
      />
    </div>
  );
}
