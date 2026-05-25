import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthUser } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { RESOURCE_ENTITY_ID_KEY } from '../decorators/resource-entity-id.decorator';
import { SKIP_INSTITUTION_SCOPE_KEY } from '../decorators/skip-institution-scope.decorator';

type ResourceMeta = { paramKey: string; resolver: 'student' | 'entity' | 'enrollment' };

@Injectable()
export class EntityScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_INSTITUTION_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return true;
    }

    const meta = this.reflector.getAllAndOverride<ResourceMeta | undefined>(
      RESOURCE_ENTITY_ID_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!meta) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = req.user;
    if (!user) {
      return true;
    }
    if (user.permissions.includes('*') || user.entityScope === 'ALL') {
      return true;
    }

    const rawId = this.extractId(req, meta.paramKey);
    if (!rawId) {
      return true;
    }

    const resourceEntityId = await this.resolveEntityId(user.institutionId, rawId, meta.resolver);
    if (!resourceEntityId) {
      throw new NotFoundException('Resource not found');
    }
    if (resourceEntityId !== user.entityId) {
      throw new ForbiddenException({
        statusCode: 403,
        errorCode: 'ENTITY_SCOPE_MISMATCH',
        message: 'This record belongs to a different campus entity.',
      });
    }
    return true;
  }

  private extractId(req: Request, paramKey: string): string | undefined {
    const params = req.params as Record<string, string | undefined>;
    if (paramKey in params && params[paramKey]) {
      return params[paramKey];
    }
    const body = req.body as Record<string, unknown> | undefined;
    if (body && typeof body[paramKey] === 'string') {
      return body[paramKey];
    }
    const query = req.query as Record<string, unknown>;
    const q = query[paramKey];
    if (typeof q === 'string' && q.trim()) {
      return q.trim();
    }
    return undefined;
  }

  private async resolveEntityId(
    institutionId: string,
    id: string,
    resolver: ResourceMeta['resolver'],
  ): Promise<string | null> {
    if (resolver === 'entity') {
      const ent = await this.prisma.institutionEntity.findFirst({
        where: { id, institutionId, deletedAt: null },
        select: { id: true },
      });
      return ent?.id ?? null;
    }
    if (resolver === 'enrollment') {
      const enrollment = await this.prisma.studentEnrollment.findFirst({
        where: { id, institutionId, deletedAt: null },
        select: { student: { select: { entityId: true } } },
      });
      return enrollment?.student.entityId ?? null;
    }
    const student = await this.prisma.student.findFirst({
      where: { id, institutionId, deletedAt: null },
      select: { entityId: true },
    });
    return student?.entityId ?? null;
  }
}
