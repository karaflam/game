import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { BurstReveal } from '@/components/solo/reveals/BurstReveal';
import { useSoloScore } from '@/hooks/useSoloScore';
import { soloTwentyQuestionsWords } from '@/data/soloPrompts';
import { pickRandomIndexExcluding } from '@/lib/randomPick';
import { getHintForAttempt, isCorrectGuess } from '@/lib/twentyQuestionsLogic';

const TWENTY_QUESTIONS_TARGET_SCORE = 3;
const MAX_ATTEMPTS = 20;

type RoundResult = { outcome: 'player' | 'machine'; answer: string; triesUsed: number };

export function TwentyQuestionsSolo() {
  const { score, winner, isMatchOver, recordRound, reset } = useSoloScore(TWENTY_QUESTIONS_TARGET_SCORE);
  const [usedIndices, setUsedIndices] = useState<Set<number>>(() => new Set());
  const [wordIndex, setWordIndex] = useState<number>(() => Math.floor(Math.random() * soloTwentyQuestionsWords.length));
  const [attempts, setAttempts] = useState(0);
  const [guess, setGuess] = useState('');
  const [message, setMessage] = useState('Devinez le mot en 20 essais maximum.');
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [roundOver, setRoundOver] = useState(false);

  const word = soloTwentyQuestionsWords[wordIndex];
  const hint = getHintForAttempt(word.hints, attempts);

  const startNewRound = () => {
    const currentUsed = new Set(usedIndices);
    currentUsed.add(wordIndex);

    let activeUsed = currentUsed;
    if (activeUsed.size >= soloTwentyQuestionsWords.length) {
      activeUsed = new Set();
    }
    const nextIdx = pickRandomIndexExcluding(soloTwentyQuestionsWords.length, activeUsed);
    const newUsed = new Set(activeUsed).add(nextIdx);

    setUsedIndices(newUsed);
    setWordIndex(nextIdx);
    setAttempts(0);
    setGuess('');
    setMessage('Nouveau mot ! Devinez-le en 20 essais maximum.');
    setRoundOver(false);
  };

  const submitGuess = () => {
    if (isMatchOver || roundOver || roundResult || !guess.trim()) {
      return;
    }

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

    setMessage(`Non, ce n’est pas ça. Essai ${nextAttempts}/${MAX_ATTEMPTS}.`);
  };

  const handleRevealComplete = () => {
    if (!roundResult) {
      return;
    }

    setMessage(
      roundResult.outcome === 'player'
        ? `Bravo, c’était bien "${roundResult.answer}" !`
        : `Essais épuisés. Le mot était "${roundResult.answer}".`
    );
    recordRound(roundResult.outcome);
    setRoundOver(true);
    setRoundResult(null);
  };

  return (
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">
      <ScorePill player={score.player} machine={score.machine} targetScore={TWENTY_QUESTIONS_TARGET_SCORE} onReset={reset} />

      {roundResult ? (
        <BurstReveal
          icon={roundResult.outcome === 'player' ? 'success' : 'fail'}
          headline={roundResult.outcome === 'player' ? `Trouvé : ${roundResult.answer} !` : `Le mot était : ${roundResult.answer}`}
          detail={roundResult.outcome === 'player' ? `En ${roundResult.triesUsed} essai(s).` : undefined}
          onComplete={handleRevealComplete}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{message}</p>

          <div className="rounded-2xl border border-border bg-muted p-4 text-sm text-foreground">
            <strong>Indice :</strong> {hint}
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
              placeholder="Votre proposition"
              className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <Button type="button" onClick={submitGuess} disabled={isMatchOver || roundOver} className="h-auto px-6 py-3">
              Valider
            </Button>
          </div>
        </>
      )}

      {roundOver && !isMatchOver ? (
        <Button type="button" variant="secondary" onClick={startNewRound}>
          Manche suivante
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
