import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@mangotalk/types';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

// Empty string → undefined so socket.io uses current page origin (goes through Vite proxy)
const SOCKET_URL: string | undefined = import.meta.env.VITE_SOCKET_URL || undefined;

export function getSocket(): AppSocket {
  if (!socket) {
    const token = localStorage.getItem('accessToken') ?? '';
    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: false,
    }) as AppSocket;
  }
  return socket;
}

export function connectSocket(token: string): AppSocket {
  // If socket already exists and is connected, just return it
  if (socket?.connected) return socket;

  // If socket exists but disconnected, update token and reconnect
  if (socket) {
    (socket.auth as Record<string, string>).token = token;
    socket.connect();
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
  }) as AppSocket;

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
