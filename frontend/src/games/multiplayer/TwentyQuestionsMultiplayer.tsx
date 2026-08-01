import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/store/useGameStore';
import { ClientEvents, ServerEvents } from '@/lib/socketEvents';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { BurstReveal } from '@/components/solo/reveals/BurstReveal';
import type { Winner } from '@/lib/soloScore';

const MAX_ATTEMPTS_PER_TURN = 10;
const TOTAL_TURNS = 2;

type RoundResultPayload = {
  correct: boolean;
  hint?: string;
  attemptsRemaining: number;
  roundOver: boolean;
  turnIndex: number;
  nextSetterId: string | null;
  nextGuesserId: string | null;
  scores: Record<string, number>;
  matchOver: boolean;
  isDraw: boolean;
  winnerId: string | null;
};

export function TwentyQuestionsMultiplayer() {
  const { t } = useTranslation();
  const { socket, socketId } = useSocket();
  const players = useGameStore(state => state.players);
  const scores = useGameStore(state => state.scores);
  const setStoreScores = useGameStore(state => state.setScores);
  const [setterId, setSetterId] = useState<string | null>(null);
  const [guesserId, setGuesserId] = useState<string | null>(null);
  const [turnIndex, setTurnIndex] = useState(1);
  const [attemptsRemaining, setAttemptsRemaining] = useState(MAX_ATTEMPTS_PER_TURN);
  const [wordSet, setWordSet] = useState(false);
  const [wordDraft, setWordDraft] = useState('');
  const [guessDraft, setGuessDraft] = useState('');
  const [pendingGuess, setPendingGuess] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [hintDraft, setHintDraft] = useState('');
  const [roundResult, setRoundResult] = useState<RoundResultPayload | null>(null);
  const [matchOver, setMatchOver] = useState(false);
  const [winner, setWinner] = useState<Winner>(null);

  useEffect(() => {
    if (!socket || !socketId) {
      return;
    }

    const handleRoundReady = (data: {
      setterId: string;
      guesserId: string;
      attemptsRemaining: number;
      turnIndex: number;
      wordSet: boolean;
    }) => {
      setSetterId(data.setterId);
      setGuesserId(data.guesserId);
      setAttemptsRemaining(data.attemptsRemaining);
      setTurnIndex(data.turnIndex);
      setWordSet(data.wordSet);
      setWordDraft('');
      setGuessDraft('');
      setPendingGuess(null);
      setHint(null);
      setHintDraft('');
    };

    const handleWordReady = () => {
      setWordSet(true);
    };

    const handleGuessSubmitted = (data: { guess: string; attemptsRemaining: number }) => {
      setPendingGuess(data.guess);
      setAttemptsRemaining(data.attemptsRemaining);
    };

    const handleRoundResult = (data: RoundResultPayload) => {
      setStoreScores(data.scores);

      if (!data.roundOver) {
        setHint(data.hint ?? null);
        setAttemptsRemaining(data.attemptsRemaining);
        setPendingGuess(null);
        setGuessDraft('');
        return;
      }

      setRoundResult(data);
      setMatchOver(data.matchOver);
      setWinner(data.matchOver ? (data.isDraw ? 'draw' : data.winnerId === socketId ? 'player' : 'machine') : null);
    };

    const handleScoreReset = (data: { scores: Record<string, number> }) => {
      setStoreScores(data.scores);
      setMatchOver(false);
      setWinner(null);
      setRoundResult(null);
    };

    const handleGameState = (data: {
      gameId: string;
      state: {
        setterId: string;
        guesserId: string;
        attemptsRemaining: number;
        turnIndex: number;
        wordSet: boolean;
        pendingGuess: string | null;
        word: string | null;
      };
    }) => {
      if (data.gameId !== '20-questions') {
        return;
      }
      setSetterId(data.state.setterId);
      setGuesserId(data.state.guesserId);
      setAttemptsRemaining(data.state.attemptsRemaining);
      setTurnIndex(data.state.turnIndex);
      setWordSet(data.state.wordSet);
      setPendingGuess(data.state.pendingGuess);
      if (data.state.word) {
        setWordDraft(data.state.word);
      }
    };

    socket.on(ServerEvents.TwentyQuestionsRoundReady, handleRoundReady);
    socket.on(ServerEvents.TwentyQuestionsWordReady, handleWordReady);
    socket.on(ServerEvents.TwentyQuestionsGuessSubmitted, handleGuessSubmitted);
    socket.on(ServerEvents.TwentyQuestionsRoundResult, handleRoundResult);
    socket.on(ServerEvents.ScoreReset, handleScoreReset);
    socket.on(ServerEvents.GameState, handleGameState);

    // The server only broadcasts the initial TwentyQuestionsRoundReady once, right when the
    // match starts (from the waiting room, before this component has mounted and subscribed).
    // Actively request the current round state so we don't miss it and get stuck waiting forever
    // — this also covers every later (re)connect, since socketId changes each time one happens.
    socket.emit(ClientEvents.RequestGameState);

    return () => {
      socket.off(ServerEvents.TwentyQuestionsRoundReady, handleRoundReady);
      socket.off(ServerEvents.TwentyQuestionsWordReady, handleWordReady);
      socket.off(ServerEvents.TwentyQuestionsGuessSubmitted, handleGuessSubmitted);
      socket.off(ServerEvents.TwentyQuestionsRoundResult, handleRoundResult);
      socket.off(ServerEvents.ScoreReset, handleScoreReset);
      socket.off(ServerEvents.GameState, handleGameState);
    };
  }, [socket, socketId, setStoreScores]);

  const me = players.find(player => player.id === socketId) ?? null;
  const opponent = players.find(player => player.id !== socketId) ?? null;
  const myScore = socketId ? scores[socketId] ?? 0 : 0;
  const opponentScore = opponent ? scores[opponent.id] ?? 0 : 0;
  const isSetter = socketId !== null && socketId === setterId;
  const isGuesser = socketId !== null && socketId === guesserId;
  const opponentName = opponent?.name ?? t('multiplayer.twentyQuestions.opponentFallback');

  const submitWord = () => {
    if (!socket || !isSetter || !wordDraft.trim()) {
      return;
    }
    socket.emit(ClientEvents.TwentyQuestionsSetWord, { word: wordDraft.trim() });
    setWordSet(true);
  };

  const submitGuess = () => {
    if (!socket || !isGuesser || !wordSet || !guessDraft.trim() || pendingGuess) {
      return;
    }
    socket.emit(ClientEvents.TwentyQuestionsGuess, { guess: guessDraft.trim() });
  };

  const judge = (correct: boolean) => {
    if (!socket || !isSetter || !pendingGuess) {
      return;
    }
    if (!correct && !hintDraft.trim()) {
      return;
    }
    socket.emit(ClientEvents.TwentyQuestionsJudge, { correct, hint: correct ? undefined : hintDraft.trim() });
    setHintDraft('');
  };

  const handleRoundRevealComplete = () => {
    if (!roundResult) {
      return;
    }

    if (roundResult.matchOver) {
      setRoundResult(null);
      return;
    }

    setSetterId(roundResult.nextSetterId);
    setGuesserId(roundResult.nextGuesserId);
    setTurnIndex(roundResult.turnIndex + 1);
    setAttemptsRemaining(MAX_ATTEMPTS_PER_TURN);
    setWordSet(false);
    setWordDraft('');
    setGuessDraft('');
    setPendingGuess(null);
    setHint(null);
    setRoundResult(null);
  };

  const handleReplay = () => {
    if (!socket) {
      return;
    }
    socket.emit(ClientEvents.ResetMatchScore);
  };

  return (
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-4 sm:p-8">
      <div className="rounded-2xl bg-secondary px-4 py-3 text-secondary-foreground">
        <div className="mb-3 flex items-center justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={handleReplay} className="gap-1.5">
            <RotateCcw className="h-4 w-4" />
            {t('multiplayer.twentyQuestions.resetButton')}
          </Button>
        </div>
        <div className="flex flex-col gap-1 text-sm font-semibold text-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="min-w-0 truncate">
            {t('multiplayer.twentyQuestions.myScore', { name: me?.name ?? t('multiplayer.common.youFallback'), score: myScore })}
          </span>
          {opponent ? (
            <span className="min-w-0 truncate">{t('multiplayer.twentyQuestions.opponentScore', { name: opponentName, score: opponentScore })}</span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('multiplayer.twentyQuestions.rules', { total: TOTAL_TURNS })}
        </p>
      </div>

      {roundResult ? (
        <BurstReveal
          icon={roundResult.correct ? 'success' : 'fail'}
          headline={
            roundResult.correct
              ? isGuesser
                ? t('multiplayer.twentyQuestions.wonRound', { points: roundResult.attemptsRemaining })
                : t('multiplayer.twentyQuestions.opponentWonRound', { name: opponentName })
              : t('multiplayer.twentyQuestions.roundExhausted')
          }
          detail={t('multiplayer.twentyQuestions.roundSummary', { turn: roundResult.turnIndex, total: TOTAL_TURNS })}
          onComplete={handleRoundRevealComplete}
        />
      ) : (
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {t('multiplayer.twentyQuestions.turnStatus', { turn: turnIndex, total: TOTAL_TURNS, attempts: attemptsRemaining })}
          </p>

          {isSetter && wordSet && wordDraft ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {t('multiplayer.twentyQuestions.secretWordBadge', { word: wordDraft })}
            </div>
          ) : null}

          {isSetter && !wordSet ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('multiplayer.twentyQuestions.leaderInstructions', { name: opponentName })}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                <input
                  value={wordDraft}
                  onChange={event => setWordDraft(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      submitWord();
                    }
                  }}
                  placeholder={t('multiplayer.twentyQuestions.secretWordPlaceholder')}
                  className="min-w-0 flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <Button type="button" onClick={submitWord} disabled={!wordDraft.trim()} className="h-auto shrink-0 px-6 py-3">
                  {t('multiplayer.twentyQuestions.validateSecretWordButton')}
                </Button>
              </div>
            </div>
          ) : isSetter && pendingGuess ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('multiplayer.twentyQuestions.guesserPrompt', { name: opponentName })}
              </p>
              <div className="rounded-2xl border border-border bg-muted p-4 text-sm text-foreground">
                {t('multiplayer.twentyQuestions.guessQuote', { guess: pendingGuess })}
              </div>
              <p className="text-sm text-muted-foreground">
                {t('multiplayer.twentyQuestions.guesserInstructions')}
              </p>
              <input
                value={hintDraft}
                onChange={event => setHintDraft(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    judge(false);
                  }
                }}
                placeholder={t('multiplayer.twentyQuestions.hintPlaceholder')}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <div className="flex flex-wrap gap-3">
                <Button type="button" onClick={() => judge(true)}>
                  {t('multiplayer.twentyQuestions.wordFoundButton')}
                </Button>
                <Button type="button" variant="outline" onClick={() => judge(false)} disabled={!hintDraft.trim()}>
                  {t('multiplayer.twentyQuestions.replyButton')}
                </Button>
              </div>
            </div>
          ) : isSetter ? (
            <p className="text-sm text-muted-foreground">
              {t('multiplayer.twentyQuestions.waitingWordRegistered', { name: opponentName })}
            </p>
          ) : isGuesser && pendingGuess ? (
            <p className="text-sm text-muted-foreground">
              {t('multiplayer.twentyQuestions.waitingGuessSent', { name: opponentName })}
            </p>
          ) : isGuesser && wordSet ? (
            <div className="space-y-3">
              {hint ? (
                <div className="rounded-2xl border border-border bg-muted p-4 text-sm text-foreground">
                  <strong>{t('multiplayer.twentyQuestions.opponentReplyLabel', { name: opponentName })}</strong> {hint}
                </div>
              ) : null}
              <p className="text-sm text-muted-foreground">
                {t('multiplayer.twentyQuestions.askerInstructions', { name: opponentName })}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={guessDraft}
                  onChange={event => setGuessDraft(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      submitGuess();
                    }
                  }}
                  placeholder={t('multiplayer.twentyQuestions.askPlaceholder')}
                  className="min-w-0 flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <Button type="button" onClick={submitGuess} disabled={!guessDraft.trim()} className="shrink-0">
                  {t('multiplayer.twentyQuestions.sendButton')}
                </Button>
              </div>
            </div>
          ) : isGuesser ? (
            <p className="text-sm text-muted-foreground">
              {t('multiplayer.twentyQuestions.waitingOpponentSecret', { name: opponentName })}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{t('multiplayer.twentyQuestions.waitingTurnStart')}</p>
          )}
        </div>
      )}

      <MatchEndOverlay winner={winner} onReplay={handleReplay} opponentLabel={opponentName} />
    </div>
  );
}
