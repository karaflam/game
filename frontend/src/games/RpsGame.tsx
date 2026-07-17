import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { GameMode } from '../types/game';
import { EVENTS } from '../events';

const moves = ['pierre', 'feuille', 'ciseau'] as const;

type Move = (typeof moves)[number];

type RpsGameProps = {
  mode: GameMode;
  onScore: (player: 'player1' | 'player2') => void;
  gameEnded: boolean;
  socket: Socket | null;
  socketId: string | null;
  roomId: string | null;
};

function getRoundResult(choice: Move, opponent: Move) {
  if (choice === opponent) {
    return 'Égalité';
  }

  const winMap: Record<Move, Move> = {
    pierre: 'ciseau',
    feuille: 'pierre',
    ciseau: 'feuille'
  };

  return winMap[choice] === opponent ? 'Gagné' : 'Perdu';
}

function getRandomMove(): Move {
  return moves[Math.floor(Math.random() * moves.length)];
}

export function RpsGame({ mode, onScore, gameEnded, socket, socketId, roomId }: RpsGameProps) {
  const [currentChoice, setCurrentChoice] = useState<Move | null>(null);
  const [roundMessage, setRoundMessage] = useState('Choisissez pierre, feuille ou ciseau.');

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleResult = (data: { socketId: string; message: string; score: number }) => {
      setRoundMessage(data.message);
      if (data.socketId === socketId) {
        if (data.score > 0) {
          onScore('player1');
        }
      } else if (data.score > 0) {
        onScore('player2');
      }
    };

    socket.on(EVENTS.RPS_RESULT, handleResult);
    return () => {
      socket.off(EVENTS.RPS_RESULT, handleResult);
    };
  }, [socket, socketId, onScore]);

  const playRound = (choice: Move) => {
    if (gameEnded) {
      return;
    }

    setCurrentChoice(choice);

    if (mode === 'multi') {
      if (!socket || !roomId) {
        setRoundMessage('Rejoignez une salle multijoueur pour jouer en ligne.');
        return;
      }

      socket.emit(EVENTS.RPS_PLAY, { choice });
      setRoundMessage('Choix envoyé. En attente du second joueur...');
      return;
    }

    const opponent = getRandomMove();
    const result = getRoundResult(choice, opponent);
    setRoundMessage(`Vous avez choisi ${choice}, l’adversaire a choisi ${opponent}. ${result}.`);

    if (result === 'Gagné') {
      onScore('player1');
    } else if (result === 'Perdu') {
      onScore('player2');
    }
  };

  return (
    <section style={{ padding: 16, borderRadius: 14, border: '1px solid #d1d5db', background: '#ffffff' }}>
      <h3>Pierre, Feuille, Ciseau</h3>
      <p>{roundMessage}</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
        {moves.map(move => (
          <button
            key={move}
            type="button"
            onClick={() => playRound(move)}
            disabled={gameEnded}
            style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #d1d5db', background: '#f8fafc', cursor: gameEnded ? 'not-allowed' : 'pointer' }}
          >
            {move}
          </button>
        ))}
      </div>
    </section>
  );
}
