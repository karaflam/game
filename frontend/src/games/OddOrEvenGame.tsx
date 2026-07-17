import { useEffect, useState } from 'react';
import type { GameMode } from '../types/game';
import type { Socket } from 'socket.io-client';
import { EVENTS } from '../events';

const parities = ['pair', 'impair'] as const;

type OddOrEvenGameProps = {
  mode: GameMode;
  onScore: (player: 'player1' | 'player2') => void;
  gameEnded: boolean;
  socket: Socket | null;
  socketId: string | null;
  roomId: string | null;
};

function getRandomNumber() {
  return Math.floor(Math.random() * 9) + 1;
}

function getParity(value: number) {
  return value % 2 === 0 ? 'pair' : 'impair';
}

export function OddOrEvenGame({ mode, onScore, gameEnded, socket, socketId, roomId }: OddOrEvenGameProps) {
  const [playerNumber, setPlayerNumber] = useState(1);
  const [prediction, setPrediction] = useState<'pair' | 'impair'>('pair');
  const [message, setMessage] = useState('Sélectionnez un chiffre et prédit la somme.');

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleResult = (data: { socketId: string; message: string; score: number }) => {
      setMessage(data.message);
      if (data.socketId === socketId) {
        if (data.score > 0) {
          onScore('player1');
        }
      } else if (data.score > 0) {
        onScore('player2');
      }
    };

    socket.on(EVENTS.ODD_OR_EVEN_RESULT, handleResult);
    return () => {
      socket.off(EVENTS.ODD_OR_EVEN_RESULT, handleResult);
    };
  }, [socket, socketId, onScore]);

  const playRound = () => {
    if (gameEnded) {
      return;
    }

    if (mode === 'multi') {
      if (!socket || !roomId) {
        setMessage('Rejoignez une salle multijoueur pour jouer en ligne.');
        return;
      }

      socket.emit(EVENTS.ODD_OR_EVEN_PLAY, { value: playerNumber, prediction });
      setMessage('Choix envoyé. En attente du second joueur...');
      return;
    }

    const opponent = getRandomNumber();
    const sum = playerNumber + opponent;
    const actualParity = getParity(sum);
    const won = prediction === actualParity;

    setMessage(`Vous avez joué ${playerNumber}, l’adversaire a joué ${opponent}. Somme ${sum} (${actualParity}). ${won ? 'Vous gagnez !' : 'Vous perdez.'}`);

    if (won) {
      onScore('player1');
    } else {
      onScore('player2');
    }
  };

  return (
    <section style={{ padding: 16, borderRadius: 14, border: '1px solid #d1d5db', background: '#ffffff' }}>
      <h3>Pair ou Impair</h3>
      <p>{message}</p>
      <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        <label>
          Votre nombre (1–9):
          <input
            type="number"
            min={1}
            max={9}
            value={playerNumber}
            onChange={e => setPlayerNumber(Math.min(9, Math.max(1, Number(e.target.value))))}
            disabled={gameEnded}
            style={{ marginLeft: 10, width: 60, padding: '6px 8px', borderRadius: 8, border: '1px solid #d1d5db' }}
          />
        </label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {parities.map(choice => (
            <button
              key={choice}
              type="button"
              onClick={() => setPrediction(choice)}
              disabled={gameEnded}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: prediction === choice ? '2px solid #2563eb' : '1px solid #d1d5db',
                background: '#f8fafc',
                cursor: gameEnded ? 'not-allowed' : 'pointer'
              }}
            >
              {choice}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={playRound}
          disabled={gameEnded}
          style={{ padding: '12px 16px', borderRadius: 10, border: 'none', background: '#2563eb', color: 'white', cursor: gameEnded ? 'not-allowed' : 'pointer' }}
        >
          Jouer
        </button>
      </div>
    </section>
  );
}
