import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/store/useGameStore';
import { ClientEvents, ServerEvents } from '@/lib/socketEvents';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { FlipReveal } from '@/components/solo/reveals/FlipReveal';
import { NumberTokenPicker } from '@/components/solo/NumberTokenPicker';
import { getThemeMaterial } from '@/three/themeMaterials';
import { useAdaptiveQuality } from '@/three/useAdaptiveQuality';
import useTheme from '@/hooks/useTheme';
import { NumberDrum } from '@/three/scenes/NumberDrum';
import type { Winner } from '@/lib/soloScore';

const GameCanvas = lazy(() => import('@/three/GameCanvas').then(m => ({ default: m.GameCanvas })));
const OddOrEvenDuelScene = lazy(() =>
  import('@/three/scenes/OddOrEvenDuelScene').then(m => ({ default: m.OddOrEvenDuelScene }))
);

const ODD_OR_EVEN_TARGET_SCORE = 5;
type Parity = 'pair' | 'impair';
const PARITIES: Parity[] = ['pair', 'impair'];

type RoundResult = {
  yourValue: number;
  yourPrediction: Parity;
  opponentValue: number;
  opponentPrediction: Parity;
  sum: number;
  parity: Parity;
  outcome: 'player' | 'machine' | 'draw';
  bothCorrect: boolean;
};

type OddOrEvenResultPayload = RoundResult & {
  scores: Record<string, number>;
  matchOver: boolean;
  isDraw: boolean;
  winnerId: string | null;
};

