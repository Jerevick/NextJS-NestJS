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
import { MailService } from '../mail/mail.service';
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
import { randomBytes } from 'node:crypto';

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

type RegistrationProvisionPayload = {
  institutionName?: string;
  institutionEmail?: string;
  contactName?: string;
  estimatedStudents?: string;
  corePackages?: string[];
  modulesEffective?: string[];
  contact?: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    email?: string;
  };
};

type LockedRegistrationProvisioning = {
  requestId: string;
  payload: RegistrationProvisionPayload;
  name: string;
  plan: PlanTier;
  adminEmail: string;
  adminFirstName?: string;
  adminLastName?: string;
  maxStudents?: number;
  modules: Array<{ module: TenantModule; enabled: boolean }>;
};

function moduleFromString(value: string): TenantModule | null {
  return Object.values(TenantModule).includes(value as TenantModule)
    ? (value as TenantModule)
    : null;
}

function modulesFromRegistrationPayload(
  payload: RegistrationProvisionPayload,
): Array<{ module: TenantModule; enabled: boolean }> {
  const core = (payload.corePackages ?? [])
    .map(moduleFromString)
    .filter(
      (module): module is TenantModule =>
        module === TenantModule.SIS || module === TenantModule.LMS,
    );
  if (core.length > 0) {
    return buildInstitutionModulePairs(core);
  }

  const effectiveCore = (payload.modulesEffective ?? [])
    .map(moduleFromString)
    .filter(
      (module): module is TenantModule =>
        module === TenantModule.SIS || module === TenantModule.LMS,
    );
  return buildInstitutionModulePairs(
    effectiveCore.length > 0 ? effectiveCore : [TenantModule.SIS, TenantModule.LMS],
  );
}

function modulesFromProvisionSelection(
  modules: ProvisionInstitutionDto['modules'],
): Array<{ module: TenantModule; enabled: boolean }> | undefined {
  if (!modules || modules.length === 0) {
    return undefined;
  }
  const enabled = modules.filter((item) => item.enabled !== false).map((item) => item.module);
  const invalid = enabled.filter(
    (module) => module !== TenantModule.SIS && module !== TenantModule.LMS,
  );
  if (invalid.length > 0) {
    throw new BadRequestException('Only SIS, LMS, or both can be selected during provisioning');
  }
  const core = enabled.filter(
    (module): module is TenantModule => module === TenantModule.SIS || module === TenantModule.LMS,
  );
  if (core.length === 0) {
    throw new BadRequestException('Select SIS, LMS, or both');
  }
  return buildInstitutionModulePairs(core);
}

function maxStudentsFromRange(value: string | undefined): number | undefined {
  if (value === 'under-500') {
    return 500;
  }
  if (value === '500-2000') {
    return 2_000;
  }
  if (value === '2000-10000' || value === '10000-plus') {
    return 10_000;
  }
  return undefined;
}

function planFromEstimatedStudents(value: string | undefined): PlanTier {
  if (value === '500-2000') {
    return PlanTier.GROWTH;
  }
  if (value === '2000-10000' || value === '10000-plus') {
    return PlanTier.ENTERPRISE;
  }
  return PlanTier.STARTER;
}

function splitContactName(payload: RegistrationProvisionPayload): {
  firstName?: string;
  lastName?: string;
} {
  const fullName =
    payload.contact?.fullName?.trim() ||
    [payload.contact?.firstName, payload.contact?.lastName].filter(Boolean).join(' ').trim() ||
    payload.contactName?.trim() ||
    '';
  const parts = fullName.split(/\s+/).filter(Boolean);
  return {
    firstName: payload.contact?.firstName?.trim() || parts[0],
    lastName:
      payload.contact?.lastName?.trim() ||
      (parts.length > 1 ? parts.slice(1).join(' ') : undefined),
  };
}

function readableSlugBase(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 48)
    .replace(/-+$/g, '');
  return slug || 'institution';
}

function withSlugSuffix(base: string, suffix: number): string {
  if (suffix <= 1) {
    return base;
  }
  const suffixText = `-${suffix}`;
  return `${base.slice(0, 48 - suffixText.length).replace(/-+$/g, '')}${suffixText}`;
}

function generateTemporaryPassword(): string {
  return `Uc-${randomBytes(18).toString('base64url')}-1a!`;
}

function uniqueValidEmails(...values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    const email = value?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      continue;
    }
    seen.add(email);
  }
  return [...seen];
}

function addTrialMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

@Injectable()
export class SuperAdminInstitutionsService {
  constructor(
    private readonly repo: InstitutionsRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly health: InstitutionHealthService,
    private readonly provisioning: EntityProvisioningService,
    private readonly tenantModules: TenantModulesService,
    private readonly mail: MailService,
  ) {}

  private webPublicBase(): string {
    return (
      process.env.WEB_PUBLIC_URL?.trim() ??
      process.env.NEXT_PUBLIC_WEB_URL?.trim() ??
      'http://localhost:3000'
    ).replace(/\/$/, '');
  }

  private async emailTemporaryAdminPassword(args: {
    recipients: string[];
    institutionName: string;
    institutionSlug: string;
    adminEmail: string;
    temporaryPassword: string;
  }): Promise<void> {
    if (args.recipients.length === 0) {
      return;
    }
    const loginUrl = `${this.webPublicBase()}/login?institution=${encodeURIComponent(args.institutionSlug)}`;
    const subject = `UniCore access ready — ${args.institutionName}`;
    const text = [
      `UniCore provisioning is complete for ${args.institutionName}.`,
      '',
      `Admin email: ${args.adminEmail}`,
      `Temporary password: ${args.temporaryPassword}`,
      `Sign in: ${loginUrl}`,
      '',
      'This is a temporary password. The institution administrator must change it at first sign-in before using the system.',
      '',
      '— The UniCore platform team',
    ].join('\n');
    const html = `<p>UniCore provisioning is complete for <strong>${args.institutionName}</strong>.</p>
      <p><strong>Admin email</strong><br/>${args.adminEmail}</p>
      <p><strong>Temporary password</strong><br/><code>${args.temporaryPassword}</code></p>
      <p><a href="${loginUrl}">Sign in to UniCore</a></p>
      <p>This is a temporary password. The institution administrator must change it at first sign-in before using the system.</p>
      <p>&mdash; The UniCore platform team</p>`;

    await Promise.all(
      args.recipients.map((recipient) => this.mail.sendEmail(recipient, subject, text, html)),
    );
  }

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
    const openDisputes = await this.prisma.billingDispute.count({
      where: {
        institutionId: id,
        deletedAt: null,
        status: { in: ['OPEN', 'MANUAL_REVIEW'] },
      },
    });
    const activeStudentCount = entities.reduce((sum, entity) => sum + entity._count.students, 0);
    return {
      ...this.serialize(row),
      minimumBillableCount: row.minimumBillableCount,
      billingDayOfMonth: row.billingDayOfMonth,
      disputeWindowDays: row.disputeWindowDays,
      health: {
        ...h,
        billableStudents: row.currentStudentCount,
        activeStudents: activeStudentCount,
        openDisputes,
        activeModules: row.modules.filter((m) => m.enabled).map((m) => m.module),
      },
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
    const locked = await this.resolveRegistrationProvisioningLock(dto.registrationRequestId);
    const name = locked?.name ?? dto.name.trim();
    const slug = await this.generateUniqueInstitutionSlug(name);
    const domain =
      dto.domain === undefined || dto.domain === null || dto.domain === ''
        ? null
        : dto.domain.trim().toLowerCase();
    if (domain && (await this.repo.findByDomain(domain))) {
      throw new ConflictException('Domain already assigned');
    }

    const plan = locked?.plan ?? dto.plan ?? PlanTier.STARTER;
    const modules =
      locked?.modules ??
      modulesFromProvisionSelection(dto.modules) ??
      buildInstitutionModulePairs([TenantModule.SIS, TenantModule.LMS]);
    const maxStudents = locked?.maxStudents ?? dto.maxStudents ?? 500;
    const adminEmail = (locked?.adminEmail ?? dto.adminEmail).trim().toLowerCase();
    const adminFirstName = locked?.adminFirstName ?? dto.adminFirstName;
    const adminLastName = locked?.adminLastName ?? dto.adminLastName;
    const temporaryPassword = generateTemporaryPassword();
    const temporaryPasswordRecipients = uniqueValidEmails(
      adminEmail,
      locked?.payload.institutionEmail,
      locked?.payload.contact?.email,
    );
    const trialStartsAt = new Date();
    const trialEndsAt = addTrialMonths(trialStartsAt, 3);
    const settings = {
      ...(dto.settings ?? {}),
      trialMonths: 3,
      billingBasis: 'ACTIVE_STUDENTS_ANNUAL',
      ...(locked
        ? {
            provisionedFromRegistrationRequestId: locked.requestId,
            lockedRegistrationPayload: locked.payload,
          }
        : {}),
    };

    const institution = await this.prisma.$transaction(async (tx) => {
      const inst = await tx.institution.create({
        data: {
          slug,
          name,
          domain,
          plan,
          status: InstitutionStatus.TRIAL,
          contractStartDate: trialStartsAt,
          contractEndDate: trialEndsAt,
          maxStudents,
          minimumBillableCount: null,
          billingDayOfMonth: dto.billingDayOfMonth ?? 1,
          disputeWindowDays: dto.disputeWindowDays ?? 14,
          settings: settings as Prisma.InputJsonValue,
        },
      });

      if (locked) {
        await tx.registrationRequest.update({
          where: { id: locked.requestId },
          data: { institutionId: inst.id, status: 'PROVISIONED' },
        });
      }

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
          billingCycle: BillingCycle.ANNUAL,
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

      const passwordHash = await bcrypt.hash(temporaryPassword, 12);
      const adminUser = await tx.user.create({
        data: {
          institutionId: inst.id,
          email: adminEmail,
          passwordHash,
          role: UserRole.STAFF,
          profile: {
            firstName: adminFirstName?.trim() ?? 'Institution',
            lastName: adminLastName?.trim() ?? 'Admin',
            forcePasswordChange: true,
            temporaryPasswordIssuedAt: new Date().toISOString(),
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

    await this.emailTemporaryAdminPassword({
      recipients: temporaryPasswordRecipients,
      institutionName: institution.inst.name,
      institutionSlug: institution.inst.slug,
      adminEmail,
      temporaryPassword,
    });

    this.audit.append({
      institutionId: institution.inst.id,
      actorId: actor.userId,
      action: 'super_admin.institution.provisioned',
      entity: 'Institution',
      entityId: institution.inst.id,
      newValues: {
        slug,
        adminEmail,
        mainEntityId: institution.mainEntityId,
        registrationRequestId: locked?.requestId ?? null,
      },
    });

    return {
      institutionId: institution.inst.id,
      slug: institution.inst.slug,
      mainEntityId: institution.mainEntityId,
      adminUserId: institution.adminUserId,
    };
  }

  private async generateUniqueInstitutionSlug(name: string): Promise<string> {
    const base = readableSlugBase(name);
    for (let suffix = 1; suffix <= 200; suffix += 1) {
      const candidate = withSlugSuffix(base, suffix);
      if (!(await this.repo.findBySlug(candidate))) {
        return candidate;
      }
    }

    const fallback = `${base.slice(0, 39).replace(/-+$/g, '')}-${Date.now().toString(36)}`;
    if (!(await this.repo.findBySlug(fallback))) {
      return fallback;
    }
    throw new ConflictException('Could not generate a unique institution slug');
  }

  private async resolveRegistrationProvisioningLock(
    requestId: string | undefined,
  ): Promise<LockedRegistrationProvisioning | null> {
    if (!requestId?.trim()) {
      return null;
    }
    const request = await this.prisma.registrationRequest.findUnique({
      where: { id: requestId.trim() },
    });
    if (!request) {
      throw new BadRequestException('Registration request not found');
    }
    if (request.kind !== 'NEW_INSTITUTION') {
      throw new BadRequestException('Only new institution registrations can provision tenants');
    }
    if (request.status !== 'REVIEWED') {
      throw new BadRequestException('Registration request must be approved before provisioning');
    }
    if (request.institutionId) {
      throw new BadRequestException('Registration request has already been provisioned');
    }

    const payload = (request.payload ?? {}) as RegistrationProvisionPayload;
    const name = payload.institutionName?.trim();
    if (!name) {
      throw new BadRequestException('Registration request is missing institution name');
    }
    const adminEmail = (payload.contact?.email ?? request.email).trim().toLowerCase();
    if (!adminEmail) {
      throw new BadRequestException('Registration request is missing contact email');
    }
    const contact = splitContactName(payload);

    return {
      requestId: request.id,
      payload,
      name,
      plan: planFromEstimatedStudents(payload.estimatedStudents),
      adminEmail,
      adminFirstName: contact.firstName,
      adminLastName: contact.lastName,
      maxStudents: maxStudentsFromRange(payload.estimatedStudents),
      modules: modulesFromRegistrationPayload(payload),
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
