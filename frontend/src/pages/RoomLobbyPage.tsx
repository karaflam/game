import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { gameThemes } from '../data/gameThemes';
import { useSocket } from '../hooks/useSocket';
import { ClientEvents, ServerEvents } from '../lib/socketEvents';
import { useGameStore } from '../store/useGameStore';
import { getPlayerToken, getStoredPseudo, setStoredPseudo, saveActiveRoom } from '../lib/playerSession';
import { translateRoomError } from '../lib/roomErrors';

const PSEUDO_MAX_LENGTH = 20;

export function RoomLobbyPage() {
  const { t } = useTranslation();
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const game = useMemo(() => (gameId ? gameThemes.find(item => item.id === gameId) : null), [gameId]);
  const [pseudo, setPseudo] = useState(() => getStoredPseudo());
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const setGameId = useGameStore(state => state.setGameId);
  const setRoomCode = useGameStore(state => state.setRoomCode);
  const setPlayers = useGameStore(state => state.setPlayers);
  const setStatus = useGameStore(state => state.setStatus);
  const setScores = useGameStore(state => state.setScores);

  if (!game || !gameId) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-3xl px-4 py-10 text-center">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">{t('common.gameNotFoundTitle')}</h2>
        <p className="mt-3 text-sm text-muted-foreground">{t('roomLobbyPage.notFoundMessage')}</p>
      </motion.div>
    );
  }

  const handlePseudoChange = (value: string) => {
    setPseudo(value);
    setStoredPseudo(value);
  };

  const trimmedPseudo = pseudo.trim();

  const handleCreateRoom = () => {
    if (submitting) {
      return;
    }

    if (!trimmedPseudo) {
      setError(t('roomLobbyPage.errorPseudoRequired'));
      return;
    }

    if (!socket) {
      setError(t('roomLobbyPage.errorNoServerConnection'));
      return;
    }

    setError(null);
    setSubmitting(true);
    socket.emit(ClientEvents.CreateRoom, { name: trimmedPseudo, gameId, token: getPlayerToken() });
    socket.once(ServerEvents.RoomCreated, ({ roomId, players }) => {
      setSubmitting(false);
      setGameId(gameId);
      setRoomCode(roomId);
      setPlayers(players);
      setStatus('waiting');
      saveActiveRoom({ gameId, roomCode: roomId });
      navigate(`/jeu/${gameId}/salon/${roomId}`);
    });
    socket.once(ServerEvents.RoomError, ({ message }) => {
      setSubmitting(false);
      setError(translateRoomError(t, message));
    });
  };

  const handleJoinRoom = () => {
    if (submitting) {
      return;
    }

    if (!trimmedPseudo) {
      setError(t('roomLobbyPage.errorPseudoRequired'));
      return;
    }

    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setError(t('roomLobbyPage.errorRoomCodeRequired'));
      return;
    }

    if (!socket) {
      setError(t('roomLobbyPage.errorNoServerConnection'));
      return;
    }

    setError(null);
    setSubmitting(true);
    socket.emit(ClientEvents.JoinRoom, { roomId: code, name: trimmedPseudo, gameId, token: getPlayerToken() });
    socket.once(ServerEvents.RoomUpdate, ({ players, started, scores }) => {
      setSubmitting(false);
      setGameId(gameId);
      setRoomCode(code);
      setPlayers(players);
      if (scores) {
        setScores(scores);
      }
      setStatus(started ? 'in-game' : 'waiting');
      saveActiveRoom({ gameId, roomCode: code });
      navigate(started ? `/jeu/${gameId}/salon/${code}/partie` : `/jeu/${gameId}/salon/${code}`);
    });
    socket.once(ServerEvents.RoomError, ({ message }) => {
      setSubmitting(false);
      setError(translateRoomError(t, message));
    });
  };

  return (
    <motion.main initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <section className="mb-10 rounded-2xl bg-card p-10 shadow-lg shadow-slate-900/5">
        <div className="space-y-6">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">{t(`games.${game.id}.title`)}</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">{t(`games.${game.id}.description`)}</p>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-border bg-background p-6">
          <label className="block text-sm font-semibold text-foreground" htmlFor="pseudo">
            {t('roomLobbyPage.pseudoLabel')}
          </label>
          <p className="mt-1 text-sm text-muted-foreground">{t('roomLobbyPage.pseudoHelp')}</p>
          <input
            id="pseudo"
            value={pseudo}
            onChange={event => handlePseudoChange(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                handleCreateRoom();
              }
            }}
            maxLength={PSEUDO_MAX_LENGTH}
            placeholder={t('roomLobbyPage.pseudoPlaceholder')}
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
            <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">{t('roomLobbyPage.createRoomTitle')}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('roomLobbyPage.createRoomDescription')}</p>
            <Button className="mt-4" onClick={handleCreateRoom} disabled={!trimmedPseudo || submitting}>
              {t('roomLobbyPage.createRoomButton')}
            </Button>
          </div>
          <div className="rounded-3xl border border-border bg-background p-6">
            <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">{t('roomLobbyPage.joinRoomTitle')}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('roomLobbyPage.joinRoomDescription')}</p>
            <div className="mt-4 flex flex-col flex-wrap gap-3 sm:flex-row">
              <input
                value={joinCode}
                onChange={event => setJoinCode(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    handleJoinRoom();
                  }
                }}
                placeholder={t('roomLobbyPage.roomCodePlaceholder')}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <Button variant="secondary" onClick={handleJoinRoom} disabled={!trimmedPseudo || submitting}>
                {t('roomLobbyPage.joinRoomButton')}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </motion.main>
  );
}
