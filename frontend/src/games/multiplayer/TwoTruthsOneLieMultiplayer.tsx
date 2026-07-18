import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/store/useGameStore';
import { ClientEvents, ServerEvents } from '@/lib/socketEvents';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { BurstReveal } from '@/components/solo/reveals/BurstReveal';
import type { Winner } from '@/lib/soloScore';

const TARGET_SCORE = 5;

type ResultPayload = {
  voterSocketId: string;
  correct: boolean;
  lieIndex: number;
  scores: Record<string, number>;
  matchOver: boolean;
  winnerId: string | null;
  nextSubmitterId: string | null;
  nextVoterId: string | null;
};

export function TwoTruthsOneLieMultiplayer() {
  const { socket, socketId } = useSocket();
  const players = useGameStore(state => state.players);
  const setStoreScores = useGameStore(state => state.setScores);
  const [submitterId, setSubmitterId] = useState<string | null>(null);
  const [voterId, setVoterId] = useState<string | null>(null);
  const [statements, setStatements] = useState(['', '', '']);
  const [lieChoice, setLieChoice] = useState<number | null>(0);
  const [votingStatements, setVotingStatements] = useState<string[] | null>(null);
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [scores, setScores] = useState<Record<string, number>>(() => useGameStore.getState().scores);
  const [matchOver, setMatchOver] = useState(false);
  const [winner, setWinner] = useState<Winner>(null);

  useEffect(() => {
    if (!socket || !socketId) {
      return;
    }

    const handleRoundReady = (data: { submitterId: string; voterId: string }) => {
      setSubmitterId(data.submitterId);
      setVoterId(data.voterId);
      setVotingStatements(null);
      setStatements(['', '', '']);
      setLieChoice(0);
    };

    const handlePrompt = (data: { statements: string[] }) => {
      setVotingStatements(data.statements);
    };

    const handleResult = (data: ResultPayload) => {
      setResult(data);
      setScores(data.scores);
      setStoreScores(data.scores);
      setMatchOver(data.matchOver);
      setWinner(data.winnerId ? (data.winnerId === socketId ? 'player' : 'machine') : null);
    };

    const handleScoreReset = (data: { scores: Record<string, number> }) => {
      setScores(data.scores);
      setStoreScores(data.scores);
      setMatchOver(false);
      setWinner(null);
      setResult(null);
      setVotingStatements(null);
      setStatements(['', '', '']);
      setLieChoice(0);
    };

    socket.on(ServerEvents.TwoTruthsOneLieRoundReady, handleRoundReady);
    socket.on(ServerEvents.TwoTruthsOneLiePrompt, handlePrompt);
    socket.on(ServerEvents.TwoTruthsOneLieResult, handleResult);
    socket.on(ServerEvents.ScoreReset, handleScoreReset);

    // The server only broadcasts the initial TwoTruthsOneLieRoundReady once, right when the
    // match starts (from the waiting room, before this component has mounted and subscribed).
    // Actively request the current round state so we don't miss it and get stuck waiting forever.
    socket.emit(ClientEvents.TwoTruthsOneLieRequestState);

    return () => {
      socket.off(ServerEvents.TwoTruthsOneLieRoundReady, handleRoundReady);
      socket.off(ServerEvents.TwoTruthsOneLiePrompt, handlePrompt);
      socket.off(ServerEvents.TwoTruthsOneLieResult, handleResult);
      socket.off(ServerEvents.ScoreReset, handleScoreReset);
    };
  }, [socket, socketId, setStoreScores]);

  const me = players.find(player => player.id === socketId) ?? null;
  const opponent = players.find(player => player.id !== socketId) ?? null;
  const opponentName = opponent?.name ?? 'Adversaire';
  const myScore = socketId ? scores[socketId] ?? 0 : 0;
  const opponentScore = opponent ? scores[opponent.id] ?? 0 : 0;
  const isSubmitter = socketId !== null && socketId === submitterId;
  const isVoter = socketId !== null && socketId === voterId;

  const submitStatements = () => {
    if (!socket || !isSubmitter || matchOver || lieChoice === null) {
      return;
    }
    const cleaned = statements.map(statement => statement.trim());
    if (cleaned.some(text => !text)) {
      return;
    }
    socket.emit(ClientEvents.TwoTruthsOneLieSubmit, { statements: cleaned, lieIndex: lieChoice });
  };

  const vote = (voteIndex: number) => {
    if (!socket || !isVoter || matchOver) {
      return;
    }
    socket.emit(ClientEvents.TwoTruthsOneLieVote, { voteIndex });
  };

  const handleRevealComplete = () => {
    if (!result) {
      return;
    }

    setResult(null);
    setVotingStatements(null);
    setStatements(['', '', '']);
    setLieChoice(0);

    if (!result.matchOver) {
      setSubmitterId(result.nextSubmitterId);
      setVoterId(result.nextVoterId);
    }
  };

  const handleReplay = () => {
    if (!socket) {
      return;
    }
    socket.emit(ClientEvents.ResetMatchScore);
  };

  const myOutcome = result
    ? result.voterSocketId === socketId
      ? result.correct
        ? 'success'
        : 'fail'
      : result.correct
        ? 'fail'
        : 'success'
    : null;

  return (
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">
      <ScorePill
        player={myScore}
        machine={opponentScore}
        targetScore={TARGET_SCORE}
        onReset={handleReplay}
        playerLabel={`${me?.name ?? 'Vous'} (vous)`}
        machineLabel={opponentName}
      />

      {result && myOutcome ? (
        <BurstReveal
          icon={myOutcome === 'success' ? 'success' : 'fail'}
          headline={
            result.voterSocketId === socketId
              ? result.correct
                ? 'Bien joué, vous avez trouvé le mensonge !'
                : 'Perdu, ce n’était pas le mensonge.'
              : result.correct
                ? `${opponentName} a trouvé votre mensonge.`
                : `${opponentName} s’est trompé, vous gagnez le point !`
          }
          detail={`La phrase ${result.lieIndex + 1} était le mensonge.`}
          onComplete={handleRevealComplete}
        />
      ) : votingStatements && isVoter ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{opponentName} a soumis 3 affirmations. Votez pour le mensonge.</p>
          <div className="grid gap-3">
            {votingStatements.map((statement, index) => (
              <Button
                key={index}
                type="button"
                variant="outline"
                onClick={() => vote(index)}
                disabled={matchOver}
                className="h-auto justify-start whitespace-normal px-4 py-3 text-left"
              >
                {statement}
              </Button>
            ))}
          </div>
        </div>
      ) : votingStatements && isSubmitter ? (
        <p className="text-sm text-muted-foreground">Affirmations envoyées. En attente du vote de {opponentName}...</p>
      ) : isSubmitter ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            C'est à vous ! Écrivez 2 vérités et 1 mensonge sur vous, puis indiquez laquelle est fausse.
          </p>
          <div className="grid gap-3">
            {statements.map((text, index) => (
              <div key={index} className="flex items-center gap-3">
                <input
                  value={text}
                  onChange={event => setStatements(prev => prev.map((item, idx) => (idx === index ? event.target.value : item)))}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      submitStatements();
                    }
                  }}
                  placeholder={`Affirmation ${index + 1}`}
                  disabled={matchOver}
                  className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <Button
                  type="button"
                  variant={lieChoice === index ? 'default' : 'outline'}
                  onClick={() => setLieChoice(index)}
                  disabled={matchOver}
                  className="whitespace-nowrap"
                >
                  {lieChoice === index ? 'Mensonge ' : 'verité ✓'}
                </Button>
              </div>
            ))}
          </div>
          <Button type="button" onClick={submitStatements} disabled={matchOver || lieChoice === null}>
            Soumettre
          </Button>
        </div>
      ) : isVoter ? (
        <p className="text-sm text-muted-foreground">
          C'est au tour de {opponentName} de rédiger ses 3 affirmations. Patientez...
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">En attente du début de la manche...</p>
      )}

      <MatchEndOverlay winner={winner} onReplay={handleReplay} opponentLabel={opponentName} />
    </div>
  );
}
