import { useEffect, useMemo, useState } from 'react';
import type { GameMode } from '../types/game';
import type { Socket } from 'socket.io-client';
import { EVENTS } from '../events';
import { wouldYouRatherPrompts } from '../data/gamePrompts';

type WouldYouRatherGameProps = {
  mode: GameMode;
  onScore: (player: 'player1' | 'player2') => void;
  gameEnded: boolean;
  socket: Socket | null;
  socketId: string | null;
  roomId: string | null;
};

export function WouldYouRatherGame({ mode, onScore, gameEnded }: WouldYouRatherGameProps) {
  const [currentPrompt, setCurrentPrompt] = useState<{ left: string; right: string } | null>(null);
  const [choice, setChoice] = useState<'left' | 'right' | null>(null);
  const [status, setStatus] = useState('Cliquez pour obtenir un dilemme.');

  const activePlayer = useMemo(() => (mode === 'multi' ? 'Joueur 1' : 'Vous'), [mode]);

  const handleNext = () => {
    if (gameEnded) {
      return;
    }

    const prompt = wouldYouRatherPrompts[Math.floor(Math.random() * wouldYouRatherPrompts.length)];
    setCurrentPrompt(prompt);
    setChoice(null);
    setStatus(`Dilemme pour ${activePlayer} :`);
  };

  const handleChoose = (selected: 'left' | 'right') => {
    if (!currentPrompt || gameEnded) {
      return;
    }
    setChoice(selected);
    setStatus(`${activePlayer} a choisi ${currentPrompt[selected]}.`);
    onScore(selected === 'left' ? 'player1' : 'player2');
  };

  return (
    <section style={{ padding: 16, borderRadius: 14, border: '1px solid #d1d5db', background: '#ffffff' }}>
      <h3>Tu Préfères ?</h3>
      <p>{status}</p>
      {currentPrompt ? (
        <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          <button
            type="button"
            onClick={() => handleChoose('left')}
            disabled={gameEnded || !!choice}
            style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #d1d5db', background: '#f8fafc', cursor: gameEnded || !!choice ? 'not-allowed' : 'pointer' }}
          >
            {currentPrompt.left}
          </button>
          <button
            type="button"
            onClick={() => handleChoose('right')}
            disabled={gameEnded || !!choice}
            style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #d1d5db', background: '#f8fafc', cursor: gameEnded || !!choice ? 'not-allowed' : 'pointer' }}
          >
            {currentPrompt.right}
          </button>
        </div>
      ) : null}
      <button
        type="button"
        onClick={handleNext}
        disabled={gameEnded}
        style={{ marginTop: 12, padding: '12px 16px', borderRadius: 10, border: 'none', background: '#2563eb', color: 'white', cursor: gameEnded ? 'not-allowed' : 'pointer' }}
      >
        Prochain dilemme
      </button>
    </section>
  );
}
