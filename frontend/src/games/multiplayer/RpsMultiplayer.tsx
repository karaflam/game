import { useEffect, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/store/useGameStore';
import { ClientEvents, ServerEvents } from '@/lib/socketEvents';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { DuelReveal } from '@/components/solo/reveals/DuelReveal';
import type { Winner } from '@/lib/soloScore';

const RPS_TARGET_SCORE = 5;
const RPS_MOVES = ['pierre', 'feuille', 'ciseau'] as const;
type RpsMove = (typeof RPS_MOVES)[number];

const moveLabels: Record<RpsMove, string> = {
  pierre: 'Pierre',
  feuille: 'Feuille',
  ciseau: 'Ciseau'
};

const moveEmojis: Record<RpsMove, string> = {
  pierre: '✊',
  feuille: '✋',
  ciseau: '✌️'
};

type RoundResult = {
  yourMove: RpsMove;
  opponentMove: RpsMove;
  outcome: 'player' | 'machine' | 'draw';
};

type RpsResultPayload = {
  yourMove: RpsMove;
  opponentMove: RpsMove;
  outcome: 'player' | 'machine' | 'draw';
  scores: Record<string, number>;
  matchOver: boolean;
  winnerId: string | null;
};

export function RpsMultiplayer() {
  const { socket, socketId } = useSocket();
  const players = useGameStore(state => state.players);
  const [waiting, setWaiting] = useState(false);
  const [round, setRound] = useState<RoundResult | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [matchOver, setMatchOver] = useState(false);
  const [winner, setWinner] = useState<Winner>(null);

  useEffect(() => {
    if (!socket || !socketId) {
      return;
    }

    const handleResult = (data: RpsResultPayload) => {
      setWaiting(false);
      setRound({ yourMove: data.yourMove, opponentMove: data.opponentMove, outcome: data.outcome });
      setScores(data.scores);
      setMatchOver(data.matchOver);
      setWinner(data.winnerId ? (data.winnerId === socketId ? 'player' : 'machine') : null);
    };

    const handleScoreReset = (data: { scores: Record<string, number> }) => {
      setScores(data.scores);
      setMatchOver(false);
      setWinner(null);
      setRound(null);
      setWaiting(false);
    };

    socket.on(ServerEvents.RpsResult, handleResult);
    socket.on(ServerEvents.ScoreReset, handleScoreReset);

    return () => {
      socket.off(ServerEvents.RpsResult, handleResult);
      socket.off(ServerEvents.ScoreReset, handleScoreReset);
    };
  }, [socket, socketId]);

  const opponentId = players.find(player => player.id !== socketId)?.id ?? null;
  const myScore = socketId ? scores[socketId] ?? 0 : 0;
  const opponentScore = opponentId ? scores[opponentId] ?? 0 : 0;

  const playRound = (move: RpsMove) => {
    if (!socket || waiting || round || matchOver) {
      return;
    }
    socket.emit(ClientEvents.RpsPlay, { choice: move });
    setWaiting(true);
  };

  const handleRevealComplete = () => {
    setRound(null);
  };

  const handleReplay = () => {
    if (!socket) {
      return;
    }
    socket.emit(ClientEvents.ResetMatchScore);
  };

  return (
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">
      <ScorePill player={myScore} machine={opponentScore} targetScore={RPS_TARGET_SCORE} onReset={handleReplay} />

      {round ? (
        <DuelReveal
          playerEmoji={moveEmojis[round.yourMove]}
          playerLabel={moveLabels[round.yourMove]}
          machineEmoji={moveEmojis[round.opponentMove]}
          machineLabel={moveLabels[round.opponentMove]}
          outcome={round.outcome}
          onComplete={handleRevealComplete}
        />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {waiting ? 'Choix envoyé, en attente de l’adversaire...' : 'Choisissez pierre, feuille ou ciseau.'}
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            {RPS_MOVES.map(move => (
              <button
                key={move}
                type="button"
                onClick={() => playRound(move)}
                disabled={waiting || matchOver}
                className="flex flex-col items-center gap-2 rounded-2xl border-2 border-border bg-card p-5 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                <span className="text-4xl">{moveEmojis[move]}</span>
                <span className="text-sm font-semibold text-foreground">{moveLabels[move]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <MatchEndOverlay winner={winner} onReplay={handleReplay} />
    </div>
  );
}
