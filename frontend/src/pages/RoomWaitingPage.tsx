import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { useGameStore } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import { ClientEvents, ServerEvents } from '../lib/socketEvents';
import { clearActiveRoom } from '../lib/playerSession';
import { gameThemes } from '../data/gameThemes';
import { TRUTH_OR_DARE_CATEGORIES, DEFAULT_TRUTH_OR_DARE_CATEGORY_IDS, type TruthOrDareCategoryId } from '../data/soloPrompts';

export function RoomWaitingPage() {
  const { t } = useTranslation();
  const { gameId, roomCode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { socket, socketId } = useSocket();
  const players = useGameStore(state => state.players);
  const status = useGameStore(state => state.status);
  const setStatus = useGameStore(state => state.setStatus);
  const game = useMemo(() => (gameId ? gameThemes.find(item => item.id === gameId) : null), [gameId]);
  const [copied, setCopied] = useState(false);
  const opponentLeftName = (location.state as { opponentLeftName?: string | null } | null)?.opponentLeftName ?? null;
  const isTruthOrDare = gameId === 'truth-or-dare';
  const [categories, setCategories] = useState<TruthOrDareCategoryId[]>(DEFAULT_TRUTH_OR_DARE_CATEGORY_IDS);
  const [validatedBy, setValidatedBy] = useState<string[]>([]);
  const [allValidated, setAllValidated] = useState(false);
  const [notifications, setNotifications] = useState<{ id: number; message: string }[]>([]);
  const notificationIdRef = useRef(0);
  const prevValidatedByRef = useRef<string[]>([]);
  const prevCategoriesRef = useRef<TruthOrDareCategoryId[] | null>(null);

  const pushNotification = (message: string) => {
    const id = ++notificationIdRef.current;
    setNotifications(prev => [...prev, { id, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 6000);
  };

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

    const handleCategoriesUpdate = (data: {
      categories: TruthOrDareCategoryId[];
      validatedBy: string[];
      allValidated: boolean;
      changedBy?: string;
    }) => {
      const previousValidatedBy = prevValidatedByRef.current;
      const previousCategories = prevCategoriesRef.current;
      const currentPlayers = useGameStore.getState().players;

      const newlyValidated = data.validatedBy.filter(id => !previousValidatedBy.includes(id) && id !== socketId);
      for (const id of newlyValidated) {
        const name = currentPlayers.find(p => p.id === id)?.name ?? t('roomWaitingPage.unknownPlayerFallback');
        pushNotification(t('roomWaitingPage.categoriesValidatedToast', { name }));
      }

      const categoriesChanged = previousCategories !== null && JSON.stringify(previousCategories) !== JSON.stringify(data.categories);
      const iHadValidated = socketId !== null && previousValidatedBy.includes(socketId);
      if (categoriesChanged && data.changedBy && data.changedBy !== socketId && iHadValidated) {
        const name = currentPlayers.find(p => p.id === data.changedBy)?.name ?? t('roomWaitingPage.unknownPlayerFallback');
        pushNotification(t('roomWaitingPage.categoriesEditedToast', { name }));
      }

      prevValidatedByRef.current = data.validatedBy;
      prevCategoriesRef.current = data.categories;
      setCategories(data.categories);
      setValidatedBy(data.validatedBy);
      setAllValidated(data.allValidated);
    };

    socket.on(ServerEvents.GameStarted, handleGameStarted);
    socket.on(ServerEvents.TruthOrDareCategoriesUpdate, handleCategoriesUpdate);
    return () => {
      socket.off(ServerEvents.GameStarted, handleGameStarted);
      socket.off(ServerEvents.TruthOrDareCategoriesUpdate, handleCategoriesUpdate);
    };
  }, [socket, roomCode, gameId, navigate, setStatus, socketId]);

  if (!game || !gameId || !roomCode) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-3xl px-4 sm:px-6 py-12 text-center">
        <h2 className="text-3xl font-semibold text-foreground">{t('roomWaitingPage.notFoundTitle')}</h2>
        <p className="mt-4 text-sm text-muted-foreground">{t('roomWaitingPage.notFoundMessage')}</p>
      </motion.div>
    );
  }

  const isHost = socketId !== null && socketId === players[0]?.id;
  const canStart = players.length > 1 && isHost && (!isTruthOrDare || allValidated);
  const host = players[0]?.name ?? t('roomWaitingPage.hostFallback');
  const hasValidated = socketId !== null && validatedBy.includes(socketId);

  const handleStartClick = () => {
    if (!socket || !roomCode) {
      return;
    }

    socket.emit(ClientEvents.StartGame, { roomId: roomCode });
  };

  const toggleCategory = (id: TruthOrDareCategoryId) => {
    if (!socket) {
      return;
    }
    const next = categories.includes(id) ? categories.filter(c => c !== id) : [...categories, id];
    socket.emit(ClientEvents.TruthOrDareSetCategories, { categories: next });
  };

  const handleValidateCategories = () => {
    if (!socket) {
      return;
    }
    socket.emit(ClientEvents.TruthOrDareValidateCategories);
  };

  const handleLeaveRoom = () => {
    if (socket) {
      socket.emit(ClientEvents.LeaveRoom);
    }
    clearActiveRoom();
    navigate('/');
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
    <>
      <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6">
        <AnimatePresence>
          {notifications.map(notification => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, y: -12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              className="pointer-events-auto max-w-sm rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground shadow-lg shadow-slate-900/10"
            >
              {notification.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <motion.main initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <section className="rounded-[2rem] bg-card p-6 shadow-lg shadow-slate-900/5 sm:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">{t('roomWaitingPage.eyebrow')}</p>
            <h1 className="mt-3 break-words text-3xl font-bold text-foreground sm:text-4xl">{t('roomWaitingPage.title', { roomCode })}</h1>
            <p className="mt-3 text-base leading-7 text-muted-foreground">{t('roomWaitingPage.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className="flex shrink-0 items-center gap-2 rounded-3xl bg-secondary px-4 py-3 text-sm text-secondary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]"
          >
            <span>
              {t('roomWaitingPage.copyCodeLabel')}<strong>{roomCode}</strong>
            </span>
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>

        {opponentLeftName ? (
          <div className="mt-6 rounded-3xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            {t('roomWaitingPage.opponentLeftBanner', { name: opponentLeftName })}
          </div>
        ) : null}

        {isTruthOrDare ? (
          <div className="mt-6 rounded-3xl border border-border bg-background p-4 sm:p-6">
            <h2 className="text-xl font-semibold text-foreground">{t('roomWaitingPage.categoriesHeading')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('roomWaitingPage.categoriesHelp')}
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {TRUTH_OR_DARE_CATEGORIES.map(category => (
                <label
                  key={category.id}
                  className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface p-3 text-sm transition-colors hover:border-primary/40"
                >
                  <input
                    type="checkbox"
                    checked={categories.includes(category.id)}
                    onChange={() => toggleCategory(category.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                  />
                  <span>
                    <span className="block font-semibold text-foreground">{t(`truthOrDareCategories.${category.id}.label`)}</span>
                    <span className="block text-xs text-muted-foreground">{t(`truthOrDareCategories.${category.id}.description`)}</span>
                  </span>
                </label>
              ))}
            </div>

            <div className="mt-4 space-y-2 rounded-2xl border border-dashed border-border p-3">
              {players.map(player => {
                const validated = validatedBy.includes(player.id);
                const isMe = player.id === socketId;
                return (
                  <div key={player.id} className="flex items-center gap-2 text-sm">
                    <span className={validated ? 'text-primary' : 'text-muted-foreground'}>{validated ? '✓' : '⏳'}</span>
                    <span className="font-medium text-foreground">
                      {player.name}
                      {isMe ? t('roomWaitingPage.youTag') : ''}
                    </span>
                    <span className="text-muted-foreground">{validated ? t('roomWaitingPage.validatedStatus') : t('roomWaitingPage.notValidatedStatus')}</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {allValidated
                  ? t('roomWaitingPage.bothValidatedStatus')
                  : t('roomWaitingPage.waitingValidationStatus')}
              </p>
              <Button type="button" variant={hasValidated ? 'secondary' : 'default'} onClick={handleValidateCategories} disabled={hasValidated}>
                {hasValidated ? t('roomWaitingPage.validatedButton') : t('roomWaitingPage.validateButton')}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-3xl border border-border bg-background p-4 sm:p-6">
            <h2 className="text-xl font-semibold text-foreground">{t('roomWaitingPage.connectedPlayersHeading')}</h2>
            <div className="mt-4 space-y-3 rounded-3xl border border-border bg-surface p-4">
              {players.length > 0 ? (
                players.map(player => (
                  <div key={player.id} className="rounded-2xl bg-card p-3 text-sm text-foreground shadow-sm">
                    {player.name === host ? t('roomWaitingPage.hostTag', { name: player.name }) : player.name}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">{t('roomWaitingPage.noPlayersConnected')}</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-background p-4 sm:p-6">
            <h2 className="text-xl font-semibold text-foreground">{t('roomWaitingPage.roomStatusHeading')}</h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              {status !== 'waiting'
                ? t('roomWaitingPage.statusReady')
                : players.length < 2
                  ? t('roomWaitingPage.statusWaitingPlayers')
                  : isTruthOrDare && !allValidated
                    ? t('roomWaitingPage.statusWaitingValidation')
                    : t('roomWaitingPage.statusReady')}
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Button disabled={!canStart} onClick={handleStartClick}>
                {!isHost
                  ? t('roomWaitingPage.startButtonWaitingHost')
                  : isTruthOrDare && !allValidated
                    ? t('roomWaitingPage.startButtonWaitingValidation')
                    : t('roomWaitingPage.startButtonReady')}
              </Button>
              <Button variant="secondary" onClick={handleLeaveRoom}>{t('roomWaitingPage.leaveRoomButton')}</Button>
            </div>
          </div>
        </div>
      </section>
      </motion.main>
    </>
  );
}
