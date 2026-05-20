/** Avoids notification → session.gateway → lms → workflow import cycles at module load. */
export const SESSION_REALTIME = Symbol('SESSION_REALTIME');

export type SessionRealtimeEmitter = {
  emitUserNotification(
    userId: string,
    payload: {
      id: string;
      event: string;
      title: string;
      body: string;
      actionUrl?: string | null;
      createdAt: string;
    },
  ): void;
};
