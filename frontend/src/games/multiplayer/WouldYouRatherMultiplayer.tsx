import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/store/useGameStore';
import { ClientEvents, ServerEvents } from '@/lib/socketEvents';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { BurstReveal } from '@/components/solo/reveals/BurstReveal';
import type { Winner } from '@/lib/soloScore';

const TARGET_SCORE = 5;
type Side = 'left' | 'right';
type Prompt = { left: string; right: string };

type RoundResult = { yourChoice: Side; opponentChoice: Side; sameChoice: boolean };

type WouldYouRatherResultPayload = RoundResult & {
  scores: Record<string, number>;
  matchOver: boolean;
  teamResult: 'win' | 'lose' | null;
};

export function WouldYouRatherMultiplayer() {
  const { t } = useTranslation();
  const { socket, socketId } = useSocket();
  const players = useGameStore(state => state.players);
  const scores = useGameStore(state => state.scores);
  const setStoreScores = useGameStore(state => state.setScores);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [round, setRound] = useState<RoundResult | null>(null);
  const [awaitingNextRound, setAwaitingNextRound] = useState(false);
  const [matchOver, setMatchOver] = useState(false);
  const [winner, setWinner] = useState<Winner>(null);

  useEffect(() => {
    if (!socket || !socketId) {
      return;
    }

    const handleUpdate = (data: { prompt: Prompt }) => {
      setPrompt(data.prompt);
      setRound(null);
      setAwaitingNextRound(false);
      setWaiting(false);
    };

    const handleResult = (data: WouldYouRatherResultPayload) => {
      setWaiting(false);
      setRound({ yourChoice: data.yourChoice, opponentChoice: data.opponentChoice, sameChoice: data.sameChoice });
      setStoreScores(data.scores);
      setMatchOver(data.matchOver);
      setWinner(data.teamResult === 'win' ? 'player' : data.teamResult === 'lose' ? 'machine' : null);
    };

    const handleScoreReset = (data: { scores: Record<string, number> }) => {
      setStoreScores(data.scores);
      setMatchOver(false);
      setWinner(null);
      setRound(null);
      setPrompt(null);
      setAwaitingNextRound(true);
      setWaiting(false);
    };

    const handleGameState = (data: { gameId: string; state: { prompt: Prompt | null; waiting: boolean } }) => {
      if (data.gameId !== 'would-you-rather') {
        return;
      }
      if (data.state.prompt) {
        setPrompt(data.state.prompt);
        setAwaitingNextRound(false);
        setWaiting(data.state.waiting);
      } else {
        // No dilemma is active yet — let the normal players[0]-requests-a-round flow kick in.
        setAwaitingNextRound(true);
      }
    };

    socket.on(ServerEvents.WouldYouRatherUpdate, handleUpdate);
    socket.on(ServerEvents.WouldYouRatherResult, handleResult);
    socket.on(ServerEvents.ScoreReset, handleScoreReset);
    socket.on(ServerEvents.GameState, handleGameState);

    // On (re)connect, ask what round state already exists instead of assuming none does —
    // this avoids re-requesting a fresh dilemma over one that's already in progress.
    socket.emit(ClientEvents.RequestGameState);

    return () => {
      socket.off(ServerEvents.WouldYouRatherUpdate, handleUpdate);
      socket.off(ServerEvents.WouldYouRatherResult, handleResult);
      socket.off(ServerEvents.ScoreReset, handleScoreReset);
      socket.off(ServerEvents.GameState, handleGameState);
    };
  }, [socket, socketId, setStoreScores]);

  useEffect(() => {
    if (!socket || matchOver || !awaitingNextRound) {
      return;
    }
    if (players[0]?.id !== socketId) {
      return;
    }
    socket.emit(ClientEvents.WouldYouRatherStart);
  }, [socket, socketId, players, matchOver, awaitingNextRound]);

  const me = players.find(player => player.id === socketId) ?? null;
  const opponent = players.find(player => player.id !== socketId) ?? null;
  const myScore = socketId ? scores[socketId] ?? 0 : 0;
  const opponentScore = opponent ? scores[opponent.id] ?? 0 : 0;

  const chooseOption = (side: Side) => {
    if (!socket || waiting || round || matchOver || !prompt) {
      return;
    }
    socket.emit(ClientEvents.WouldYouRatherChoice, { selected: side });
    setWaiting(true);
  };

  const handleRevealComplete = () => {
    setRound(null);
    setAwaitingNextRound(true);
  };

  const handleReplay = () => {
    if (!socket) {
      return;
    }
    socket.emit(ClientEvents.ResetMatchScore);
  };

  return (
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-4 sm:p-8">
      <ScorePill
        player={myScore}
        machine={opponentScore}
        targetScore={TARGET_SCORE}
        onReset={handleReplay}
        playerLabel={`${me?.name ?? t('multiplayer.common.youFallback')}${t('multiplayer.common.youSuffix')}`}
        machineLabel={opponent?.name ?? t('multiplayer.common.opponentFallback')}
        hasOpponent={!!opponent}
      />

      {round && prompt ? (
        <BurstReveal
          icon={round.sameChoice ? 'success' : 'neutral'}
          headline={t('multiplayer.wouldYouRather.yourChoice', { choice: prompt[round.yourChoice] })}
          detail={
            round.sameChoice
              ? t('multiplayer.wouldYouRather.opponentSame', {
                  name: opponent?.name ?? t('multiplayer.common.opponentFallback'),
                  choice: prompt[round.opponentChoice]
                })
              : t('multiplayer.wouldYouRather.opponentDifferent', {
                  name: opponent?.name ?? t('multiplayer.common.opponentFallback'),
                  choice: prompt[round.opponentChoice]
                })
          }
          onComplete={handleRevealComplete}
        />
      ) : prompt && !awaitingNextRound ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {waiting ? t('multiplayer.wouldYouRather.waitingOpponent') : t('multiplayer.wouldYouRather.instructions')}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => chooseOption('left')}
              disabled={waiting || matchOver}
              className="h-auto whitespace-normal rounded-2xl border-2 border-border bg-card px-4 py-3 text-left text-sm font-medium text-foreground transition-all hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {prompt.left}
            </button>
            <button
              type="button"
              onClick={() => chooseOption('right')}
              disabled={waiting || matchOver}
              className="h-auto whitespace-normal rounded-2xl border-2 border-border bg-card px-4 py-3 text-left text-sm font-medium text-foreground transition-all hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {prompt.right}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('multiplayer.wouldYouRather.loading')}</p>
      )}

      <MatchEndOverlay
        winner={winner}
        onReplay={handleReplay}
        headlineOverride={
          winner === 'player'
            ? t('multiplayer.wouldYouRather.wonTogether')
            : winner === 'machine'
              ? t('multiplayer.wouldYouRather.lostTogether')
              : undefined
        }
        detailOverride={
          winner === 'player'
            ? t('multiplayer.wouldYouRather.detailIdentical', { name: opponent?.name ?? t('multiplayer.common.opponentFallback') })
            : winner === 'machine'
              ? t('multiplayer.wouldYouRather.detailDifferent', { name: opponent?.name ?? t('multiplayer.common.opponentFallback') })
              : undefined
        }
      />
    </div>
  );
}
