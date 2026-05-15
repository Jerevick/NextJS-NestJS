import { Logger } from '@nestjs/common';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import * as jwt from 'jsonwebtoken';
import type { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: true, credentials: true },
})
export class SessionGateway implements OnGatewayConnection {
  private readonly log = new Logger(SessionGateway.name);

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
    try {
      const payload = jwt.verify(token, secret) as { sub?: string };
      if (typeof payload.sub !== 'string' || !payload.sub) {
        throw new Error('invalid sub');
      }
      void client.join(`user:${payload.sub}`);
    } catch (err) {
      this.log.debug(`WS auth failed: ${err instanceof Error ? err.message : String(err)}`);
      client.disconnect(true);
    }
  }

  emitSessionTerminated(userId: string, body: Record<string, unknown>): void {
    if (!this.server) {
      return;
    }
    this.server.to(`user:${userId}`).emit('session.terminated', body);
  }
}
