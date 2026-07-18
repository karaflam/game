import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/store/useGameStore';
import { ClientEvents, ServerEvents } from '@/lib/socketEvents';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { FlipReveal } from '@/components/solo/reveals/FlipReveal';
import { NumberTokenPicker } from '@/components/solo/NumberTokenPicker';
import type { Winner } from '@/lib/soloScore';

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
  winnerId: string | null;
};

export function OddOrEvenMultiplayer() {
  const { socket, socketId } = useSocket();
  const players = useGameStore(state => state.players);
  const setStoreScores = useGameStore(state => state.setScores);
  const [playerNumber, setPlayerNumber] = useState(1);
  const [prediction, setPrediction] = useState<Parity>('pair');
  const [waiting, setWaiting] = useState(false);
  const [round, setRound] = useState<RoundResult | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [matchOver, setMatchOver] = useState(false);
  const [winner, setWinner] = useState<Winner>(null);

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
      setRound(null);
      setWaiting(false);
    };

    socket.on(ServerEvents.OddOrEvenResult, handleResult);
    socket.on(ServerEvents.ScoreReset, handleScoreReset);

    return () => {
      socket.off(ServerEvents.OddOrEvenResult, handleResult);
      socket.off(ServerEvents.ScoreReset, handleScoreReset);
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
        targetScore={ODD_OR_EVEN_TARGET_SCORE}
        onReset={handleReplay}
        playerLabel={`${me?.name ?? 'Vous'} (vous)`}
        machineLabel={opponent?.name ?? 'Adversaire'}
      />

      {round ? (
        <FlipReveal
          cards={[
            { id: 'player', content: round.yourValue, highlight: round.outcome === 'player' },
            { id: 'opponent', content: round.opponentValue, highlight: round.outcome === 'machine' || round.bothCorrect }
          ]}
          outcomeLabel={
            round.bothCorrect
              ? `Somme ${round.sum} (${round.parity}) — vous avez tous les deux raison, +1 chacun !`
              : `Somme ${round.sum} (${round.parity})`
          }
          onComplete={handleRevealComplete}
        />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {waiting ? 'Choix envoyé, en attente de l’adversaire...' : 'Choisissez un chiffre de 1 à 9 et prédisez la parité de la somme.'}
          </p>

          <NumberTokenPicker value={playerNumber} onChange={setPlayerNumber} disabled={waiting || matchOver} />

          <div className="flex gap-3">
            {PARITIES.map(parity => (
              <Button
                key={parity}
                type="button"
                variant={prediction === parity ? 'default' : 'outline'}
                onClick={() => setPrediction(parity)}
                disabled={waiting || matchOver}
              >
                {parity === 'pair' ? 'Pair' : 'Impair'}
              </Button>
            ))}
          </div>

          <Button type="button" onClick={playRound} disabled={waiting || matchOver}>
            Jouer la manche
          </Button>
        </div>
      )}

      <MatchEndOverlay winner={winner} onReplay={handleReplay} opponentLabel={opponent?.name ?? 'Adversaire'} />
    </div>
  );
}
