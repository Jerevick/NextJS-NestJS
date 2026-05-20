'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useSession } from 'next-auth/react';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { connectRealtimeSocket } from '@/lib/realtime-socket';

export type RealtimeNotificationPayload = {
  id: string;
  event?: string;
  title: string;
  body: string;
  actionUrl?: string | null;
  createdAt: string;
};

type NotificationsRealtimeContextValue = {
  unreadCount: number | null;
  live: boolean;
  setUnreadCount: (count: number) => void;
  subscribe: (listener: (payload: RealtimeNotificationPayload) => void) => () => void;
};

const NotificationsRealtimeContext = createContext<NotificationsRealtimeContextValue | null>(null);

export function NotificationsRealtimeProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [live, setLive] = useState(false);
  const listenersRef = useRef(new Set<(payload: RealtimeNotificationPayload) => void>());

  const subscribe = useCallback((listener: (payload: RealtimeNotificationPayload) => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    const token = session?.accessToken;
    const user = session?.user;
    if (!token || !user?.institutionId) {
      setLive(false);
      return;
    }

    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'X-Institution-ID': user.institutionId,
    };
    appendOptionalEntityHeader(headers, user);

    void fetch(`${apiBase}/notifications`, { headers, cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: { unreadCount?: number } | null) => {
        if (payload && typeof payload.unreadCount === 'number') {
          setUnreadCount(payload.unreadCount);
        }
      })
      .catch(() => undefined);
    const socket = connectRealtimeSocket(apiBase, token);

    const onConnect = () => setLive(true);
    const onDisconnect = () => setLive(false);
    const onNotification = (payload: RealtimeNotificationPayload) => {
      setUnreadCount((c) => (c === null ? 1 : c + 1));
      for (const listener of listenersRef.current) {
        listener(payload);
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('notification.new', onNotification);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('notification.new', onNotification);
      socket.disconnect();
      setLive(false);
    };
  }, [session?.accessToken]);

  return (
    <NotificationsRealtimeContext.Provider value={{ unreadCount, live, setUnreadCount, subscribe }}>
      {children}
    </NotificationsRealtimeContext.Provider>
  );
}

export function useNotificationsRealtime(): NotificationsRealtimeContextValue | null {
  return useContext(NotificationsRealtimeContext);
}
