import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

function assertManage(actor: AuthUser, institutionId: string): void {
  if (actor.permissions.includes('*')) {
    return;
  }
  if (actor.institutionId !== institutionId) {
    throw new ForbiddenException('You may only manage access for your own institution');
  }
  if (actor.entityScope !== 'ALL') {
    throw new ForbiddenException('Cross-campus access grants require institution-wide scope');
  }
  if (!actor.permissions.includes('institutions.write')) {
    throw new ForbiddenException('Missing institutions.write permission');
  }
}

@Injectable()
export class UserEntityAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async grantAccess(
    actor: AuthUser,
    institutionId: string,
    entityId: string,
    userId: string,
  ): Promise<{ id: string; userId: string; entityId: string }> {
    assertManage(actor, institutionId);
    await this.assertEntityInInstitution(institutionId, entityId);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, institutionId, deletedAt: null },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found in this institution');
    }
    const row = await this.prisma.userEntityAccess.upsert({
      where: { userId_entityId: { userId, entityId } },
      create: { userId, entityId },
      update: {},
      select: { id: true, userId: true, entityId: true },
    });
    return row;
  }

  async revokeAccess(
    actor: AuthUser,
    institutionId: string,
    entityId: string,
    userId: string,
  ): Promise<{ ok: true }> {
    assertManage(actor, institutionId);
    await this.assertEntityInInstitution(institutionId, entityId);
    const result = await this.prisma.userEntityAccess.deleteMany({
      where: { userId, entityId },
    });
    if (result.count === 0) {
      throw new NotFoundException('Access grant not found');
    }
    await this.prisma.user.updateMany({
      where: { id: userId, institutionId, deletedAt: null },
      data: { sessionVersion: { increment: 1 } },
    });
    return { ok: true };
  }

  async listForEntity(
    actor: AuthUser,
    institutionId: string,
    entityId: string,
  ): Promise<
    Array<{
      id: string;
      userId: string;
      createdAt: Date;
      user: { email: string; role: string };
    }>
  > {
    if (
      !actor.permissions.includes('*') &&
      (actor.institutionId !== institutionId ||
        (!actor.permissions.includes('institutions.read') &&
          !actor.permissions.includes('institutions.write')))
    ) {
      throw new ForbiddenException('Missing permission to view campus access');
    }
    await this.assertEntityInInstitution(institutionId, entityId);
    return this.prisma.userEntityAccess.findMany({
      where: {
        entityId,
        user: { institutionId, deletedAt: null },
      },
      select: {
        id: true,
        userId: true,
        createdAt: true,
        user: { select: { email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listForUser(actor: AuthUser, userId: string): Promise<
    Array<{
      entityId: string;
      code: string;
      name: string;
      status: string;
    }>
  > {
    if (actor.userId !== userId && !actor.permissions.includes('*')) {
      if (!actor.permissions.includes('institutions.read') && !actor.permissions.includes('institutions.write')) {
        throw new ForbiddenException('Cannot list another user’s campus access');
      }
    }
    const rows = await this.prisma.userEntityAccess.findMany({
      where: {
        userId,
        user: { institutionId: actor.institutionId, deletedAt: null },
        entity: { deletedAt: null },
      },
      include: {
        entity: { select: { id: true, code: true, name: true, status: true } },
      },
    });
    return rows.map((r) => ({
      entityId: r.entity.id,
      code: r.entity.code,
      name: r.entity.name,
      status: r.entity.status,
    }));
  }

  private async assertEntityInInstitution(institutionId: string, entityId: string): Promise<void> {
    const ent = await this.prisma.institutionEntity.findFirst({
      where: { id: entityId, institutionId, deletedAt: null },
      select: { id: true },
    });
    if (!ent) {
      throw new NotFoundException('Institution entity not found');
    }
  }
}