export function OddOrEvenMultiplayer() {
  const { t } = useTranslation();
  const { socket, socketId } = useSocket();
  const { theme } = useTheme();
  const quality = useAdaptiveQuality();
  const players = useGameStore(state => state.players);
  const scores = useGameStore(state => state.scores);
  const setStoreScores = useGameStore(state => state.setScores);
  const [playerNumber, setPlayerNumber] = useState(1);
  const [prediction, setPrediction] = useState<Parity>('pair');
  const [waiting, setWaiting] = useState(false);
  const [round, setRound] = useState<RoundResult | null>(null);
  const [matchOver, setMatchOver] = useState(false);
  const [winner, setWinner] = useState<Winner>(null);
  // Set only once the duel reveal's onComplete fires (handleRevealComplete), not on
  // receipt of the result: MatchEndOverlay renders as an absolute inset-0 overlay in
  // the same container as the reveal, so committing this immediately would cover the
  // last round's reveal animation before the player ever sees it finish.
  const pendingMatchEndRef = useRef<{ matchOver: boolean; winner: Winner } | null>(null);

  useEffect(() => {
    if (!socket || !socketId) {
      return;
    }

    const handleResult = (data: OddOrEvenResultPayload) => {
      setWaiting(false);
      setRound({
        yourValue: data.yourValue,
        yourPrediction: data.yourPrediction,
        opponentValue: data.opponentValue,
        opponentPrediction: data.opponentPrediction,
        sum: data.sum,
        parity: data.parity,
        outcome: data.outcome,
        bothCorrect: data.bothCorrect
      });
      setStoreScores(data.scores);
      pendingMatchEndRef.current = {
        matchOver: data.matchOver,
        winner: data.matchOver ? (data.isDraw ? 'draw' : data.winnerId === socketId ? 'player' : 'machine') : null
      };
    };

    const handleScoreReset = (data: { scores: Record<string, number> }) => {
      setStoreScores(data.scores);
      pendingMatchEndRef.current = null;
      setMatchOver(false);
      setWinner(null);
      setRound(null);
      setWaiting(false);
    };

    const handleGameState = (data: { gameId: string; state: { waiting: boolean } }) => {
      if (data.gameId !== 'odd-or-even') {
        return;
      }
      setWaiting(data.state.waiting);
    };

    socket.on(ServerEvents.OddOrEvenResult, handleResult);
    socket.on(ServerEvents.ScoreReset, handleScoreReset);
    socket.on(ServerEvents.GameState, handleGameState);

    // If we (re)connect mid-round (after already having played our choice), resync that fact
    // instead of showing the picker again as if nothing had been chosen yet.
    socket.emit(ClientEvents.RequestGameState);

    return () => {
      socket.off(ServerEvents.OddOrEvenResult, handleResult);
      socket.off(ServerEvents.ScoreReset, handleScoreReset);
      socket.off(ServerEvents.GameState, handleGameState);
    };
  }, [socket, socketId, setStoreScores]);

  const me = players.find(player => player.id === socketId) ?? null;
  const opponent = players.find(player => player.id !== socketId) ?? null;
  const myScore = socketId ? scores[socketId] ?? 0 : 0;
  const opponentScore = opponent ? scores[opponent.id] ?? 0 : 0;

  const playRound = () => {
    if (!socket || waiting || round || matchOver) {
      return;
    }
    socket.emit(ClientEvents.OddOrEvenPlay, { value: playerNumber, prediction });
    setWaiting(true);
  };

  const handleRevealComplete = () => {
    setRound(null);
    if (pendingMatchEndRef.current) {
      setMatchOver(pendingMatchEndRef.current.matchOver);
      setWinner(pendingMatchEndRef.current.winner);
      pendingMatchEndRef.current = null;
    }
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
        targetScore={ODD_OR_EVEN_TARGET_SCORE}
        onReset={handleReplay}
        playerLabel={`${me?.name ?? t('multiplayer.common.youFallback')}${t('multiplayer.common.youSuffix')}`}
        machineLabel={opponent?.name ?? t('multiplayer.common.opponentFallback')}
        hasOpponent={!!opponent}
      />

      {round && quality === 'fallback2d' ? (
        <FlipReveal
          cards={[
            { id: 'player', content: round.yourValue, highlight: round.outcome === 'player' },
            { id: 'opponent', content: round.opponentValue, highlight: round.outcome === 'machine' || round.bothCorrect }
          ]}
          outcomeLabel={
            round.bothCorrect
              ? t('multiplayer.oddOrEven.outcomeBothRight', { sum: round.sum, parity: round.parity })
              : t('multiplayer.oddOrEven.outcome', { sum: round.sum, parity: round.parity })
          }
          onComplete={handleRevealComplete}
        />
      ) : round ? (
        <div className="relative -mx-4 aspect-[3/4] w-[calc(100%+2rem)] overflow-hidden rounded-2xl bg-muted sm:mx-0 sm:aspect-auto sm:h-[28rem] sm:w-full">
          <Suspense fallback={null}>
            <GameCanvas theme={theme} quality={quality} bloom={false}>
              <OddOrEvenDuelScene
                round={{
                  yourValue: round.yourValue,
                  opponentValue: round.opponentValue,
                  sum: round.sum,
                  parityLabel: round.parity === 'pair' ? t('solo.oddOrEven.even') : t('solo.oddOrEven.odd'),
                  outcomeLabel: round.bothCorrect
                    ? t('multiplayer.oddOrEven.outcomeBothRight', { sum: round.sum, parity: round.parity })
                    : t('multiplayer.oddOrEven.outcome', { sum: round.sum, parity: round.parity })
                }}
                material={getThemeMaterial(theme)}
                onComplete={handleRevealComplete}
              />
            </GameCanvas>
          </Suspense>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {waiting ? t('multiplayer.oddOrEven.waitingOpponent') : t('multiplayer.oddOrEven.instructions')}
          </p>

          {quality === 'fallback2d' ? (
            <NumberTokenPicker value={playerNumber} onChange={setPlayerNumber} disabled={waiting || matchOver} />
          ) : (
            <div className="relative -mx-4 aspect-[4/3] w-[calc(100%+2rem)] overflow-hidden rounded-2xl bg-muted sm:mx-0 sm:aspect-auto sm:h-72 sm:w-full">
              <Suspense fallback={null}>
                <GameCanvas theme={theme} quality={quality} bloom={false}>
                  <NumberDrum
                    mode={
                      waiting || matchOver
                        ? { kind: 'settled', value: playerNumber }
                        : { kind: 'interactive', value: playerNumber, onChange: setPlayerNumber }
                    }
                    material={getThemeMaterial(theme)}
                    position={[0, 0, 0]}
                  />
                </GameCanvas>
              </Suspense>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {PARITIES.map(parity => (
              <Button
                key={parity}
                type="button"
                variant={prediction === parity ? 'default' : 'outline'}
                onClick={() => setPrediction(parity)}
                disabled={waiting || matchOver}
              >
                {parity === 'pair' ? t('solo.oddOrEven.even') : t('solo.oddOrEven.odd')}
              </Button>
            ))}
          </div>

          <Button type="button" onClick={playRound} disabled={waiting || matchOver}>
            {t('solo.oddOrEven.playButton')}
          </Button>
        </div>
      )}

      <MatchEndOverlay winner={winner} onReplay={handleReplay} opponentLabel={opponent?.name ?? t('multiplayer.common.opponentFallback')} />
    </div>
  );
}
