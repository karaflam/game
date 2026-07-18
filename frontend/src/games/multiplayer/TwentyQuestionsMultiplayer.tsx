import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/store/useGameStore';
import { ClientEvents, ServerEvents } from '@/lib/socketEvents';
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
    socket.on(ServerEvents.TwentyQuestionsWordReady, handleWordReady);
    socket.on(ServerEvents.TwentyQuestionsGuessSubmitted, handleGuessSubmitted);
    socket.on(ServerEvents.TwentyQuestionsRoundResult, handleRoundResult);
    socket.on(ServerEvents.ScoreReset, handleScoreReset);

    // The server only broadcasts the initial TwentyQuestionsRoundReady once, right when the
    // match starts (from the waiting room, before this component has mounted and subscribed).
    // Actively request the current round state so we don't miss it and get stuck waiting forever.
    socket.emit(ClientEvents.TwentyQuestionsRequestState);

    return () => {
      socket.off(ServerEvents.TwentyQuestionsRoundReady, handleRoundReady);
      socket.off(ServerEvents.TwentyQuestionsWordReady, handleWordReady);
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
  const opponentName = opponent?.name ?? 'l’autre joueur';

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
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">
      <div className="rounded-2xl bg-secondary px-4 py-3 text-secondary-foreground">
        <div className="mb-3 flex items-center justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={handleReplay} className="gap-1.5">
            <RotateCcw className="h-4 w-4" />
            Réinitialiser
          </Button>
        </div>
        <div className="flex items-center justify-between text-sm font-semibold text-foreground">
          <span>{me?.name ?? 'Vous'} (vous) : {myScore} pt(s)</span>
          <span>{opponentName} : {opponentScore} pt(s)</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          La partie se joue en {TOTAL_TURNS} tours. Celui qui a le plus de points à la fin gagne.
        </p>
      </div>

      {roundResult ? (
        <BurstReveal
          icon={roundResult.correct ? 'success' : 'fail'}
          headline={
            roundResult.correct
              ? isGuesser
                ? `Bravo, vous avez trouvé le mot ! +${roundResult.attemptsRemaining} point(s).`
                : `${opponentName} a trouvé le mot secret.`
              : 'Essais épuisés pour ce tour, personne ne marque de point.'
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
              <p className="text-sm text-muted-foreground">
                C'est vous le meneur ! Pensez à un mot secret que {opponentName} devra deviner, puis écrivez-le ci-dessous.
                {opponentName} ne le verra pas.
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
                  placeholder="Écrivez ici le mot secret (ex : éléphant)"
                  className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <Button type="button" onClick={submitWord} disabled={!wordDraft.trim()} className="h-auto px-6 py-3">
                  Valider le mot secret
                </Button>
              </div>
            </div>
          ) : isSetter && pendingGuess ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {opponentName} propose ceci. Est-ce que ça correspond à votre mot secret ?
              </p>
              <div className="rounded-2xl border border-border bg-muted p-4 text-sm text-foreground">
                « {pendingGuess} »
              </div>
              <div>
                <p className="mb-1 text-sm text-muted-foreground">
                  Si ce n'est pas le bon mot, écrivez un indice pour aider {opponentName} :
                </p>
                <input
                  value={hintDraft}
                  onChange={event => setHintDraft(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      judge(false);
                    }
                  }}
                  placeholder="Ex : Il vit dans la savane"
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex gap-3">
                <Button type="button" onClick={() => judge(true)}>
                  Mot trouvé
                </Button>
                <Button type="button" variant="outline" onClick={() => judge(false)} disabled={!hintDraft.trim()}>
                  Pas encore, donner l’indice
                </Button>
              </div>
            </div>
          ) : isSetter ? (
            <p className="text-sm text-muted-foreground">
              Mot secret enregistré ! Attendez que {opponentName} propose une réponse.
            </p>
          ) : isGuesser && pendingGuess ? (
            <p className="text-sm text-muted-foreground">
              Votre proposition a été envoyée. Attendez que {opponentName} vous dise si c'est le bon mot.
            </p>
          ) : isGuesser && wordSet ? (
            <div className="space-y-3">
              {hint ? (
                <div className="rounded-2xl border border-border bg-muted p-4 text-sm text-foreground">
                  <strong>Indice :</strong> {hint}
                </div>
              ) : null}
              <p className="text-sm text-muted-foreground">
                {opponentName} a choisi un mot secret. Essayez de le deviner !
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
                  placeholder="Écrivez le mot que vous pensez être le bon"
                  className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <Button type="button" onClick={submitGuess} disabled={!guessDraft.trim()}>
                  Envoyer ma réponse
                </Button>
              </div>
            </div>
          ) : isGuesser ? (
            <p className="text-sm text-muted-foreground">
              C'est {opponentName} qui a choisi le mot secret. Patientez pendant qu'il/elle l'écrit...
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">En attente du début du tour...</p>
          )}
        </div>
      )}

      <MatchEndOverlay winner={winner} onReplay={handleReplay} opponentLabel={opponentName} />
    </div>
  );
}
