import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { useSocket } from '../hooks/useSocket';
import { ClientEvents, ServerEvents } from '../lib/socketEvents';
import { useGameStore } from '../store/useGameStore';
import { getPlayerToken, getStoredPseudo, setStoredPseudo, saveActiveRoom } from '../lib/playerSession';
import { translateRoomError } from '../lib/roomErrors';

const PSEUDO_MAX_LENGTH = 20;

export function JoinPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [pseudo, setPseudo] = useState(() => getStoredPseudo());
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const setGameId = useGameStore(state => state.setGameId);
  const setRoomCode = useGameStore(state => state.setRoomCode);
  const setPlayers = useGameStore(state => state.setPlayers);
  const setStatus = useGameStore(state => state.setStatus);
  const setScores = useGameStore(state => state.setScores);

  const handlePseudoChange = (value: string) => {
    setPseudo(value);
    setStoredPseudo(value);
  };

  const trimmedPseudo = pseudo.trim();

  const handleJoinRoom = () => {
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
    socket.emit(ClientEvents.JoinRoom, { roomId: code, name: trimmedPseudo, token: getPlayerToken() });
    socket.once(ServerEvents.RoomUpdate, ({ gameId, players, started, scores }) => {
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
      setError(translateRoomError(t, message));
    });
  };

  return (
    <motion.main initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <section className="mx-auto max-w-xl rounded-2xl bg-card p-10 shadow-lg shadow-slate-900/5">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">{t('joinPage.title')}</h1>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">{t('joinPage.description')}</p>
        </div>

        <div className="mt-8 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-foreground" htmlFor="join-pseudo">
              {t('joinPage.pseudoLabel')}
            </label>
            <input
              id="join-pseudo"
              value={pseudo}
              onChange={event => handlePseudoChange(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  handleJoinRoom();
                }
              }}
              maxLength={PSEUDO_MAX_LENGTH}
              placeholder={t('joinPage.pseudoPlaceholder')}
              className="mt-3 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground" htmlFor="join-code">
              {t('joinPage.codeLabel')}
            </label>
            <input
              id="join-code"
              value={joinCode}
              onChange={event => setJoinCode(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  handleJoinRoom();
                }
              }}
              placeholder={t('joinPage.codePlaceholder')}
              className="mt-3 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {error ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <Button className="w-full" onClick={handleJoinRoom} disabled={!trimmedPseudo}>
            {t('joinPage.joinButton')}
          </Button>
        </div>
      </section>
    </motion.main>
  );
}
