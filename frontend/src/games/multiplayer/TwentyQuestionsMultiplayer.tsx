import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/store/useGameStore';
import { ClientEvents, ServerEvents } from '@/lib/socketEvents';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { BurstReveal } from '@/components/solo/reveals/BurstReveal';
import type { Winner } from '@/lib/soloScore';

const MAX_ATTEMPTS_PER_TURN = 10;
const TOTAL_TURNS = 6;

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
  const { socket, socketId } = useSocket();
  const players = useGameStore(state => state.players);
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
  const [scores, setScores] = useState<Record<string, number>>({});
  const [matchOver, setMatchOver] = useState(false);
  const [winner, setWinner] = useState<Winner>(null);

  useEffect(() => {
    if (!socket || !socketId) {
      return;
    }

    const handleRoundReady = (data: { setterId: string; guesserId: string; attemptsRemaining: number; turnIndex: number }) => {
      setSetterId(data.setterId);
      setGuesserId(data.guesserId);
      setAttemptsRemaining(data.attemptsRemaining);
      setTurnIndex(data.turnIndex);
      setWordSet(false);
      setWordDraft('');
      setGuessDraft('');
      setPendingGuess(null);
      setHint(null);
      setHintDraft('');
    };

    const handleGuessSubmitted = (data: { guess: string; attemptsRemaining: number }) => {
      setPendingGuess(data.guess);
      setAttemptsRemaining(data.attemptsRemaining);
    };

    const handleRoundResult = (data: RoundResultPayload) => {
      setScores(data.scores);
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
      setScores(data.scores);
      setStoreScores(data.scores);
      setMatchOver(false);
      setWinner(null);
      setRoundResult(null);
    };

    socket.on(ServerEvents.TwentyQuestionsRoundReady, handleRoundReady);
    socket.on(ServerEvents.TwentyQuestionsGuessSubmitted, handleGuessSubmitted);
    socket.on(ServerEvents.TwentyQuestionsRoundResult, handleRoundResult);
    socket.on(ServerEvents.ScoreReset, handleScoreReset);

    return () => {
      socket.off(ServerEvents.TwentyQuestionsRoundReady, handleRoundReady);
      socket.off(ServerEvents.TwentyQuestionsGuessSubmitted, handleGuessSubmitted);
      socket.off(ServerEvents.TwentyQuestionsRoundResult, handleRoundResult);
      socket.off(ServerEvents.ScoreReset, handleScoreReset);
    };
  }, [socket, socketId, setStoreScores]);

  const me = players.find(player => player.id === socketId) ?? null;
  const opponent = players.find(player => player.id !== socketId) ?? null;
  const myScore = socketId ? scores[socketId] ?? 0 : 0;
  const opponentScore = opponent ? scores[opponent.id] ?? 0 : 0;
  const isSetter = socketId !== null && socketId === setterId;
  const isGuesser = socketId !== null && socketId === guesserId;

  const submitWord = () => {
    if (!socket || !isSetter || !wordDraft.trim()) {
      return;
    }
    socket.emit(ClientEvents.TwentyQuestionsSetWord, { word: wordDraft.trim() });
    setWordSet(true);
  };

  const submitGuess = () => {
    if (!socket || !isGuesser || !guessDraft.trim() || pendingGuess) {
      return;
    }
    socket.emit(ClientEvents.TwentyQuestionsGuess, { guess: guessDraft.trim() });
  };

  const judge = (correct: boolean) => {
    if (!socket || !isSetter || !pendingGuess) {
      return;
    }
    socket.emit(ClientEvents.TwentyQuestionsJudge, { correct, hint: correct ? undefined : hintDraft.trim() || undefined });
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

  const scorePillTarget = Math.max(myScore, opponentScore, MAX_ATTEMPTS_PER_TURN);

  return (
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">
      <ScorePill
        player={myScore}
        machine={opponentScore}
        targetScore={scorePillTarget}
        onReset={handleReplay}
        playerLabel={`${me?.name ?? 'Vous'} (vous)`}
        machineLabel={opponent?.name ?? 'Adversaire'}
      />

      {roundResult ? (
        <BurstReveal
          icon={roundResult.correct ? 'success' : 'fail'}
          headline={
            roundResult.correct
              ? isGuesser
                ? `Trouvé ! +${roundResult.attemptsRemaining} point(s).`
                : `${opponent?.name ?? 'Le devineur'} a trouvé le mot.`
              : 'Essais épuisés pour cette manche, 0 point.'
          }
          detail={`Tour ${roundResult.turnIndex} / ${TOTAL_TURNS} terminé.`}
          onComplete={handleRoundRevealComplete}
        />
      ) : (
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Tour {turnIndex} / {TOTAL_TURNS} — {attemptsRemaining} essai(s) restant(s)
          </p>

          {isSetter && !wordSet ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Vous êtes le meneur. Choisissez le mot secret.</p>
              <input
                value={wordDraft}
                onChange={event => setWordDraft(event.target.value)}
                placeholder="Mot secret"
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <Button type="button" onClick={submitWord} disabled={!wordDraft.trim()}>
                Valider le mot
              </Button>
            </div>
          ) : isSetter && pendingGuess ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-border bg-muted p-4 text-sm text-foreground">
                <strong>Proposition :</strong> {pendingGuess}
              </div>
              <input
                value={hintDraft}
                onChange={event => setHintDraft(event.target.value)}
                placeholder="Indice à donner si incorrect (facultatif)"
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <div className="flex gap-3">
                <Button type="button" onClick={() => judge(true)}>
                  Correct
                </Button>
                <Button type="button" variant="outline" onClick={() => judge(false)}>
                  Incorrect
                </Button>
              </div>
            </div>
          ) : isSetter ? (
            <p className="text-sm text-muted-foreground">Mot défini. En attente d’une question de {opponent?.name ?? 'l’adversaire'}...</p>
          ) : isGuesser && pendingGuess ? (
            <p className="text-sm text-muted-foreground">En attente du jugement de {opponent?.name ?? 'l’adversaire'}...</p>
          ) : isGuesser ? (
            <div className="space-y-3">
              {hint ? (
                <div className="rounded-2xl border border-border bg-muted p-4 text-sm text-foreground">
                  <strong>Indice :</strong> {hint}
                </div>
              ) : null}
              <p className="text-sm text-muted-foreground">Vous êtes le devineur. Posez une question ou proposez un mot.</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={guessDraft}
                  onChange={event => setGuessDraft(event.target.value)}
                  placeholder="Votre question ou proposition"
                  className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <Button type="button" onClick={submitGuess} disabled={!guessDraft.trim()}>
                  Envoyer
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">En attente du début du tour...</p>
          )}
        </div>
      )}

      <MatchEndOverlay winner={winner} onReplay={handleReplay} />
    </div>
  );
}
