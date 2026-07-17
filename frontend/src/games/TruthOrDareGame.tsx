import { useEffect, useMemo, useState } from 'react';
import type { GameMode } from '../types/game';
import type { Socket } from 'socket.io-client';
import { EVENTS } from '../events';
import { truthOrDarePrompts } from '../data/gamePrompts';

type TruthOrDareGameProps = {
  mode: GameMode;
  onScore: (player: 'player1' | 'player2') => void;
  gameEnded: boolean;
  socket: Socket | null;
  socketId: string | null;
  roomId: string | null;
};

export function TruthOrDareGame({ mode, onScore, gameEnded, socket, socketId, roomId }: TruthOrDareGameProps) {
  const [currentPrompt, setCurrentPrompt] = useState<{ truth: string; dare: string } | null>(null);
  const [status, setStatus] = useState('Cliquez pour faire tourner la roue et obtenir un défi.');

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleUpdate = (data: { prompt: { truth: string; dare: string }; activePlayer: string }) => {
      setCurrentPrompt(data.prompt);
      setStatus(`${data.activePlayer} doit choisir action ou vérité.`);
    };

    const handleResult = (data: { socketId: string; message: string; score: number }) => {
      setStatus(data.message);
      if (data.score > 0) {
        if (data.socketId === socketId) {
          onScore('player1');
        } else {
          onScore('player2');
        }
      }
    };

    socket.on(EVENTS.TRUTH_OR_DARE_UPDATE, handleUpdate);
    socket.on(EVENTS.TRUTH_OR_DARE_RESULT, handleResult);

    return () => {
      socket.off(EVENTS.TRUTH_OR_DARE_UPDATE, handleUpdate);
      socket.off(EVENTS.TRUTH_OR_DARE_RESULT, handleResult);
    };
  }, [socket, socketId, onScore]);

  const nextPlayer = useMemo(() => {
    return mode === 'multi' ? `Joueur ${Math.floor(Math.random() * 2) + 1}` : 'Vous';
  }, [mode]);

  const handleSpin = () => {
    if (gameEnded) {
      return;
    }

    const prompt = truthOrDarePrompts[Math.floor(Math.random() * truthOrDarePrompts.length)];
    setCurrentPrompt(prompt);
    setStatus(`Le joueur choisi est ${nextPlayer}. Choisissez action ou vérité.`);
  };

  const handleValidate = (type: 'action' | 'truth') => {
    if (!currentPrompt) {
      setStatus('Commencez par tourner la roue.');
      return;
    }

    if (type === 'action') {
      setStatus(`Action : ${currentPrompt.dare}`);
      onScore('player1');
    } else {
      setStatus(`Vérité : ${currentPrompt.truth}`);
      onScore('player2');
    }
  };

  return (
    <section style={{ padding: 16, borderRadius: 14, border: '1px solid #d1d5db', background: '#ffffff' }}>
      <h3>Action ou Vérité</h3>
      <p>{status}</p>
      <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        <button
          type="button"
          onClick={handleSpin}
          disabled={gameEnded}
          style={{ padding: '12px 16px', borderRadius: 10, border: 'none', background: '#2563eb', color: 'white', cursor: gameEnded ? 'not-allowed' : 'pointer' }}
        >
          Tourner la roue
        </button>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => handleValidate('action')}
            disabled={gameEnded || !currentPrompt}
            style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #d1d5db', background: '#f8fafc', cursor: gameEnded || !currentPrompt ? 'not-allowed' : 'pointer' }}
          >
            Action
          </button>
          <button
            type="button"
            onClick={() => handleValidate('truth')}
            disabled={gameEnded || !currentPrompt}
            style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #d1d5db', background: '#f8fafc', cursor: gameEnded || !currentPrompt ? 'not-allowed' : 'pointer' }}
          >
            Vérité
          </button>
        </div>
      </div>
    </section>
  );
}
