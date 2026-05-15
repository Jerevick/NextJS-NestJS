import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { ListAuditLogsQueryDto } from '../audit/dto/list-audit-logs-query.dto';
import { AuditService } from '../audit/audit.service';
import { InstitutionHealthService } from '../super-admin/institution-health.service';
import type { ListMonitoringInstitutionsDto } from './dto/list-monitoring-institutions.dto';

function canAccessMonitoring(actor: AuthUser): boolean {
  return (
    actor.permissions.includes('*') ||
    actor.permissions.includes('institutions.read') ||
    actor.permissions.includes('institutions.write')
  );
}

@Injectable()
export class MonitoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly health: InstitutionHealthService,
  ) {}

  async listInstitutions(actor: AuthUser, query: ListMonitoringInstitutionsDto) {
    if (!canAccessMonitoring(actor)) {
      throw new ForbiddenException('Missing institutions.read or institutions.write');
    }

    const limit = query.limit ?? 20;
    const where: Prisma.InstitutionWhereInput = {
      deletedAt: null,
      ...(query.search?.trim()
        ? {
            OR: [
              { name: { contains: query.search.trim(), mode: 'insensitive' } },
              { slug: { contains: query.search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.institution.findMany({
      where,
      take: limit + 1,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        plan: true,
        status: true,
        maxStudents: true,
        currentStudentCount: true,
        createdAt: true,
        _count: { select: { students: true, users: true } },
      },
    });

    let nextCursor: string | undefined;
    const slice = [...rows];
    if (slice.length > limit) {
      const last = slice.pop();
      nextCursor = last?.id;
    }

    const total = await this.prisma.institution.count({ where });

    const data = await Promise.all(
      slice.map(async (r) => {
        const h = await this.health.compute(r.id);
        const anomaly = await this.health.detectAnomalies(r.id);
        return {
          id: r.id,
          slug: r.slug,
          name: r.name,
          plan: r.plan,
          status: r.status,
          maxStudents: r.maxStudents,
          currentStudentCount: r.currentStudentCount,
          studentRecords: r._count.students,
          userAccounts: r._count.users,
          healthScore: h.healthScore,
          anomalyAlert: anomaly.alert,
          headcountDropPct7d: anomaly.dropPct,
          createdAt: r.createdAt,
        };
      }),
    );

    return { data, nextCursor, total };
  }

  async getInstitutionUsage(actor: AuthUser, institutionId: string) {
    if (!canAccessMonitoring(actor)) {
      throw new ForbiddenException('Missing institutions.read or institutions.write');
    }
    const inst = await this.prisma.institution.findFirst({
      where: { id: institutionId, deletedAt: null },
      select: {
        id: true,
        slug: true,
        name: true,
        plan: true,
        status: true,
        maxStudents: true,
        currentStudentCount: true,
        createdAt: true,
        _count: { select: { students: true, users: true } },
      },
    });
    if (!inst) {
      throw new NotFoundException('Institution not found');
    }
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
    const activeLoginsLast30Days = await this.prisma.user.count({
      where: {
        institutionId,
        deletedAt: null,
        lastLoginAt: { gte: thirtyDaysAgo },
      },
    });
    return {
      institution: {
        id: inst.id,
        slug: inst.slug,
        name: inst.name,
        plan: inst.plan,
        status: inst.status,
        maxStudents: inst.maxStudents,
        currentStudentCount: inst.currentStudentCount,
        createdAt: inst.createdAt,
      },
      counts: {
        studentRecords: inst._count.students,
        userAccounts: inst._count.users,
        activeLoginsLast30Days,
      },
      series: [] as { month: string; students: number }[],
      note: 'Historical series and storage/API metrics can be wired to analytics jobs (Phase 11.2).',
    };
  }

  async getInstitutionAuditLog(actor: AuthUser, institutionId: string, query: ListAuditLogsQueryDto) {
    if (!canAccessMonitoring(actor)) {
      throw new ForbiddenException('Missing institutions.read or institutions.write');
    }
    return this.audit.listForMonitoringInstitution(actor, institutionId, query);
  }
}
