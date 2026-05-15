import { Injectable } from '@nestjs/common';
import { SessionGateway } from './session.gateway';

@Injectable()
export class SessionEventsService {
  constructor(private readonly gateway: SessionGateway) {}

  emitStudentSessionTerminated(userId: string, institutionId: string, reason: string): void {
    this.gateway.emitSessionTerminated(userId, {
      institutionId,
      reason,
    });
  }
}
