import { useEffect, useMemo, useState } from 'react';
import type { GameMode } from '../types/game';
import type { Socket } from 'socket.io-client';
import { EVENTS } from '../events';
import { twentyQuestionsWords } from '../data/gamePrompts';

type TwentyQuestionsGameProps = {
  mode: GameMode;
  onScore: (player: 'player1' | 'player2') => void;
  gameEnded: boolean;
  socket: Socket | null;
  socketId: string | null;
  roomId: string | null;
};

export function TwentyQuestionsGame({ mode, onScore, gameEnded }: TwentyQuestionsGameProps) {
  const [word, setWord] = useState<string>('');
  const [hint, setHint] = useState<string>('');
  const [guess, setGuess] = useState('');
  const [message, setMessage] = useState('Le joueur pense à un mot ou une expression.');
  const [attempts, setAttempts] = useState(0);
  const [selectedWord, setSelectedWord] = useState<{ answer: string; hints: string[] } | null>(null);

  const startGame = () => {
    if (gameEnded) {
      return;
    }
    const nextWord = twentyQuestionsWords[Math.floor(Math.random() * twentyQuestionsWords.length)];
    setSelectedWord(nextWord);
    setWord('');
    setHint(nextWord.hints[0]);
    setGuess('');
    setAttempts(0);
    setMessage('Devinez le mot en 20 essais.');
  };

  const handleGuess = () => {
    if (!selectedWord || gameEnded) {
      return;
    }

    const answer = selectedWord.answer.toLowerCase().trim();
    const guessValue = guess.toLowerCase().trim();

    if (!guessValue) {
      return;
    }

    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);

    if (guessValue === answer) {
      setMessage(`Bravo ! Le mot était ${answer}.`);
      onScore('player1');
      return;
    }

    if (nextAttempts >= 20) {
      setMessage(`Temps écoulé. Le mot était ${answer}.`);
      onScore('player2');
      return;
    }

    setHint(selectedWord.hints[nextAttempts % selectedWord.hints.length]);
    setMessage(`Non. Essaie ${nextAttempts}/20.`);
  };

  return (
    <section style={{ padding: 16, borderRadius: 14, border: '1px solid #d1d5db', background: '#ffffff' }}>
      <h3>20 Questions</h3>
      <p>{message}</p>
      <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        <div>
          <strong>Indice :</strong> {hint}
        </div>
        <input
          type="text"
          value={guess}
          onChange={e => setGuess(e.target.value)}
          disabled={gameEnded || !selectedWord}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #d1d5db' }}
        />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleGuess}
            disabled={gameEnded || !selectedWord}
            style={{ padding: '12px 16px', borderRadius: 10, border: 'none', background: '#2563eb', color: 'white', cursor: gameEnded || !selectedWord ? 'not-allowed' : 'pointer' }}
          >
            Valider la proposition
          </button>
          <button
            type="button"
            onClick={startGame}
            disabled={gameEnded}
            style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #d1d5db', background: '#f8fafc', cursor: gameEnded ? 'not-allowed' : 'pointer' }}
          >
            Démarrer une partie
          </button>
        </div>
      </div>
    </section>
  );
}
