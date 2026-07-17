import { useEffect, useMemo, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket, disconnectSocket } from '../lib/socketClient';
import { ServerEvents } from '../lib/socketEvents';
import { useGameStore, type Player } from '../store/useGameStore';

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState('Tentative de connexion au serveur...');
  const [socketId, setSocketId] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const setPlayers = useGameStore(state => state.setPlayers);
  const setStatus = useGameStore(state => state.setStatus);
  const setError = useGameStore(state => state.setError);

  useEffect(() => {
    const nextSocket = getSocket();
    setSocket(nextSocket);

    if (nextSocket.connected) {
      setConnected(true);
      setSocketId(nextSocket.id ?? null);
      setMessage('Connecté au serveur.');
    }

    const handleConnect = () => {
      setConnected(true);
      setSocketId(nextSocket.id ?? null);
      setMessage('Connecté au serveur.');
      nextSocket.emit(ServerEvents.Hello, { source: 'frontend', timestamp: Date.now() });
    };

    const handleDisconnect = () => {
      setConnected(false);
      setSocketId(null);
      setMessage('Déconnecté du serveur.');
      setStatus('idle');
    };

    const handleGreeting = (data: { type: string; payload: string }) => {
      setMessage(data.payload);
    };

    const handleRoomUpdate = ({ players }: { roomId: string; players: Player[] }) => {
      setPlayers(players);
      setStatus('waiting');
    };

    const handleRoomError = ({ message }: { message: string }) => {
      setError(message);
      setStatus('idle');
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
  }, [setError, setPlayers, setStatus]);

  const connection = useMemo(() => ({ connected, message, socket, socketId }), [connected, message, socket, socketId]);
  return connection;
}
