import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { useGameStore } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import { ClientEvents, ServerEvents } from '../lib/socketEvents';
import { gameThemes } from '../data/gameThemes';

export function RoomWaitingPage() {
  const { gameId, roomCode } = useParams();
  const navigate = useNavigate();
  const { socket, socketId } = useSocket();
  const players = useGameStore(state => state.players);
  const status = useGameStore(state => state.status);
  const setStatus = useGameStore(state => state.setStatus);
  const game = useMemo(() => (gameId ? gameThemes.find(item => item.id === gameId) : null), [gameId]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!socket || !roomCode) {
      return;
    }

    const handleGameStarted = ({ roomId }: { roomId: string }) => {
      if (roomId !== roomCode) {
        return;
      }
      setStatus('in-game');
      navigate(`/jeu/${gameId}/salon/${roomCode}/partie`);
    };

    socket.on(ServerEvents.GameStarted, handleGameStarted);
    return () => {
      socket.off(ServerEvents.GameStarted, handleGameStarted);
    };
  }, [socket, roomCode, gameId, navigate, setStatus]);

  if (!game || !gameId || !roomCode) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-3xl px-4 sm:px-6 py-12 text-center">
        <h2 className="text-3xl font-semibold text-foreground">Salle introuvable</h2>
        <p className="mt-4 text-sm text-muted-foreground">Le salon demandé est introuvable. Revenez à l’accueil pour en créer un autre.</p>
      </motion.div>
    );
  }

  const isHost = socketId !== null && socketId === players[0]?.id;
  const canStart = players.length > 1 && isHost;
  const host = players[0]?.name ?? 'Hôte';

  const handleStartClick = () => {
    if (!socket || !roomCode) {
      return;
    }

    socket.emit(ClientEvents.StartGame, { roomId: roomCode });
  };

  const handleCopyCode = async () => {
    if (!roomCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — nothing more we can do silently.
    }
  };

  return (
    <motion.main initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <section className="rounded-[2rem] bg-card p-6 shadow-lg shadow-slate-900/5 sm:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">Salle d’attente</p>
            <h1 className="mt-3 break-words text-3xl font-bold text-foreground sm:text-4xl">Salon {roomCode}</h1>
            <p className="mt-3 text-base leading-7 text-muted-foreground">Partagez ce code avec vos amis et préparez-vous à lancer la partie.</p>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className="flex shrink-0 items-center gap-2 rounded-3xl bg-secondary px-4 py-3 text-sm text-secondary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]"
          >
            <span>
              Code du salon : <strong>{roomCode}</strong>
            </span>
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-3xl border border-border bg-background p-4 sm:p-6">
            <h2 className="text-xl font-semibold text-foreground">Joueurs connectés</h2>
            <div className="mt-4 space-y-3 rounded-3xl border border-border bg-surface p-4">
              {players.length > 0 ? (
                players.map(player => (
                  <div key={player.id} className="rounded-2xl bg-card p-3 text-sm text-foreground shadow-sm">
                    {player.name === host ? `${player.name} (hôte)` : player.name}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Aucun joueur connecté pour le moment.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-background p-4 sm:p-6">
            <h2 className="text-xl font-semibold text-foreground">Statut de la salle</h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">{status === 'waiting' ? 'En attente de joueurs...' : 'Prêt à démarrer.'}</p>
            <div className="mt-6 flex flex-col gap-3">
              <Button disabled={!canStart} onClick={handleStartClick}>
                {isHost ? 'Démarrer la partie' : 'En attente de l’hôte'}
              </Button>
              <Button variant="secondary" onClick={() => navigate('/')}>Retour à l’accueil</Button>
            </div>
          </div>
        </div>
      </section>
    </motion.main>
  );
}
