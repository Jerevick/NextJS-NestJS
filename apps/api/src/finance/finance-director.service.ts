import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

/** Finance Director (BURSAR position) or institution superuser. */
@Injectable()
export class FinanceDirectorService {
  constructor(private readonly prisma: PrismaService) {}

  async assertFinanceDirector(actor: AuthUser): Promise<void> {
    if (actor.permissions.includes('*')) {
      return;
    }
    const holder = await this.prisma.positionHolder.findFirst({
      where: {
        institutionId: actor.institutionId,
        userId: actor.userId,
        endDate: null,
        position: { code: 'BURSAR', deletedAt: null },
        ...(actor.entityScope === 'ENTITY' ? { entityId: actor.entityId } : {}),
      },
    });
    if (holder) {
      return;
    }
    throw new ForbiddenException('Finance Director (BURSAR) permission required for this action');
  }
}
