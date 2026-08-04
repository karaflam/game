import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/store/useGameStore';
import { ClientEvents, ServerEvents } from '@/lib/socketEvents';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { PlayerWheel } from '@/components/solo/PlayerWheel';
import { BurstReveal } from '@/components/solo/reveals/BurstReveal';
import type { Winner } from '@/lib/soloScore';
import { soloTruthOrDarePrompts } from '@/data/soloPrompts';
import { getThemeMaterial } from '@/three/themeMaterials';
import { useAdaptiveQuality } from '@/three/useAdaptiveQuality';
import useTheme from '@/hooks/useTheme';

const GameCanvas = lazy(() => import('@/three/GameCanvas').then(m => ({ default: m.GameCanvas })));
const BadgeBurstScene = lazy(() => import('@/three/scenes/BadgeBurstScene').then(m => ({ default: m.BadgeBurstScene })));
const PlayerWheelScene = lazy(() => import('@/three/scenes/PlayerWheelScene').then(m => ({ default: m.PlayerWheelScene })));

const TARGET_SCORE = 5;

type Phase = 'idle' | 'spinning' | 'choosing' | 'content' | 'result';
type ContentType = 'action' | 'truth';

export function TruthOrDareMultiplayer() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const quality = useAdaptiveQuality();
  const { socket, socketId } = useSocket();
  const players = useGameStore(state => state.players);
  const scores = useGameStore(state => state.scores);
  const setStoreScores = useGameStore(state => state.setScores);
  const prompts = soloTruthOrDarePrompts[i18n.language === 'en' ? 'en' : 'fr'];
  const [phase, setPhase] = useState<Phase>('idle');
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [activePlayerName, setActivePlayerName] = useState<string | null>(null);
  const [content, setContent] = useState<{ type: ContentType; promptIndex: number } | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [answerDraft, setAnswerDraft] = useState('');
  const [resultApproved, setResultApproved] = useState(false);
  const [matchOver, setMatchOver] = useState(false);
  const [winner, setWinner] = useState<Winner>(null);
  // Set only once the result reveal's onComplete fires (handleResultRevealComplete), not
  // on receipt of the result: MatchEndOverlay renders as an absolute inset-0 overlay in
  // the same container as the reveal, so committing this immediately would cover the
  // last round's reveal animation before the player ever sees it finish.
  const pendingMatchEndRef = useRef<{ matchOver: boolean; winner: Winner } | null>(null);

  useEffect(() => {
    if (!socket || !socketId) {
      return;
    }

    const handleSpin = (data: { activePlayerId: string; activePlayerName: string }) => {
      setActivePlayerId(data.activePlayerId);
      setActivePlayerName(data.activePlayerName);
      setContent(null);
      setAnswer(null);
      setAnswerDraft('');
      setPhase('spinning');
    };

    const handleContent = (data: { type: ContentType; promptIndex: number }) => {
      setContent(data);
      setPhase('content');
    };

    const handleAnswerSubmitted = (data: { answer: string }) => {
      setAnswer(data.answer);
    };

    const handleResult = (data: { approved: boolean; scores: Record<string, number>; matchOver: boolean; winnerId: string | null }) => {
      setResultApproved(data.approved);
      setStoreScores(data.scores);
      pendingMatchEndRef.current = {
        matchOver: data.matchOver,
        winner: data.winnerId ? (data.winnerId === socketId ? 'player' : 'machine') : null
      };
      setPhase('result');
    };

    const handleScoreReset = (data: { scores: Record<string, number> }) => {
      setStoreScores(data.scores);
      pendingMatchEndRef.current = null;
      setMatchOver(false);
      setWinner(null);
      setPhase('idle');
      setActivePlayerId(null);
      setActivePlayerName(null);
      setContent(null);
      setAnswer(null);
      setAnswerDraft('');
    };

    const handleGameState = (data: {
      gameId: string;
      state: {
        activePlayerId: string;
        activePlayerName: string;
        type: ContentType | null;
        promptIndex: number | null;
        answer: string | null;
      };
    }) => {
      if (data.gameId !== 'truth-or-dare') {
        return;
      }
      setActivePlayerId(data.state.activePlayerId);
      setActivePlayerName(data.state.activePlayerName);
      if (data.state.type && data.state.promptIndex !== null) {
        setContent({ type: data.state.type, promptIndex: data.state.promptIndex });
        setAnswer(data.state.answer);
        setPhase('content');
      } else {
        setContent(null);
        setAnswer(null);
        setPhase('choosing');
      }
    };

    socket.on(ServerEvents.TruthOrDareSpin, handleSpin);
    socket.on(ServerEvents.TruthOrDareContent, handleContent);
    socket.on(ServerEvents.TruthOrDareAnswerSubmitted, handleAnswerSubmitted);
    socket.on(ServerEvents.TruthOrDareResult, handleResult);
    socket.on(ServerEvents.ScoreReset, handleScoreReset);
    socket.on(ServerEvents.GameState, handleGameState);

    // If we (re)connect mid-manche (wheel already landed, or a choice/answer already made),
    // resync straight into that phase instead of showing the "spin the wheel" screen again.
    socket.emit(ClientEvents.RequestGameState);

    return () => {
      socket.off(ServerEvents.TruthOrDareSpin, handleSpin);
      socket.off(ServerEvents.TruthOrDareContent, handleContent);
      socket.off(ServerEvents.TruthOrDareAnswerSubmitted, handleAnswerSubmitted);
      socket.off(ServerEvents.TruthOrDareResult, handleResult);
      socket.off(ServerEvents.ScoreReset, handleScoreReset);
      socket.off(ServerEvents.GameState, handleGameState);
    };
  }, [socket, socketId, setStoreScores]);

  const me = players.find(player => player.id === socketId) ?? null;
  const opponent = players.find(player => player.id !== socketId) ?? null;
  const myScore = socketId ? scores[socketId] ?? 0 : 0;
  const opponentScore = opponent ? scores[opponent.id] ?? 0 : 0;
  const isActive = socketId !== null && socketId === activePlayerId;

  const startSpin = () => {
    if (!socket || matchOver || phase !== 'idle') {
      return;
    }
    socket.emit(ClientEvents.TruthOrDareStart);
  };

  const handleSpinComplete = () => {
    setPhase('choosing');
  };

  const chooseType = (type: ContentType) => {
    if (!socket || !isActive) {
      return;
    }
    socket.emit(ClientEvents.TruthOrDareChoice, { type });
  };

  const submitAnswer = () => {
    if (!socket || !isActive || !answerDraft.trim()) {
      return;
    }
    socket.emit(ClientEvents.TruthOrDareAnswer, { answer: answerDraft.trim() });
  };

  const validate = (approved: boolean) => {
    if (!socket || isActive) {
      return;
    }
    socket.emit(ClientEvents.TruthOrDareValidate, { approved });
  };

  const handleResultRevealComplete = () => {
    setPhase('idle');
    setActivePlayerId(null);
    setActivePlayerName(null);
    setContent(null);
    setAnswer(null);
    setAnswerDraft('');
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

  const contentText = content ? (content.type === 'truth' ? prompts[content.promptIndex].truth : prompts[content.promptIndex].dare) : null;
  const needsWrittenAnswer = content?.type === 'truth' && !answer;
  const readyToValidate = content && (content.type === 'action' || answer);

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

      {phase === 'idle' ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('multiplayer.truthOrDare.spinInstruction')}</p>
          <Button type="button" onClick={startSpin} disabled={matchOver}>
            {t('multiplayer.truthOrDare.spinButton')}
          </Button>
        </div>
      ) : null}

      {(phase === 'spinning' || (phase === 'choosing' && activePlayerName)) && quality === 'fallback2d' ? (
        <PlayerWheel
          players={players.map(player => player.name)}
          landedOn={activePlayerName ?? ''}
          spinning={phase === 'spinning'}
          onSpinComplete={handleSpinComplete}
        />
      ) : phase === 'spinning' || (phase === 'choosing' && activePlayerName) ? (
        <div className="relative -mx-4 aspect-square w-[calc(100%+2rem)] overflow-hidden rounded-2xl bg-muted sm:mx-0 sm:aspect-auto sm:h-[24rem] sm:w-full">
          <Suspense fallback={null}>
            <GameCanvas theme={theme} quality={quality}>
              <PlayerWheelScene
                players={players.map(player => player.name)}
                landedOn={activePlayerName ?? ''}
                spinning={phase === 'spinning'}
                onSpinComplete={handleSpinComplete}
                material={getThemeMaterial(theme)}
              />
            </GameCanvas>
          </Suspense>
        </div>
      ) : null}

      {phase === 'choosing' ? (
        isActive ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">{t('multiplayer.truthOrDare.promptSelf')}</p>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={() => chooseType('truth')}>
                {t('multiplayer.truthOrDare.truthButton')}
              </Button>
              <Button type="button" variant="outline" onClick={() => chooseType('action')}>
                {t('multiplayer.truthOrDare.dareButton')}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('multiplayer.truthOrDare.waitingChoice', { name: activePlayerName })}</p>
        )
      ) : null}

      {phase === 'content' && content ? (
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-primary bg-card p-4 text-sm font-medium text-foreground">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {content.type === 'truth' ? t('multiplayer.truthOrDare.contentTruth') : t('multiplayer.truthOrDare.contentDare')}
            </span>
            {contentText}
          </div>

          {needsWrittenAnswer ? (
            isActive ? (
              <div className="space-y-3">
                <textarea
                  value={answerDraft}
                  onChange={event => setAnswerDraft(event.target.value)}
                  placeholder={t('multiplayer.truthOrDare.answerPlaceholder')}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  rows={3}
                />
                <Button type="button" onClick={submitAnswer} disabled={!answerDraft.trim()}>
                  {t('multiplayer.truthOrDare.sendAnswerButton')}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('multiplayer.truthOrDare.waitingWrittenAnswer', { name: activePlayerName })}</p>
            )
          ) : null}

          {answer ? (
            <div className="rounded-2xl border border-border bg-muted p-4 text-sm text-foreground">
              <strong>{t('multiplayer.truthOrDare.answerLabel')}</strong> {answer}
            </div>
          ) : null}

          {readyToValidate ? (
            isActive ? (
              <p className="text-sm text-muted-foreground">
                {t('multiplayer.truthOrDare.waitingValidation', { name: opponent?.name ?? t('multiplayer.common.opponentFallbackAlt') })}
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                <Button type="button" onClick={() => validate(true)}>
                  {t('multiplayer.truthOrDare.validateButton')}
                </Button>
                <Button type="button" variant="outline" onClick={() => validate(false)}>
                  {t('multiplayer.truthOrDare.refuseButton')}
                </Button>
              </div>
            )
          ) : null}
        </div>
      ) : null}

      {phase === 'result' && quality === 'fallback2d' ? (
        <BurstReveal
          icon={resultApproved ? 'success' : 'fail'}
          headline={
            isActive
              ? resultApproved
                ? t('multiplayer.truthOrDare.resultValidated')
                : t('multiplayer.truthOrDare.resultRefused')
              : resultApproved
                ? t('multiplayer.truthOrDare.resultOpponentGains', { name: activePlayerName })
                : t('multiplayer.truthOrDare.resultOpponentNoGain', { name: activePlayerName })
          }
          onComplete={handleResultRevealComplete}
        />
      ) : phase === 'result' ? (
        <div
          role="button"
          tabIndex={0}
          onClick={handleResultRevealComplete}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              handleResultRevealComplete();
            }
          }}
          className="relative -mx-4 aspect-square w-[calc(100%+2rem)] cursor-pointer overflow-hidden rounded-2xl bg-muted sm:mx-0 sm:aspect-auto sm:h-[26rem] sm:w-full"
        >
          <Suspense fallback={null}>
            <GameCanvas theme={theme} quality={quality}>
              <BadgeBurstScene
                variant={resultApproved ? 'success' : 'fail'}
                material={getThemeMaterial(theme)}
                headline={
                  isActive
                    ? resultApproved
                      ? t('multiplayer.truthOrDare.resultValidated')
                      : t('multiplayer.truthOrDare.resultRefused')
                    : resultApproved
                      ? t('multiplayer.truthOrDare.resultOpponentGains', { name: activePlayerName })
                      : t('multiplayer.truthOrDare.resultOpponentNoGain', { name: activePlayerName })
                }
              />
            </GameCanvas>
          </Suspense>
          <p className="absolute inset-x-0 bottom-4 text-center text-xs text-muted-foreground">{t('solo.reveals.continueHint')}</p>
        </div>
      ) : null}

      <MatchEndOverlay winner={winner} onReplay={handleReplay} opponentLabel={opponent?.name ?? t('multiplayer.common.opponentFallback')} />
    </div>
  );
}
