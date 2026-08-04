import { lazy, Suspense, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useGLTF } from '@react-three/drei';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { DuelReveal } from '@/components/solo/reveals/DuelReveal';
import { getThemeMaterial } from '@/three/themeMaterials';
import { useAdaptiveQuality } from '@/three/useAdaptiveQuality';
import { OPEN_HAND_URL, FIST_URL, PEACE_SIGN_URL } from '@/three/scenes/LowPolyHand';
import useTheme from '@/hooks/useTheme';
import { useSoloScore } from '@/hooks/useSoloScore';
import { RPS_MOVES, getRpsOutcome, pickRandomRpsMove, type RpsMove } from '@/lib/rpsLogic';

const GameCanvas = lazy(() => import('@/three/GameCanvas').then(m => ({ default: m.GameCanvas })));
const HandDuelScene = lazy(() =>
  import('@/three/scenes/HandDuelScene').then(m => ({ default: m.HandDuelScene }))
);

const RPS_TARGET_SCORE = 5;

const moveEmojis: Record<RpsMove, string> = {
  pierre: '✊',
  feuille: '✋',
  ciseau: '✌️'
};

type RoundData = { player: RpsMove; machine: RpsMove; outcome: 'player' | 'machine' | 'draw' };

export function RpsSolo() {
  const { t } = useTranslation();
  const moveLabels: Record<RpsMove, string> = {
    pierre: t('solo.rps.moves.pierre'),
    feuille: t('solo.rps.moves.feuille'),
    ciseau: t('solo.rps.moves.ciseau')
  };
  const { score, winner, isMatchOver, recordRound, reset } = useSoloScore(RPS_TARGET_SCORE);
  const { theme } = useTheme();
  const quality = useAdaptiveQuality();
  const [message, setMessage] = useState(t('solo.rps.instructions'));
  const [round, setRound] = useState<RoundData | null>(null);
  const [hasPlayed, setHasPlayed] = useState(false);

  useEffect(() => {
    if (!hasPlayed) {
      setMessage(t('solo.rps.instructions'));
    }
  }, [t, hasPlayed]);

  useEffect(() => {
    // Preload the hand models once the player has actually navigated to this
    // game, rather than at app boot (see LowPolyHand.tsx for the pose->asset map).
    useGLTF.preload(OPEN_HAND_URL);
    useGLTF.preload(FIST_URL);
    useGLTF.preload(PEACE_SIGN_URL);
  }, []);

  const playRound = (move: RpsMove) => {
    if (isMatchOver || round) {
      return;
    }

    const machineMove = pickRandomRpsMove();
    const outcome = getRpsOutcome(move, machineMove);
    setRound({ player: move, machine: machineMove, outcome });
  };

  const handleRevealComplete = () => {
    if (!round) {
      return;
    }

    if (round.outcome === 'draw') {
      setMessage(t('solo.rps.outcomeDraw', { playerMove: moveLabels[round.player] }));
    } else if (round.outcome === 'player') {
      setMessage(t('solo.rps.outcomeWin', { playerMove: moveLabels[round.player], machineMove: moveLabels[round.machine] }));
    } else {
      setMessage(t('solo.rps.outcomeLose', { playerMove: moveLabels[round.player], machineMove: moveLabels[round.machine] }));
    }

    recordRound(round.outcome);
    setRound(null);
    setHasPlayed(true);
  };

  return (
    <div className="relative isolate space-y-6 rounded-3xl border border-border bg-background p-4 sm:p-8">
      <ScorePill player={score.player} machine={score.machine} targetScore={RPS_TARGET_SCORE} onReset={reset} />

      {round && quality === 'fallback2d' ? (
        <DuelReveal
          playerEmoji={moveEmojis[round.player]}
          playerLabel={moveLabels[round.player]}
          machineEmoji={moveEmojis[round.machine]}
          machineLabel={moveLabels[round.machine]}
          outcome={round.outcome}
          onComplete={handleRevealComplete}
        />
      ) : round ? (
        <div className="relative -mx-4 aspect-square w-[calc(100%+2rem)] overflow-hidden rounded-2xl bg-muted sm:mx-0 sm:aspect-auto sm:h-[28rem] sm:w-full">
          <div className="absolute inset-0">
            <Suspense fallback={null}>
              <GameCanvas theme={theme} quality={quality}>
                <HandDuelScene round={round} material={getThemeMaterial(theme)} onComplete={handleRevealComplete} />
              </GameCanvas>
            </Suspense>
          </div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.4 }}
            className="absolute inset-x-0 bottom-4 text-center text-lg font-bold text-foreground"
          >
            {round.outcome === 'player'
              ? t('solo.rps.duelOutcomeWin')
              : round.outcome === 'machine'
                ? t('solo.rps.duelOutcomeLose')
                : t('solo.rps.duelOutcomeDraw')}
          </motion.p>
        </div>
      ) : (
        <>
          <motion.p key={message} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-muted-foreground">
            {message}
          </motion.p>

          <div className="grid gap-3 sm:grid-cols-3">
            {RPS_MOVES.map(move => (
              <button
                key={move}
                type="button"
                onClick={() => playRound(move)}
                disabled={isMatchOver}
                className="flex flex-col items-center gap-2 rounded-2xl border-2 border-border bg-card p-5 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                <span className="text-4xl">{moveEmojis[move]}</span>
                <span className="text-sm font-semibold text-foreground">{moveLabels[move]}</span>
              </button>
            ))}
          </div>
        </>
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

      <MatchEndOverlay winner={winner} onReplay={reset} />
    </div>
  );
}
