import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { useSoloScore } from '@/hooks/useSoloScore';
import { soloTwentyQuestionsWords } from '@/data/soloPrompts';
import { pickRandomItem } from '@/lib/randomPick';
import { getHintForAttempt, isCorrectGuess } from '@/lib/twentyQuestionsLogic';

const TWENTY_QUESTIONS_TARGET_SCORE = 3;
const MAX_ATTEMPTS = 20;

export function TwentyQuestionsSolo() {
  const { score, winner, isMatchOver, recordRound, reset } = useSoloScore(TWENTY_QUESTIONS_TARGET_SCORE);
  const [word, setWord] = useState(() => pickRandomItem(soloTwentyQuestionsWords));
  const [attempts, setAttempts] = useState(0);
  const [guess, setGuess] = useState('');
  const [message, setMessage] = useState('Devinez le mot en 20 essais maximum.');
  const [roundOver, setRoundOver] = useState(false);

  const hint = getHintForAttempt(word.hints, attempts);

  const startNewRound = () => {
    setWord(pickRandomItem(soloTwentyQuestionsWords));
    setAttempts(0);
    setGuess('');
    setMessage('Nouveau mot ! Devinez-le en 20 essais maximum.');
    setRoundOver(false);
  };

  const submitGuess = () => {
    if (isMatchOver || roundOver || !guess.trim()) {
      return;
    }

    if (isCorrectGuess(guess, word.answer)) {
      setMessage(`Bravo, c’était bien "${word.answer}" !`);
      setRoundOver(true);
      recordRound('player');
      return;
    }

    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    setGuess('');

    if (nextAttempts >= MAX_ATTEMPTS) {
      setMessage(`Essais épuisés. Le mot était "${word.answer}".`);
      setRoundOver(true);
      recordRound('machine');
      return;
    }

    setMessage(`Non, ce n’est pas ça. Essai ${nextAttempts}/${MAX_ATTEMPTS}.`);
  };

  return (
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">
      <ScorePill player={score.player} machine={score.machine} targetScore={TWENTY_QUESTIONS_TARGET_SCORE} onReset={reset} />

      <motion.p key={message} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-muted-foreground">
        {message}
      </motion.p>

      <div className="rounded-2xl border border-border bg-muted p-4 text-sm text-foreground">
        <strong>Indice :</strong> {hint}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={guess}
          onChange={event => setGuess(event.target.value)}
          disabled={isMatchOver || roundOver}
          placeholder="Votre proposition"
          className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <Button type="button" onClick={submitGuess} disabled={isMatchOver || roundOver}>
          Valider
        </Button>
      </div>

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
