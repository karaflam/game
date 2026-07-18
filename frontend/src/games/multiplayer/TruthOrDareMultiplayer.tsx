import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/store/useGameStore';
import { ClientEvents, ServerEvents } from '@/lib/socketEvents';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { PlayerWheel } from '@/components/solo/PlayerWheel';
import { BurstReveal } from '@/components/solo/reveals/BurstReveal';
import type { Winner } from '@/lib/soloScore';

const TARGET_SCORE = 5;

type Phase = 'idle' | 'spinning' | 'choosing' | 'content' | 'result';
type ContentType = 'action' | 'truth';

export function TruthOrDareMultiplayer() {
  const { socket, socketId } = useSocket();
  const players = useGameStore(state => state.players);
  const setStoreScores = useGameStore(state => state.setScores);
  const [phase, setPhase] = useState<Phase>('idle');
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [activePlayerName, setActivePlayerName] = useState<string | null>(null);
  const [content, setContent] = useState<{ type: ContentType; text: string } | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [answerDraft, setAnswerDraft] = useState('');
  const [resultApproved, setResultApproved] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>(() => useGameStore.getState().scores);
  const [matchOver, setMatchOver] = useState(false);
  const [winner, setWinner] = useState<Winner>(null);

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

    const handleContent = (data: { type: ContentType; text: string }) => {
      setContent(data);
      setPhase('content');
    };

    const handleAnswerSubmitted = (data: { answer: string }) => {
      setAnswer(data.answer);
    };

    const handleResult = (data: { approved: boolean; scores: Record<string, number>; matchOver: boolean; winnerId: string | null }) => {
      setResultApproved(data.approved);
      setScores(data.scores);
      setStoreScores(data.scores);
      setMatchOver(data.matchOver);
      setWinner(data.winnerId ? (data.winnerId === socketId ? 'player' : 'machine') : null);
      setPhase('result');
    };

    const handleScoreReset = (data: { scores: Record<string, number> }) => {
      setScores(data.scores);
      setStoreScores(data.scores);
      setMatchOver(false);
      setWinner(null);
      setPhase('idle');
      setActivePlayerId(null);
      setActivePlayerName(null);
      setContent(null);
      setAnswer(null);
      setAnswerDraft('');
    };

    const handleState = (data: {
      activePlayerId: string;
      activePlayerName: string;
      type: ContentType | null;
      text: string | null;
      answer: string | null;
    }) => {
      setActivePlayerId(data.activePlayerId);
      setActivePlayerName(data.activePlayerName);
      if (data.type) {
        setContent({ type: data.type, text: data.text ?? '' });
        setAnswer(data.answer);
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
    socket.on(ServerEvents.TruthOrDareState, handleState);

    // If we reconnect mid-manche (wheel already landed, or a choice/answer already made),
    // resync straight into that phase instead of showing the "spin the wheel" screen again.
    socket.emit(ClientEvents.TruthOrDareRequestState);

    return () => {
      socket.off(ServerEvents.TruthOrDareSpin, handleSpin);
      socket.off(ServerEvents.TruthOrDareContent, handleContent);
      socket.off(ServerEvents.TruthOrDareAnswerSubmitted, handleAnswerSubmitted);
      socket.off(ServerEvents.TruthOrDareResult, handleResult);
      socket.off(ServerEvents.ScoreReset, handleScoreReset);
      socket.off(ServerEvents.TruthOrDareState, handleState);
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
  };

  const handleReplay = () => {
    if (!socket) {
      return;
    }
    socket.emit(ClientEvents.ResetMatchScore);
  };

  const needsWrittenAnswer = content?.type === 'truth' && !answer;
  const readyToValidate = content && (content.type === 'action' || answer);

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

      {phase === 'idle' ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Faites tourner la roue pour désigner qui doit relever le défi.</p>
          <Button type="button" onClick={startSpin} disabled={matchOver}>
            Tourner la roue
          </Button>
        </div>
      ) : null}

      {(phase === 'spinning' || (phase === 'choosing' && activePlayerName)) ? (
        <PlayerWheel
          players={players.map(player => player.name)}
          landedOn={activePlayerName ?? ''}
          spinning={phase === 'spinning'}
          onSpinComplete={handleSpinComplete}
        />
      ) : null}

      {phase === 'choosing' ? (
        isActive ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">À vous de choisir : Action ou Vérité ?</p>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => chooseType('truth')}>
                Vérité
              </Button>
              <Button type="button" variant="outline" onClick={() => chooseType('action')}>
                Action
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">En attente du choix de {activePlayerName}...</p>
        )
      ) : null}

      {phase === 'content' && content ? (
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-primary bg-card p-4 text-sm font-medium text-foreground">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {content.type === 'truth' ? 'Vérité' : 'Action'}
            </span>
            {content.text}
          </div>

          {needsWrittenAnswer ? (
            isActive ? (
              <div className="space-y-3">
                <textarea
                  value={answerDraft}
                  onChange={event => setAnswerDraft(event.target.value)}
                  placeholder="Écrivez votre réponse..."
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  rows={3}
                />
                <Button type="button" onClick={submitAnswer} disabled={!answerDraft.trim()}>
                  Envoyer la réponse
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">En attente de la réponse écrite de {activePlayerName}...</p>
            )
          ) : null}

          {answer ? (
            <div className="rounded-2xl border border-border bg-muted p-4 text-sm text-foreground">
              <strong>Réponse :</strong> {answer}
            </div>
          ) : null}

          {readyToValidate ? (
            isActive ? (
              <p className="text-sm text-muted-foreground">En attente de la validation de {opponent?.name ?? 'l’adversaire'}...</p>
            ) : (
              <div className="flex gap-3">
                <Button type="button" onClick={() => validate(true)}>
                  Valider
                </Button>
                <Button type="button" variant="outline" onClick={() => validate(false)}>
                  Refuser
                </Button>
              </div>
            )
          ) : null}
        </div>
      ) : null}

      {phase === 'result' ? (
        <BurstReveal
          icon={resultApproved ? 'success' : 'fail'}
          headline={
            isActive
              ? resultApproved
                ? 'Validé ! +1 point.'
                : 'Refusé, 0 point.'
              : resultApproved
                ? `${activePlayerName} gagne 1 point.`
                : `${activePlayerName} ne gagne pas de point.`
          }
          onComplete={handleResultRevealComplete}
        />
      ) : null}

      <MatchEndOverlay winner={winner} onReplay={handleReplay} opponentLabel={opponent?.name ?? 'Adversaire'} />
    </div>
  );
}
