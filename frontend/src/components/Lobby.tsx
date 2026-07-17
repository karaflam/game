import { useState } from 'react';
import type { Socket } from 'socket.io-client';

type LobbyProps = {
  socket: Socket | null;
  roomId: string | null;
  players: string[];
  errorMessage: string | null;
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string) => void;
  onLeaveRoom: () => void;
};

export function Lobby({ socket, roomId, players, errorMessage, onCreateRoom, onJoinRoom, onLeaveRoom }: LobbyProps) {
  const [joinRoomId, setJoinRoomId] = useState('');

  return (
    <section className="mt-6 p-6 bg-white rounded-2xl shadow-sm">
      <h2 className="text-lg font-semibold">Lobby Multijoueur</h2>
      <p className="text-sm text-slate-500">Créez ou rejoignez une salle pour jouer en ligne avec un autre joueur.</p>
      <div className="mt-4 grid gap-3">
        <button
          type="button"
          onClick={onCreateRoom}
          disabled={!socket}
          className={`px-4 py-2 rounded-lg text-white ${!socket ? 'bg-gray-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
        >
          Créer une salle
        </button>

        <div className="flex gap-2">
          <input
            type="text"
            value={joinRoomId}
            onChange={e => setJoinRoomId(e.target.value)}
            placeholder="ID de salle"
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200"
          />
          <button
            type="button"
            onClick={() => onJoinRoom(joinRoomId.trim())}
            disabled={!socket || !joinRoomId.trim()}
            className={`px-4 py-2 rounded-lg border ${!socket || !joinRoomId.trim() ? 'bg-gray-100 cursor-not-allowed' : 'bg-white hover:shadow-sm'}`}
          >
            Rejoindre
          </button>
        </div>

        {roomId ? (
          <div className="p-3 rounded-lg border border-gray-100 bg-slate-50">
            <strong>Salle :</strong> {roomId}
            <div className="mt-2">
              <strong>Joueurs :</strong>
              <ul className="mt-2 ml-5 list-disc text-sm">
                {players.map(player => (
                  <li key={player}>{player}</li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={onLeaveRoom}
              className="mt-3 px-3 py-2 rounded-lg border bg-white hover:shadow-sm"
            >
              Quitter la salle
            </button>
          </div>
        ) : null}

        {errorMessage ? <div className="text-red-600">{errorMessage}</div> : null}
      </div>
    </section>
  );
}
