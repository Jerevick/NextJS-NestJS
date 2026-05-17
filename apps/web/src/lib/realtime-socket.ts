import { io, type Socket } from 'socket.io-client';

/** Connect to Nest `SessionGateway` namespace (`/realtime`) with JWT from NextAuth. */
export function connectRealtimeSocket(apiBase: string, accessToken: string): Socket {
  const origin = new URL(apiBase).origin;
  return io(`${origin}/realtime`, {
    path: '/socket.io',
    auth: { token: accessToken },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 8,
  });
}
