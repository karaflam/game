import { useEffect, useState } from 'react';
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
  const { socket, socketId } = useSocket();
  const players = useGameStore(state => state.players);
  const setStoreScores = useGameStore(state => state.setScores);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [round, setRound] = useState<RoundResult | null>(null);
  const [awaitingNextRound, setAwaitingNextRound] = useState(true);
  const [scores, setScores] = useState<Record<string, number>>(() => useGameStore.getState().scores);
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
      setScores(data.scores);
      setStoreScores(data.scores);
      setMatchOver(data.matchOver);
      setWinner(data.teamResult === 'win' ? 'player' : data.teamResult === 'lose' ? 'machine' : null);
    };

    const handleScoreReset = (data: { scores: Record<string, number> }) => {
      setScores(data.scores);
      setStoreScores(data.scores);
      setMatchOver(false);
      setWinner(null);
      setRound(null);
      setPrompt(null);
      setAwaitingNextRound(true);
      setWaiting(false);
    };

    socket.on(ServerEvents.WouldYouRatherUpdate, handleUpdate);
    socket.on(ServerEvents.WouldYouRatherResult, handleResult);
    socket.on(ServerEvents.ScoreReset, handleScoreReset);

    return () => {
      socket.off(ServerEvents.WouldYouRatherUpdate, handleUpdate);
      socket.off(ServerEvents.WouldYouRatherResult, handleResult);
      socket.off(ServerEvents.ScoreReset, handleScoreReset);
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
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">
      <ScorePill
        player={myScore}
        machine={opponentScore}
        targetScore={TARGET_SCORE}
        onReset={handleReplay}
        playerLabel={`${me?.name ?? 'Vous'} (vous)`}
        machineLabel={opponent?.name ?? 'Adversaire'}
      />

      {round && prompt ? (
        <BurstReveal
          icon={round.sameChoice ? 'success' : 'neutral'}
          headline={`Vous : « ${prompt[round.yourChoice]} »`}
          detail={`${opponent?.name ?? 'Adversaire'} : « ${prompt[round.opponentChoice]} » ${
            round.sameChoice ? '— même choix, +1 chacun !' : '— choix différents cette fois.'
          }`}
          onComplete={handleRevealComplete}
        />
      ) : prompt && !awaitingNextRound ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{waiting ? 'Choix envoyé, en attente de l’adversaire...' : 'Tu préfères...'}</p>

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
        <p className="text-sm text-muted-foreground">Chargement du dilemme...</p>
      )}

      <MatchEndOverlay
        winner={winner}
        onReplay={handleReplay}
        headlineOverride={winner === 'player' ? 'Vous avez gagné ensemble !' : winner === 'machine' ? 'Vous avez perdu ensemble...' : undefined}
        detailOverride={
          winner === 'player'
            ? `${opponent?.name ?? 'Vous'} et vous avez trouvé 5 choix identiques !`
            : winner === 'machine'
              ? `${opponent?.name ?? 'Vous'} et vous avez fait 5 choix différents avant de vous accorder. Retentez votre chance !`
              : undefined
        }
      />
    </div>
  );
}
