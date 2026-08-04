import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/store/useGameStore';
import { ClientEvents, ServerEvents } from '@/lib/socketEvents';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { BurstReveal } from '@/components/solo/reveals/BurstReveal';
import { getThemeMaterial } from '@/three/themeMaterials';
import { useAdaptiveQuality } from '@/three/useAdaptiveQuality';
import useTheme from '@/hooks/useTheme';
import type { Winner } from '@/lib/soloScore';

const GameCanvas = lazy(() => import('@/three/GameCanvas').then(m => ({ default: m.GameCanvas })));
const BadgeBurstScene = lazy(() => import('@/three/scenes/BadgeBurstScene').then(m => ({ default: m.BadgeBurstScene })));

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
  const { t } = useTranslation();
  const { socket, socketId } = useSocket();
  const players = useGameStore(state => state.players);
  const scores = useGameStore(state => state.scores);
  const setStoreScores = useGameStore(state => state.setScores);
  const { theme } = useTheme();
  const quality = useAdaptiveQuality();
  const [submitterId, setSubmitterId] = useState<string | null>(null);
  const [voterId, setVoterId] = useState<string | null>(null);
  const [statements, setStatements] = useState(['', '', '']);
  const [lieChoice, setLieChoice] = useState<number | null>(0);
  const [votingStatements, setVotingStatements] = useState<string[] | null>(null);
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [matchOver, setMatchOver] = useState(false);
  const [winner, setWinner] = useState<Winner>(null);
  // handlePrompt is registered once at mount (inside the effect below) and so
  // would otherwise close over a stale `result` from that first render — this
  // ref keeps it readable with the latest value without re-subscribing the
  // socket listeners on every reveal.
  const resultRef = useRef<ResultPayload | null>(null);

  useEffect(() => {
    resultRef.current = result;
  }, [result]);

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
      // A fresh prompt only ever arrives once the round has genuinely
      // advanced server-side (roles are swapped there the moment the vote is
      // cast — see roomManager.voteTwoTruthsOneLie). If we're still showing
      // the previous round's reveal because the local player hasn't
      // dismissed it yet, apply the same role swap dismissing it
      // (handleRevealComplete) would have applied right now — otherwise the
      // stale reveal keeps winning the render below (it's checked first)
      // until the player finally clicks through, at which point
      // handleRevealComplete would wipe this very `votingStatements` back to
      // null, desyncing the room until a refresh forces a resync.
      const pendingResult = resultRef.current;
      if (pendingResult) {
        setResult(null);
        setStatements(['', '', '']);
        setLieChoice(0);
        if (!pendingResult.matchOver) {
          setSubmitterId(pendingResult.nextSubmitterId);
          setVoterId(pendingResult.nextVoterId);
        }
      }
      setVotingStatements(data.statements);
    };

    const handleResult = (data: ResultPayload) => {
      setResult(data);
      setStoreScores(data.scores);
    };

    const handleScoreReset = (data: { scores: Record<string, number> }) => {
      setStoreScores(data.scores);
      setMatchOver(false);
      setWinner(null);
      setResult(null);
      setVotingStatements(null);
      setStatements(['', '', '']);
      setLieChoice(0);
    };

    const handleGameState = (data: {
      gameId: string;
      state: {
        submitterId: string;
        voterId: string;
        votingStatements: string[] | null;
        lieIndex: number | null;
      };
    }) => {
      if (data.gameId !== 'two-truths-one-lie') {
        return;
      }
      setSubmitterId(data.state.submitterId);
      setVoterId(data.state.voterId);
      setVotingStatements(data.state.votingStatements);
      if (data.state.lieIndex !== null) {
        setLieChoice(data.state.lieIndex);
      }
    };

    socket.on(ServerEvents.TwoTruthsOneLieRoundReady, handleRoundReady);
    socket.on(ServerEvents.TwoTruthsOneLiePrompt, handlePrompt);
    socket.on(ServerEvents.TwoTruthsOneLieResult, handleResult);
    socket.on(ServerEvents.ScoreReset, handleScoreReset);
    socket.on(ServerEvents.GameState, handleGameState);

    // The server only broadcasts the initial TwoTruthsOneLieRoundReady once, right when the
    // match starts (from the waiting room, before this component has mounted and subscribed).
    // Actively request the current round state so we don't miss it and get stuck waiting forever
    // — this also covers every later (re)connect, since socketId changes each time one happens.
    socket.emit(ClientEvents.RequestGameState);

    return () => {
      socket.off(ServerEvents.TwoTruthsOneLieRoundReady, handleRoundReady);
      socket.off(ServerEvents.TwoTruthsOneLiePrompt, handlePrompt);
      socket.off(ServerEvents.TwoTruthsOneLieResult, handleResult);
      socket.off(ServerEvents.ScoreReset, handleScoreReset);
      socket.off(ServerEvents.GameState, handleGameState);
    };
  }, [socket, socketId, setStoreScores]);

  const me = players.find(player => player.id === socketId) ?? null;
  const opponent = players.find(player => player.id !== socketId) ?? null;
  const opponentName = opponent?.name ?? t('multiplayer.common.opponentFallback');
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
    setMatchOver(result.matchOver);
    setWinner(result.winnerId ? (result.winnerId === socketId ? 'player' : 'machine') : null);

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
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-4 sm:p-8">
      <ScorePill
        player={myScore}
        machine={opponentScore}
        targetScore={TARGET_SCORE}
        onReset={handleReplay}
        playerLabel={`${me?.name ?? t('multiplayer.common.youFallback')}${t('multiplayer.common.youSuffix')}`}
        machineLabel={opponentName}
        hasOpponent={!!opponent}
      />

      {result && myOutcome && quality === 'fallback2d' ? (
        <BurstReveal
          icon={myOutcome === 'success' ? 'success' : 'fail'}
          headline={
            result.voterSocketId === socketId
              ? result.correct
                ? t('multiplayer.twoTruthsOneLie.won')
                : t('multiplayer.twoTruthsOneLie.lost')
              : result.correct
                ? t('multiplayer.twoTruthsOneLie.opponentFound', { name: opponentName })
                : t('multiplayer.twoTruthsOneLie.opponentMissed', { name: opponentName })
          }
          detail={t('multiplayer.twoTruthsOneLie.lieWas', { index: result.lieIndex + 1 })}
          onComplete={handleRevealComplete}
        />
      ) : result && myOutcome ? (
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
                variant={myOutcome}
                material={getThemeMaterial(theme)}
                headline={
                  result.voterSocketId === socketId
                    ? result.correct
                      ? t('multiplayer.twoTruthsOneLie.won')
                      : t('multiplayer.twoTruthsOneLie.lost')
                    : result.correct
                      ? t('multiplayer.twoTruthsOneLie.opponentFound', { name: opponentName })
                      : t('multiplayer.twoTruthsOneLie.opponentMissed', { name: opponentName })
                }
                detail={t('multiplayer.twoTruthsOneLie.lieWas', { index: result.lieIndex + 1 })}
              />
            </GameCanvas>
          </Suspense>
          <p className="absolute inset-x-0 bottom-4 text-center text-xs text-muted-foreground">{t('solo.reveals.continueHint')}</p>
        </div>
      ) : votingStatements && isVoter ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('multiplayer.twoTruthsOneLie.instructions', { name: opponentName })}</p>
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
        <p className="text-sm text-muted-foreground">{t('multiplayer.twoTruthsOneLie.waitingVote', { name: opponentName })}</p>
      ) : isSubmitter ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('multiplayer.twoTruthsOneLie.writeInstructions')}
          </p>
          <div className="grid gap-3">
            {statements.map((text, index) => (
              <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <input
                  value={text}
                  onChange={event => setStatements(prev => prev.map((item, idx) => (idx === index ? event.target.value : item)))}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      submitStatements();
                    }
                  }}
                  placeholder={t('multiplayer.twoTruthsOneLie.statementPlaceholder', { index: index + 1 })}
                  disabled={matchOver}
                  className="min-w-0 flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <Button
                  type="button"
                  variant={lieChoice === index ? 'default' : 'outline'}
                  onClick={() => setLieChoice(index)}
                  disabled={matchOver}
                  className="shrink-0 whitespace-nowrap"
                >
                  {lieChoice === index ? t('multiplayer.twoTruthsOneLie.markLie') : t('multiplayer.twoTruthsOneLie.markTruth')}
                </Button>
              </div>
            ))}
          </div>
          <Button type="button" onClick={submitStatements} disabled={matchOver || lieChoice === null}>
            {t('multiplayer.twoTruthsOneLie.submitButton')}
          </Button>
        </div>
      ) : isVoter ? (
        <p className="text-sm text-muted-foreground">
          {t('multiplayer.twoTruthsOneLie.waitingOpponentWriting', { name: opponentName })}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">{t('multiplayer.twoTruthsOneLie.waitingRoundStart')}</p>
      )}

      <MatchEndOverlay winner={winner} onReplay={handleReplay} opponentLabel={opponentName} />
    </div>
  );
}
