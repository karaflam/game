import { useEffect, useMemo, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from '../lib/socketClient';
import { ClientEvents, ServerEvents } from '../lib/socketEvents';
import { useGameStore, type Player } from '../store/useGameStore';
import { getActiveRoom, getStoredPseudo, getPlayerToken, clearActiveRoom } from '../lib/playerSession';

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState('Tentative de connexion au serveur...');
  const [socketId, setSocketId] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const setPlayers = useGameStore(state => state.setPlayers);
  const setStatus = useGameStore(state => state.setStatus);
  const setError = useGameStore(state => state.setError);
  const setScores = useGameStore(state => state.setScores);

  useEffect(() => {
    const nextSocket = getSocket();
    setSocket(nextSocket);

    // Every reconnect (silent Socket.IO auto-reconnect after a background/network blip, or a
    // fresh page load) gets a NEW socket.id. If we were actively in a room, the server has no
    // idea this new connection belongs there until we explicitly (re)join it — nothing else
    // does this automatically. socketId is only published once that handshake has resolved (or
    // immediately if there was nothing to rejoin), so every effect elsewhere that depends on
    // socketId — every game component's own resync — naturally waits for it instead of racing it.
    const rejoinActiveRoomIfAny = () => {
      const session = getActiveRoom();
      const pseudo = getStoredPseudo().trim();

      if (!session || !pseudo) {
        setSocketId(nextSocket.id ?? null);
        return;
      }

      const unlock = () => setSocketId(nextSocket.id ?? null);

      nextSocket.once(ServerEvents.RoomUpdate, unlock);
      nextSocket.once(ServerEvents.RoomError, () => {
        clearActiveRoom();
        unlock();
      });

      nextSocket.emit(ClientEvents.JoinRoom, {
        roomId: session.roomCode,
        name: pseudo,
        gameId: session.gameId,
        token: getPlayerToken()
      });
    };

    if (nextSocket.connected) {
      setConnected(true);
      setMessage('Connecté au serveur.');
      rejoinActiveRoomIfAny();
    }

    const handleConnect = () => {
      setConnected(true);
      setMessage('Connecté au serveur.');
      nextSocket.emit(ServerEvents.Hello, { source: 'frontend', timestamp: Date.now() });
      rejoinActiveRoomIfAny();
    };

    const handleDisconnect = () => {
      setConnected(false);
      setSocketId(null);
      setMessage('Déconnecté du serveur, reconnexion en cours...');
    };

    const handleGreeting = (data: { type: string; payload: string }) => {
      setMessage(data.payload);
    };

    const handleRoomUpdate = (data: { roomId: string; players: Player[]; started?: boolean; scores?: Record<string, number> }) => {
      setPlayers(data.players);
      if (data.scores) {
        setScores(data.scores);
      }
      setStatus(data.started ? 'in-game' : 'waiting');
    };

    const handleRoomError = ({ message }: { message: string }) => {
      setError(message);
    };

    nextSocket.on('connect', handleConnect);
    nextSocket.on('disconnect', handleDisconnect);
    nextSocket.on(ServerEvents.Greeting, handleGreeting);
    nextSocket.on(ServerEvents.RoomUpdate, handleRoomUpdate);
    nextSocket.on(ServerEvents.RoomError, handleRoomError);

    return () => {
      nextSocket.off('connect', handleConnect);
      nextSocket.off('disconnect', handleDisconnect);
      nextSocket.off(ServerEvents.Greeting, handleGreeting);
      nextSocket.off(ServerEvents.RoomUpdate, handleRoomUpdate);
      nextSocket.off(ServerEvents.RoomError, handleRoomError);
    };
  }, [setError, setPlayers, setStatus, setScores]);

  const connection = useMemo(() => ({ connected, message, socket, socketId }), [connected, message, socket, socketId]);
  return connection;
}
