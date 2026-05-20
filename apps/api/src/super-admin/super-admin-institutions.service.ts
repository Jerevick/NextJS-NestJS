import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BillingCycle,
  InstitutionEntityStatus,
  InstitutionStatus,
  PlanTier,
  Prisma,
  TenantModule,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { EntityProvisioningService } from '../institution-entities/entity-provisioning.service';
import { buildInstitutionModulePairs } from '../common/tenant-modules/tenant-module-packages';
import { TenantModulesService } from '../common/tenant-modules/tenant-modules.service';
import { InstitutionsRepository } from '../institutions/institutions.repository';
import { PrismaService } from '../prisma/prisma.service';
import type { ListInstitutionsQueryDto } from '../institutions/dto/list-institutions-query.dto';
import type { UpdateInstitutionDto } from '../institutions/dto/update-institution.dto';
import { InstitutionHealthService } from './institution-health.service';
import type { ProvisionInstitutionDto } from './dto/provision-institution.dto';
import type { UpdateInstitutionBillingConfigDto } from './dto/update-institution-billing-config.dto';

const VC_PERMISSION_CODES = [
  'institutions.read',
  'institutions.write',
  'students.read',
  'students.write',
  'billing.read',
  'billing.write',
  'org.read',
  'org.write',
  'workflow.read',
  'workflow.act',
  'audit.read',
] as const;

@Injectable()
export class SuperAdminInstitutionsService {
  constructor(
    private readonly repo: InstitutionsRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly health: InstitutionHealthService,
    private readonly provisioning: EntityProvisioningService,
    private readonly tenantModules: TenantModulesService,
  ) {}

  async list(query: ListInstitutionsQueryDto) {
    const limit = query.limit ?? 20;
    const where = this.repo.buildListWhere({
      status: query.status,
      search: query.search,
    });
    const rows = await this.repo.findPage(where, limit, query.cursor);
    let nextCursor: string | undefined;
    if (rows.length > limit) {
      const last = rows.pop();
      nextCursor = last?.id;
    }
    const total = await this.repo.countWhere(where);

    const data = await Promise.all(
      rows.map(async (r) => {
        const h = await this.health.compute(r.id);
        const anomaly = await this.health.detectAnomalies(r.id);
        const entityCount = await this.prisma.institutionEntity.count({
          where: { institutionId: r.id, deletedAt: null },
        });
        const openDisputes = await this.prisma.billingDispute.count({
          where: {
            institutionId: r.id,
            deletedAt: null,
            status: { in: ['OPEN', 'MANUAL_REVIEW'] },
          },
        });
        return {
          id: r.id,
          slug: r.slug,
          name: r.name,
          plan: r.plan,
          status: r.status,
          maxStudents: r.maxStudents,
          currentStudentCount: r.currentStudentCount,
          entityCount,
          openDisputes,
          healthScore: h.healthScore,
          health: h,
          anomalyAlert: anomaly.alert,
          headcountDropPct7d: anomaly.dropPct,
          createdAt: r.createdAt,
        };
      }),
    );

    return { data, nextCursor, total };
  }

