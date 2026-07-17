import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { gameThemes } from '../data/gameThemes';
import { useSocket } from '../hooks/useSocket';
import { ClientEvents, ServerEvents } from '../lib/socketEvents';
import { useGameStore } from '../store/useGameStore';

const PSEUDO_STORAGE_KEY = 'game:pseudo';
const PSEUDO_MAX_LENGTH = 20;

export function RoomLobbyPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const game = useMemo(() => (gameId ? gameThemes.find(item => item.id === gameId) : null), [gameId]);
  const [pseudo, setPseudo] = useState(() => {
    try {
      return localStorage.getItem(PSEUDO_STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const setGameId = useGameStore(state => state.setGameId);
  const setRoomCode = useGameStore(state => state.setRoomCode);
  const setPlayers = useGameStore(state => state.setPlayers);
  const setStatus = useGameStore(state => state.setStatus);

  if (!game || !gameId) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-3xl px-4 py-10 text-center">
        <h2 className="text-2xl font-semibold text-foreground">Jeu introuvable</h2>
        <p className="mt-3 text-sm text-muted-foreground">Retournez à l’accueil et choisissez un jeu pour commencer.</p>
      </motion.div>
    );
  }

  const handlePseudoChange = (value: string) => {
    setPseudo(value);
    try {
      localStorage.setItem(PSEUDO_STORAGE_KEY, value);
    } catch {
      // ignore
    }
  };

  const trimmedPseudo = pseudo.trim();

  const handleCreateRoom = () => {
    if (!trimmedPseudo) {
      setError('Veuillez saisir un pseudo.');
      return;
    }

    if (!socket) {
      setError('Connexion serveur non disponible.');
      return;
    }

    socket.emit(ClientEvents.CreateRoom, { name: trimmedPseudo, gameId });
    socket.once(ServerEvents.RoomCreated, ({ roomId, players }) => {
      setGameId(gameId);
      setRoomCode(roomId);
      setPlayers(players);
      setStatus('waiting');
      navigate(`/jeu/${gameId}/salon/${roomId}`);
    });
    socket.once(ServerEvents.RoomError, ({ message }) => {
      setError(message);
    });
  };

  const handleJoinRoom = () => {
    if (!trimmedPseudo) {
      setError('Veuillez saisir un pseudo.');
      return;
    }

    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setError('Veuillez saisir un code de salon.');
      return;
    }

    if (!socket) {
      setError('Connexion serveur non disponible.');
      return;
    }

    socket.emit(ClientEvents.JoinRoom, { roomId: code, name: trimmedPseudo, gameId });
    socket.once(ServerEvents.RoomUpdate, ({ players }) => {
      setGameId(gameId);
      setRoomCode(code);
      setPlayers(players);
      setStatus('waiting');
      navigate(`/jeu/${gameId}/salon/${code}`);
    });
    socket.once(ServerEvents.RoomError, ({ message }) => {
      setError(message);
    });
  };

  return (
    <motion.main initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <section className="mb-10 rounded-[2rem] bg-card p-10 shadow-lg shadow-slate-900/5">
        <div className="space-y-6">
          <div>
            <h1 className="text-4xl font-bold text-foreground">{game.title}</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">{game.description}</p>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-border bg-background p-6">
          <label className="block text-sm font-semibold text-foreground" htmlFor="pseudo">
            Votre pseudo
          </label>
          <p className="mt-1 text-sm text-muted-foreground">C’est ce nom qui sera affiché aux autres joueurs pendant la partie.</p>
          <input
            id="pseudo"
            value={pseudo}
            onChange={event => handlePseudoChange(event.target.value)}
            maxLength={PSEUDO_MAX_LENGTH}
            placeholder="Ex : Alex"
            className="mt-3 w-full max-w-sm rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {error ? (
          <div className="mt-6 rounded-3xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-border bg-background p-6">
            <h2 className="text-xl font-semibold text-foreground">Créer un salon</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Générez un code unique et invitez vos amis pour rejoindre votre partie.</p>
            <Button className="mt-4" onClick={handleCreateRoom} disabled={!trimmedPseudo}>
              Créer un salon
            </Button>
          </div>
          <div className="rounded-3xl border border-border bg-background p-6">
            <h2 className="text-xl font-semibold text-foreground">Rejoindre un salon</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Entrez le code du salon que vous avez reçu pour intégrer la partie.</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                value={joinCode}
                onChange={event => setJoinCode(event.target.value)}
                placeholder="Code du salon"
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <Button variant="secondary" onClick={handleJoinRoom} disabled={!trimmedPseudo}>
                Rejoindre
              </Button>
            </div>
          </div>
        </div>
      </section>
    </motion.main>
  );
}
