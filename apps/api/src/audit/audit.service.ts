import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditRepository } from './audit.repository';
import type { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

export type AuditAppendInput = {
  institutionId: string;
  actorId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class AuditService {
  private readonly log = new Logger(AuditService.name);

  constructor(private readonly repo: AuditRepository) {}

  /** Best-effort append; failures are logged and do not throw. */
  append(input: AuditAppendInput): void {
    void this.repo
      .create({
        institution: { connect: { id: input.institutionId } },
        actor: { connect: { id: input.actorId } },
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        oldValues: input.oldValues ?? undefined,
        newValues: input.newValues ?? undefined,
        ipAddress: input.ipAddress ?? undefined,
        userAgent: input.userAgent ?? undefined,
      })
      .catch((err: unknown) => {
        this.log.warn(`Failed to write audit log: ${err instanceof Error ? err.message : String(err)}`);
      });
  }

  async list(actor: AuthUser, query: ListAuditLogsQueryDto) {
    const limit = query.limit ?? 20;
    let from: Date | undefined;
    let to: Date | undefined;
    if (query.from?.trim()) {
      const d = new Date(query.from.trim());
      if (!Number.isNaN(d.getTime())) {
        from = d;
      }
    }
    if (query.to?.trim()) {
      const d = new Date(query.to.trim());
      if (!Number.isNaN(d.getTime())) {
        to = d;
      }
    }
    const where = this.repo.buildListWhere({
      institutionId: actor.institutionId,
      entity: query.entity,
      action: query.action,
      entityId: query.entityId,
      from,
      to,
    });
    const rows = await this.repo.findPage(where, limit, query.cursor);
    let nextCursor: string | undefined;
    if (rows.length > limit) {
      const last = rows.pop();
      nextCursor = last?.id;
    }
    const total = await this.repo.countWhere(where);
    return {
      data: rows.map((r) => ({
        id: r.id,
        institutionId: r.institutionId,
        actorId: r.actorId,
        action: r.action,
        entity: r.entity,
        entityId: r.entityId,
        oldValues: r.oldValues,
        newValues: r.newValues,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        createdAt: r.createdAt,
        actor: r.actor
          ? {
              id: r.actor.id,
              email: r.actor.email,
              profile: r.actor.profile,
            }
          : null,
      })),
      nextCursor,
      total,
    };
  }

  /** Cross-tenant audit read for monitoring (super admin / platform operators). */
  async listForMonitoringInstitution(actor: AuthUser, institutionId: string, query: ListAuditLogsQueryDto) {
    if (
      !actor.permissions.includes('*') &&
      !actor.permissions.includes('institutions.read') &&
      !actor.permissions.includes('institutions.write')
    ) {
      throw new ForbiddenException('Missing monitoring access');
    }
    const exists = await this.repo.countInstitutionById(institutionId);
    if (exists === 0) {
      throw new NotFoundException('Institution not found');
    }
    const limit = query.limit ?? 20;
    let from: Date | undefined;
    let to: Date | undefined;
    if (query.from?.trim()) {
      const d = new Date(query.from.trim());
      if (!Number.isNaN(d.getTime())) {
        from = d;
      }
    }
    if (query.to?.trim()) {
      const d = new Date(query.to.trim());
      if (!Number.isNaN(d.getTime())) {
        to = d;
      }
    }
    const where = this.repo.buildListWhere({
      institutionId,
      entity: query.entity,
      action: query.action,
      entityId: query.entityId,
      from,
      to,
    });
    const rows = await this.repo.findPage(where, limit, query.cursor);
    let nextCursor: string | undefined;
    if (rows.length > limit) {
      const last = rows.pop();
      nextCursor = last?.id;
    }
    const total = await this.repo.countWhere(where);
    return {
      data: rows.map((r) => ({
        id: r.id,
        institutionId: r.institutionId,
        actorId: r.actorId,
        action: r.action,
        entity: r.entity,
        entityId: r.entityId,
        oldValues: r.oldValues,
        newValues: r.newValues,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        createdAt: r.createdAt,
        actor: r.actor
          ? {
              id: r.actor.id,
              email: r.actor.email,
              profile: r.actor.profile,
            }
          : null,
      })),
      nextCursor,
      total,
    };
  }
}
