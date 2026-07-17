import { useEffect, useState } from 'react';
import type { GameMode } from '../types/game';
import type { Socket } from 'socket.io-client';
import { EVENTS } from '../events';

type TwoTruthsOneLieGameProps = {
  mode: GameMode;
  onScore: (player: 'player1' | 'player2') => void;
  gameEnded: boolean;
  socket: Socket | null;
  socketId: string | null;
  roomId: string | null;
};

const initialStatements = ['','',''];

export function TwoTruthsOneLieGame({ mode, onScore, gameEnded }: TwoTruthsOneLieGameProps) {
  const [statements, setStatements] = useState<string[]>(initialStatements);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('Le joueur désigné doit saisir 2 vérités et 1 mensonge.');
  const [vote, setVote] = useState<number | null>(null);

  const handleChange = (index: number, value: string) => {
    setStatements(prev => prev.map((item, idx) => (idx === index ? value : item)));
  };

  const handleSubmit = () => {
    if (gameEnded || statements.some(s => !s.trim())) {
      setMessage('Merci de remplir les trois phrases avant de soumettre.');
      return;
    }
    setSubmitted(true);
    setMessage('Les autres joueurs votent maintenant pour le mensonge.');
  };

  const handleVote = (index: number) => {
    if (!submitted || gameEnded) {
      return;
    }
    setVote(index);
    setMessage(`Vous avez voté pour la phrase ${index + 1}.`);
    onScore('player1');
  };

  return (
    <section style={{ padding: 16, borderRadius: 14, border: '1px solid #d1d5db', background: '#ffffff' }}>
      <h3>2 Vérités, 1 Mensonge</h3>
      <p>{message}</p>
      {!submitted ? (
        <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          {statements.map((statement, index) => (
            <input
              key={index}
              type="text"
              value={statement}
              onChange={e => handleChange(index, e.target.value)}
              disabled={gameEnded}
              placeholder={`Phrase ${index + 1}`}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #d1d5db' }}
            />
          ))}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={gameEnded}
            style={{ padding: '12px 16px', borderRadius: 10, border: 'none', background: '#2563eb', color: 'white', cursor: gameEnded ? 'not-allowed' : 'pointer' }}
          >
            Soumettre
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          {statements.map((statement, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleVote(index)}
              disabled={gameEnded || vote !== null}
              style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #d1d5db', background: '#f8fafc', cursor: gameEnded || vote !== null ? 'not-allowed' : 'pointer' }}
            >
              {statement}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
