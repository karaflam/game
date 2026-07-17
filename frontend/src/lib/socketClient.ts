import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

// In production (e.g. Render), frontend and backend are separate services with
// their own hostnames/HTTPS, so the backend URL must come from a build-time env
// var. In local/LAN dev there's no such var, so fall back to "same host, port
// 3000" — this covers both localhost and another device joining over the LAN.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? `${window.location.protocol}//${window.location.hostname}:3000`;

let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket']
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
