import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { gameThemes } from '../data/gameThemes';
import { useGameStore } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import { ClientEvents } from '../lib/socketEvents';
import { clearActiveRoom } from '../lib/playerSession';
import { RpsMultiplayer } from '../games/multiplayer/RpsMultiplayer';
import { OddOrEvenMultiplayer } from '../games/multiplayer/OddOrEvenMultiplayer';
import { WouldYouRatherMultiplayer } from '../games/multiplayer/WouldYouRatherMultiplayer';
import { TwoTruthsOneLieMultiplayer } from '../games/multiplayer/TwoTruthsOneLieMultiplayer';
import { TruthOrDareMultiplayer } from '../games/multiplayer/TruthOrDareMultiplayer';
import { TwentyQuestionsMultiplayer } from '../games/multiplayer/TwentyQuestionsMultiplayer';

export function GamePlayPage() {
  const { gameId, roomCode } = useParams();
  const navigate = useNavigate();
  const { socket, socketId } = useSocket();
  const players = useGameStore(state => state.players);
  const status = useGameStore(state => state.status);
  const game = useMemo(() => (gameId ? gameThemes.find(item => item.id === gameId) : null), [gameId]);

  const opponent = players.find(player => player.id !== socketId) ?? null;
  const [lastOpponentName, setLastOpponentName] = useState<string | null>(null);

  useEffect(() => {
    if (opponent) {
      setLastOpponentName(opponent.name);
    }
  }, [opponent]);

  // The match can only ever end while this page is mounted because someone explicitly left
  // (a raw disconnect never touches room.players/started) — the server immediately un-starts
  // the room when that happens, so bounce back to the waiting room instead of leaving this
  // screen stuck showing a match that no longer has anyone left to play against.
  useEffect(() => {
    if (status === 'waiting' && gameId && roomCode) {
      navigate(`/jeu/${gameId}/salon/${roomCode}`, { replace: true, state: { opponentLeftName: lastOpponentName } });
    }
  }, [status, gameId, roomCode, navigate, lastOpponentName]);

  const handleLeaveGame = () => {
    if (socket) {
      socket.emit(ClientEvents.LeaveRoom);
    }
    clearActiveRoom();
    navigate('/');
  };

  if (!game || !gameId || !roomCode) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-3xl px-4 py-10 text-center">
        <h2 className="text-2xl font-semibold text-foreground">Jeu introuvable</h2>
        <p className="mt-3 text-sm text-muted-foreground">Retournez à l’accueil pour sélectionner un jeu.</p>
      </motion.div>
    );
  }

  return (
    <motion.main initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <section className="rounded-[2rem] bg-card p-6 shadow-lg shadow-slate-900/5 sm:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">Partie en cours</p>
            <h1 className="mt-3 break-words text-3xl font-bold text-foreground sm:text-4xl">{game.title} — Salon {roomCode}</h1>
            <p className="mt-3 text-base leading-7 text-muted-foreground">{players.length} joueur(s) dans la salle.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate(`/jeu/${gameId}/salon/${roomCode}/resultats`)}>
              Voir résultats
            </Button>
            <Button variant="outline" onClick={handleLeaveGame}>
              Quitter la partie
            </Button>
          </div>
        </div>

        <div className="mt-8">
          {gameId === 'rps' ? (
            <RpsMultiplayer />
          ) : gameId === 'odd-or-even' ? (
            <OddOrEvenMultiplayer />
          ) : gameId === 'would-you-rather' ? (
            <WouldYouRatherMultiplayer />
          ) : gameId === 'two-truths-one-lie' ? (
            <TwoTruthsOneLieMultiplayer />
          ) : gameId === 'truth-or-dare' ? (
            <TruthOrDareMultiplayer />
          ) : gameId === '20-questions' ? (
            <TwentyQuestionsMultiplayer />
          ) : (
            <div className="rounded-3xl border border-border bg-surface p-6 text-sm text-muted-foreground">
              Ce jeu est en cours de développement. Revenez bientôt pour plus d’options.
            </div>
          )}
        </div>
      </section>
    </motion.main>
  );
}