  async getDetail(id: string) {
    const row = await this.repo.findById(id);
    if (!row) {
      throw new NotFoundException('Institution not found');
    }
    const h = await this.health.compute(id);
    const entities = await this.prisma.institutionEntity.findMany({
      where: { institutionId: id, deletedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        status: true,
        settings: true,
        _count: {
          select: {
            students: { where: { deletedAt: null, enrollmentStatus: 'ACTIVE' } },
          },
        },
      },
      orderBy: { code: 'asc' },
    });
    const subscription = await this.prisma.subscription.findFirst({
      where: { institutionId: id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return {
      ...this.serialize(row),
      minimumBillableCount: row.minimumBillableCount,
      billingDayOfMonth: row.billingDayOfMonth,
      disputeWindowDays: row.disputeWindowDays,
      health: h,
      entities: entities.map((e) => ({
        id: e.id,
        code: e.code,
        name: e.name,
        type: e.type,
        status: e.status,
        activeStudentCount: e._count.students,
      })),
      subscription: subscription
        ? {
            id: subscription.id,
            planId: subscription.planId,
            billingCycle: subscription.billingCycle,
            amount: subscription.amount.toString(),
            currency: subscription.currency,
          }
        : null,
    };
  }

  async provision(actor: AuthUser, dto: ProvisionInstitutionDto) {
    const slug = dto.slug.trim().toLowerCase();
    if (await this.repo.findBySlug(slug)) {
      throw new ConflictException('An institution with this slug already exists');
    }
    const domain =
      dto.domain === undefined || dto.domain === null || dto.domain === ''
        ? null
        : dto.domain.trim().toLowerCase();
    if (domain && (await this.repo.findByDomain(domain))) {
      throw new ConflictException('Domain already assigned');
    }

    const plan = dto.plan ?? PlanTier.STARTER;
    const modules =
      dto.modules ?? buildInstitutionModulePairs([TenantModule.SIS, TenantModule.LMS]);

    const institution = await this.prisma.$transaction(async (tx) => {
      const inst = await tx.institution.create({
        data: {
          slug,
          name: dto.name.trim(),
          domain,
          plan,
          status: InstitutionStatus.TRIAL,
          maxStudents: dto.maxStudents ?? 500,
          minimumBillableCount: dto.minimumBillableCount ?? null,
          billingDayOfMonth: dto.billingDayOfMonth ?? 1,
          disputeWindowDays: dto.disputeWindowDays ?? 14,
          settings: (dto.settings ?? {}) as Prisma.InputJsonValue,
        },
      });

      await tx.institutionModule.createMany({
        data: modules.map((m) => ({
          institutionId: inst.id,
          module: m.module,
          enabled: m.enabled,
        })),
        skipDuplicates: true,
      });

      const mainEntity = await tx.institutionEntity.create({
        data: {
          institutionId: inst.id,
          code: 'MAIN',
          name: `${inst.name} — Main Campus`,
          type: 'MAIN_CAMPUS',
          status: InstitutionEntityStatus.PROVISIONING,
        },
      });

      const amount = dto.subscriptionAmount
        ? new Prisma.Decimal(dto.subscriptionAmount)
        : new Prisma.Decimal('0');
      await tx.subscription.create({
        data: {
          institutionId: inst.id,
          planId: plan.toLowerCase(),
          billingCycle: dto.billingCycle ?? BillingCycle.MONTHLY,
          amount,
          currency: 'USD',
        },
      });

      const role = await tx.role.create({
        data: {
          institutionId: inst.id,
          code: 'INSTITUTION_ADMIN',
          name: 'Institution Administrator',
        },
      });
      const perms = await tx.permission.findMany({
        where: { code: { in: [...VC_PERMISSION_CODES] } },
        select: { id: true },
      });
      if (perms.length > 0) {
        await tx.rolePermission.createMany({
          data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
        });
      }

      const passwordHash = await bcrypt.hash(dto.adminPassword, 12);
      const adminUser = await tx.user.create({
        data: {
          institutionId: inst.id,
          email: dto.adminEmail.trim().toLowerCase(),
          passwordHash,
          role: UserRole.STAFF,
          profile: {
            firstName: dto.adminFirstName?.trim() ?? 'Institution',
            lastName: dto.adminLastName?.trim() ?? 'Admin',
          },
          isActive: true,
        },
      });
      await tx.userRoleAssignment.create({
        data: { userId: adminUser.id, roleId: role.id },
      });

      return { inst, mainEntityId: mainEntity.id, adminUserId: adminUser.id };
    });

    await this.provisioning.provisionEntity(institution.inst.id, institution.mainEntityId);
    await this.tenantModules.syncSisLmsBridge(institution.inst.id);

    this.audit.append({
      institutionId: institution.inst.id,
      actorId: actor.userId,
      action: 'super_admin.institution.provisioned',
      entity: 'Institution',
      entityId: institution.inst.id,
      newValues: {
        slug,
        adminEmail: dto.adminEmail,
        mainEntityId: institution.mainEntityId,
      },
    });

    return {
      institutionId: institution.inst.id,
      slug: institution.inst.slug,
      mainEntityId: institution.mainEntityId,
      adminUserId: institution.adminUserId,
    };
  }

  async update(id: string, dto: UpdateInstitutionDto, actor: AuthUser) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException('Institution not found');
    }
    const data: Prisma.InstitutionUpdateInput = {};
    if (dto.slug !== undefined) {
      data.slug = dto.slug.trim().toLowerCase();
    }
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.domain !== undefined) {
      data.domain =
        dto.domain === null || dto.domain === '' ? null : String(dto.domain).trim().toLowerCase();
    }
    if (dto.plan !== undefined) {
      data.plan = dto.plan;
    }
    if (dto.status !== undefined) {
      data.status = dto.status as InstitutionStatus;
    }
    if (dto.maxStudents !== undefined) {
      data.maxStudents = dto.maxStudents;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    const updated = await this.repo.update(id, data);
    this.audit.append({
      institutionId: id,
      actorId: actor.userId,
      action: 'super_admin.institution.update',
      entity: 'Institution',
      entityId: id,
      newValues: data as Prisma.InputJsonValue,
    });
    return this.serialize(updated);
  }

  async updateBillingConfig(id: string, dto: UpdateInstitutionBillingConfigDto, actor: AuthUser) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException('Institution not found');
    }
    const updated = await this.repo.update(id, {
      ...(dto.minimumBillableCount !== undefined
        ? { minimumBillableCount: dto.minimumBillableCount }
        : {}),
      ...(dto.billingDayOfMonth !== undefined ? { billingDayOfMonth: dto.billingDayOfMonth } : {}),
      ...(dto.disputeWindowDays !== undefined ? { disputeWindowDays: dto.disputeWindowDays } : {}),
    });
    this.audit.append({
      institutionId: id,
      actorId: actor.userId,
      action: 'super_admin.institution.billing_config',
      entity: 'Institution',
      entityId: id,
      newValues: dto as Prisma.InputJsonValue,
    });
    return {
      id: updated.id,
      minimumBillableCount: updated.minimumBillableCount,
      billingDayOfMonth: updated.billingDayOfMonth,
      disputeWindowDays: updated.disputeWindowDays,
    };
  }

  async suspend(id: string, actor: AuthUser, reason?: string) {
    const inst = await this.repo.findById(id);
    if (!inst) {
      throw new NotFoundException('Institution not found');
    }
    await this.prisma.institution.update({
      where: { id },
      data: { status: InstitutionStatus.SUSPENDED },
    });
    await this.prisma.user.updateMany({
      where: { institutionId: id, deletedAt: null },
      data: { isActive: false, sessionVersion: { increment: 1 } },
    });
    this.audit.append({
      institutionId: id,
      actorId: actor.userId,
      action: 'super_admin.institution.suspended',
      entity: 'Institution',
      entityId: id,
      newValues: { reason: reason?.trim() ?? null },
    });
    return { ok: true as const, status: InstitutionStatus.SUSPENDED };
  }

  async activate(id: string, actor: AuthUser) {
    const inst = await this.repo.findById(id);
    if (!inst) {
      throw new NotFoundException('Institution not found');
    }
    await this.prisma.institution.update({
      where: { id },
      data: { status: InstitutionStatus.ACTIVE },
    });
    this.audit.append({
      institutionId: id,
      actorId: actor.userId,
      action: 'super_admin.institution.activated',
      entity: 'Institution',
      entityId: id,
    });
    return { ok: true as const, status: InstitutionStatus.ACTIVE };
  }

  private serialize(row: NonNullable<Awaited<ReturnType<InstitutionsRepository['findById']>>>) {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      domain: row.domain,
      plan: row.plan,
      status: row.status,
      settings: row.settings,
      maxStudents: row.maxStudents,
      currentStudentCount: row.currentStudentCount,
      modules: row.modules.map((m) => ({ module: m.module, enabled: m.enabled })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
