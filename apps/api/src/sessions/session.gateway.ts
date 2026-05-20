import { Inject, Logger, forwardRef } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { JwtAccessPayload } from '@unicore/types';
import * as jwt from 'jsonwebtoken';
import type { Server, Socket } from 'socket.io';
import type { AuthUser } from '../auth/auth.types';
import { AuthService } from '../auth/auth.service';
import { LmsAssessmentsService } from '../lms-assessments/lms-assessments.service';

type QuizDraftSaveBody = {
  submissionId?: string;
  answers?: Record<string, string>;
};

type QuizDraftSaveAck =
  | { ok: true; serverNow: string; expiresAt: string | null }
  | { ok: false; error: string };

declare module 'socket.io' {
  interface SocketData {
    actor?: AuthUser;
  }
}

@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: true, credentials: true },
})
export class SessionGateway implements OnGatewayConnection {
  private readonly log = new Logger(SessionGateway.name);

  constructor(
    @Inject(forwardRef(() => AuthService))
    private readonly auth: AuthService,
    private readonly lmsAssessments: LmsAssessmentsService,
  ) {}

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket): void {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      client.disconnect(true);
      return;
    }
    const raw = (client.handshake.auth as { token?: unknown } | undefined)?.token;
    const token = typeof raw === 'string' ? raw : undefined;
    if (!token) {
      client.disconnect(true);
      return;
    }
    void (async () => {
      try {
        const payload = jwt.verify(token, secret) as JwtAccessPayload;
        const actor = await this.auth.validateJwtPayload(payload);
        client.data.actor = actor;
        void client.join(`user:${payload.sub}`);
      } catch (err) {
        this.log.debug(`WS auth failed: ${err instanceof Error ? err.message : String(err)}`);
        client.disconnect(true);
      }
    })();
  }

  /** Prompt **8.2 (3)** — quiz draft autosave channel (REST PATCH remains fallback). */
  @SubscribeMessage('quiz.draft.save')
  async handleQuizDraftSave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: QuizDraftSaveBody,
  ): Promise<QuizDraftSaveAck> {
    const actor = client.data.actor;
    if (!actor) {
      return { ok: false, error: 'Unauthorized' };
    }
    const submissionId = typeof body?.submissionId === 'string' ? body.submissionId.trim() : '';
    if (!submissionId) {
      return { ok: false, error: 'submissionId is required' };
    }
    try {
      const saved = await this.lmsAssessments.saveQuizDraft(actor, submissionId, {
        answers: body.answers,
      });
      return {
        ok: true,
        serverNow: saved.serverNow,
        expiresAt: saved.expiresAt,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Autosave failed';
      return { ok: false, error: message };
    }
  }

  emitSessionTerminated(userId: string, body: Record<string, unknown>): void {
    if (!this.server) {
      return;
    }
    this.server.to(`user:${userId}`).emit('session.terminated', body);
  }

  emitUserNotification(userId: string, payload: Record<string, unknown>): void {
    if (!this.server) {
      return;
    }
    this.server.to(`user:${userId}`).emit('notification.new', payload);
  }
}
