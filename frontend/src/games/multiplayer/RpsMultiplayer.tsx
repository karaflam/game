import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGLTF } from '@react-three/drei';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/store/useGameStore';
import { ClientEvents, ServerEvents } from '@/lib/socketEvents';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { DuelReveal } from '@/components/solo/reveals/DuelReveal';
import { getThemeMaterial } from '@/three/themeMaterials';
import { useAdaptiveQuality } from '@/three/useAdaptiveQuality';
import { OPEN_HAND_URL, FIST_URL, PEACE_SIGN_URL } from '@/three/scenes/LowPolyHand';
import useTheme from '@/hooks/useTheme';
import type { Winner } from '@/lib/soloScore';

const GameCanvas = lazy(() => import('@/three/GameCanvas').then(m => ({ default: m.GameCanvas })));
const HandDuelScene = lazy(() =>
  import('@/three/scenes/HandDuelScene').then(m => ({ default: m.HandDuelScene }))
);

const RPS_TARGET_SCORE = 5;
const RPS_MOVES = ['pierre', 'feuille', 'ciseau'] as const;
type RpsMove = (typeof RPS_MOVES)[number];

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
  const { t } = useTranslation();
  const { socket, socketId } = useSocket();
  const players = useGameStore(state => state.players);
  const scores = useGameStore(state => state.scores);
  const setStoreScores = useGameStore(state => state.setScores);
  const { theme } = useTheme();
  const quality = useAdaptiveQuality();
  const [waiting, setWaiting] = useState(false);
  const [round, setRound] = useState<RoundResult | null>(null);
  const [matchOver, setMatchOver] = useState(false);
  const [winner, setWinner] = useState<Winner>(null);

  useEffect(() => {
    // Preload the hand models once the player has actually navigated to this
    // game, rather than at app boot (see LowPolyHand.tsx for the pose->asset map).
    useGLTF.preload(OPEN_HAND_URL);
    useGLTF.preload(FIST_URL);
    useGLTF.preload(PEACE_SIGN_URL);
  }, []);

  useEffect(() => {
    if (!socket || !socketId) {
      return;
    }

    const handleResult = (data: RpsResultPayload) => {
      setWaiting(false);
      setRound({ yourMove: data.yourMove, opponentMove: data.opponentMove, outcome: data.outcome });
      setStoreScores(data.scores);
      setMatchOver(data.matchOver);
      setWinner(data.winnerId ? (data.winnerId === socketId ? 'player' : 'machine') : null);
    };

    const handleScoreReset = (data: { scores: Record<string, number> }) => {
      setStoreScores(data.scores);
      setMatchOver(false);
      setWinner(null);
      setRound(null);
      setWaiting(false);
    };

    const handleGameState = (data: { gameId: string; state: { waiting: boolean } }) => {
      if (data.gameId !== 'rps') {
        return;
      }
      setWaiting(data.state.waiting);
    };

    socket.on(ServerEvents.RpsResult, handleResult);
    socket.on(ServerEvents.ScoreReset, handleScoreReset);
    socket.on(ServerEvents.GameState, handleGameState);

    // If we (re)connect mid-round (after already having played our move), resync that fact
    // instead of showing the move picker again as if nothing had been chosen yet.
    socket.emit(ClientEvents.RequestGameState);

    return () => {
      socket.off(ServerEvents.RpsResult, handleResult);
      socket.off(ServerEvents.ScoreReset, handleScoreReset);
      socket.off(ServerEvents.GameState, handleGameState);
    };
  }, [socket, socketId, setStoreScores]);

  const me = players.find(player => player.id === socketId) ?? null;
  const opponent = players.find(player => player.id !== socketId) ?? null;
  const myScore = socketId ? scores[socketId] ?? 0 : 0;
  const opponentScore = opponent ? scores[opponent.id] ?? 0 : 0;

  const moveLabels: Record<RpsMove, string> = {
    pierre: t('solo.rps.moves.pierre'),
    feuille: t('solo.rps.moves.feuille'),
    ciseau: t('solo.rps.moves.ciseau')
  };

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
    <div className="relative isolate space-y-6 rounded-3xl border border-border bg-background p-4 sm:p-8">
      <ScorePill
        player={myScore}
        machine={opponentScore}
        targetScore={RPS_TARGET_SCORE}
        onReset={handleReplay}
        playerLabel={`${me?.name ?? t('multiplayer.common.youFallback')}${t('multiplayer.common.youSuffix')}`}
        machineLabel={opponent?.name ?? t('multiplayer.common.opponentFallback')}
        hasOpponent={!!opponent}
      />

      {round && quality === 'fallback2d' ? (
        <DuelReveal
          playerEmoji={moveEmojis[round.yourMove]}
          playerLabel={moveLabels[round.yourMove]}
          machineEmoji={moveEmojis[round.opponentMove]}
          machineLabel={moveLabels[round.opponentMove]}
          outcome={round.outcome}
          onComplete={handleRevealComplete}
        />
      ) : round ? (
        <div className="relative -mx-4 aspect-square w-[calc(100%+2rem)] overflow-hidden rounded-2xl bg-muted sm:mx-0 sm:aspect-auto sm:h-[28rem] sm:w-full">
          <div className="absolute inset-0">
            <Suspense fallback={null}>
              <GameCanvas theme={theme} quality={quality}>
                <HandDuelScene
                  round={{ player: round.yourMove, machine: round.opponentMove, outcome: round.outcome }}
                  material={getThemeMaterial(theme)}
                  onComplete={handleRevealComplete}
                />
              </GameCanvas>
            </Suspense>
          </div>
          <p className="absolute inset-x-0 bottom-4 text-center text-lg font-bold text-foreground">
            {round.outcome === 'player'
              ? t('solo.rps.duelOutcomeWin')
              : round.outcome === 'machine'
                ? t('solo.rps.duelOutcomeLose')
                : t('solo.rps.duelOutcomeDraw')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {waiting ? t('multiplayer.rps.waitingOpponent') : t('multiplayer.rps.instructions')}
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

      {!round && quality !== 'fallback2d' && (
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-3xl opacity-60">
          <Suspense fallback={null}>
            <GameCanvas theme={theme} quality={quality}>
              <HandDuelScene round={null} material={getThemeMaterial(theme)} onComplete={() => {}} />
            </GameCanvas>
          </Suspense>
        </div>
      )}

      <MatchEndOverlay winner={winner} onReplay={handleReplay} opponentLabel={opponent?.name ?? t('multiplayer.common.opponentFallback')} />
    </div>
  );
}
