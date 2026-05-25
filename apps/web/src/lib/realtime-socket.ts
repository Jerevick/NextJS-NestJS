import { io, type Socket } from 'socket.io-client';

export function isJwtExpired(token: string, skewSeconds = 30): boolean {
  const [, payload] = token.split('.');
  if (!payload) {
    return true;
  }

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = JSON.parse(atob(padded)) as { exp?: unknown };
    if (typeof decoded.exp !== 'number') {
      return true;
    }
    return decoded.exp <= Math.floor(Date.now() / 1000) + skewSeconds;
  } catch {
    return true;
  }
}

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
