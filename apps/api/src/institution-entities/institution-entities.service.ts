import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InstitutionEntityType } from '@prisma/client';
import type { Queue } from 'bullmq';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ENTITY_PROVISIONING_QUEUE } from '../queues/queue.constants';
import type { CreateInstitutionEntityDto } from './dto/create-institution-entity.dto';
import type { UpdateInstitutionEntityDto } from './dto/update-institution-entity.dto';
import { EntityProvisioningService } from './entity-provisioning.service';
import {
  mergeEntitySettings,
  parseEntitySettings,
  type InstitutionEntitySettings,
} from './entity-settings.types';
import {
  defaultBillingForType,
  defaultCouplingForType,
  defaultSettingsForType,
} from './entity-type-defaults';
import { InstitutionEntitiesRepository } from './institution-entities.repository';

export type EntityStatsPayload = {
  activeStudents: number;
  totalStudents: number;
  inactiveStudents: number;
  staffCount: number;
  enrollmentsCurrentAcademicYear: number;
  lastBillableSnapshotAt: string | null;
  storageBytes: number;
};

function assertInstitutionAccess(actor: AuthUser, institutionId: string): void {
  if (actor.permissions.includes('*')) {
    return;
  }
  if (actor.institutionId === institutionId) {
    return;
  }
  throw new ForbiddenException('You may only access your own institution');
}

function assertRead(actor: AuthUser): void {
  if (
    actor.permissions.includes('*') ||
    actor.permissions.includes('institutions.read') ||
    actor.permissions.includes('institutions.write') ||
    actor.permissions.includes('students.read') ||
    actor.permissions.includes('students.write') ||
    actor.permissions.includes('billing.read') ||
    actor.permissions.includes('billing.write')
  ) {
    return;
  }
  throw new ForbiddenException('Missing permission to view institution entities');
}

/** Cross-campus aggregates: full list for institution-wide JWT; single campus for entity-scoped users. */
function entitiesForConsolidatedScope<
  T extends {
    id: string;
  },
>(actor: AuthUser, rows: T[]): T[] {
  if (actor.entityScope === 'ALL') {
    return rows;
  }
  return rows.filter((r) => r.id === actor.entityId);
}

@Injectable()
export class InstitutionEntitiesService {
  constructor(
    private readonly repo: InstitutionEntitiesRepository,
    private readonly prisma: PrismaService,
    private readonly provisioning: EntityProvisioningService,
    @Optional()
    @InjectQueue(ENTITY_PROVISIONING_QUEUE)
    private readonly provisionQueue: Queue | undefined,
  ) {}

  async listForInstitution(actor: AuthUser, institutionId: string) {
    assertRead(actor);
    assertInstitutionAccess(actor, institutionId);
    const rows = entitiesForConsolidatedScope(actor, await this.repo.findManyForInstitution(institutionId));
    const withCounts = await Promise.all(
      rows.map(async (r) => ({
        ...r,
        settings: parseEntitySettings(r.settings),
        billableStudentCount: await this.repo.countBillableStudents(institutionId, r.id),
      })),
    );
    return { data: withCounts };
  }

  async getById(actor: AuthUser, institutionId: string, entityId: string) {
    assertRead(actor);
    assertInstitutionAccess(actor, institutionId);
    if (actor.entityScope === 'ENTITY' && entityId !== actor.entityId) {
      throw new NotFoundException('Institution entity not found');
    }
    const row = await this.repo.findOneInInstitution(institutionId, entityId);
    if (!row) {
      throw new NotFoundException('Institution entity not found');
    }
    const stats = await this.getEntityStats(institutionId, entityId);
    const settings = parseEntitySettings(row.settings);
    return {
      ...row,
      settings,
      ...stats,
      billableStudentCount: stats.activeStudents,
    };
  }

  async getEntityStats(institutionId: string, entityId: string): Promise<EntityStatsPayload> {
    const [snapshotCount, totalStudents, inactiveStudentCount, staffCount, enrollmentsCurrentAcademicYear, lastAt] =
      await Promise.all([
        this.repo.getLatestBillableCount(institutionId, entityId),
        this.repo.countTotalStudentsForEntity(institutionId, entityId),
        this.repo.countInactiveStudentsForEntity(institutionId, entityId),
        this.repo.countDistinctStaffForEntity(institutionId, entityId),
        this.repo.countEnrollmentsCurrentAcademicYearForEntity(institutionId, entityId),
        this.repo.getLatestBillableSnapshotDateForEntity(institutionId, entityId),
      ]);
    const activeStudents =
      snapshotCount !== null ? snapshotCount : await this.repo.countBillableStudents(institutionId, entityId);
    return {
      activeStudents,
      totalStudents,
      inactiveStudents: inactiveStudentCount,
      staffCount,
      enrollmentsCurrentAcademicYear,
      lastBillableSnapshotAt: lastAt?.toISOString() ?? null,
      storageBytes: 0,
    };
  }

  async consolidatedBillable(actor: AuthUser, institutionId: string) {
    assertRead(actor);
    assertInstitutionAccess(actor, institutionId);
    const rows = entitiesForConsolidatedScope(actor, await this.repo.findManyForInstitution(institutionId));
    const entities = await Promise.all(
      rows.map(async (r) => ({
        entityId: r.id,
        code: r.code,
        name: r.name,
        status: r.status,
        billableStudentCount: await this.repo.countBillableStudents(institutionId, r.id),
      })),
    );
    const totalBillableStudents = entities.reduce((acc, e) => acc + e.billableStudentCount, 0);
    return { institutionId, totalBillableStudents, entities };
  }

  async consolidatedStats(actor: AuthUser, institutionId: string) {
    assertRead(actor);
    assertInstitutionAccess(actor, institutionId);
    const rows = entitiesForConsolidatedScope(actor, await this.repo.findManyForInstitution(institutionId));
    const entities = await Promise.all(
      rows.map(async (r) => {
        const stats = await this.getEntityStats(institutionId, r.id);
        return {
          entityId: r.id,
          code: r.code,
          name: r.name,
          type: r.type,
          status: r.status,
          settings: parseEntitySettings(r.settings),
          billableStudentCount: stats.activeStudents,
          inactiveStudentCount: stats.inactiveStudents,
          totalStudentCount: stats.totalStudents,
          staffCount: stats.staffCount,
          enrollmentsCurrentAcademicYear: stats.enrollmentsCurrentAcademicYear,
          lastBillableSnapshotAt: stats.lastBillableSnapshotAt,
        };
      }),
    );
    const institutionTotals = {
      billableStudentCount: entities.reduce((a, e) => a + e.billableStudentCount, 0),
      inactiveStudentCount: entities.reduce((a, e) => a + e.inactiveStudentCount, 0),
      totalStudentCount: entities.reduce((a, e) => a + e.totalStudentCount, 0),
      enrollmentsCurrentAcademicYear: entities.reduce((a, e) => a + e.enrollmentsCurrentAcademicYear, 0),
    };
    return { institutionId, institutionTotals, entities };
  }

  async createEntity(actor: AuthUser, institutionId: string, dto: CreateInstitutionEntityDto) {
    assertInstitutionAccess(actor, institutionId);
    if (actor.entityScope !== 'ALL') {
      throw new ForbiddenException('Creating campuses requires institution-wide (entityScope ALL) context');
    }
    if (!(actor.permissions.includes('*') || actor.permissions.includes('institutions.write'))) {
      throw new ForbiddenException('Missing permission to create campus entities');
    }
    const existing = await this.repo.findManyForInstitution(institutionId);
    const code = dto.code.trim();
    if (existing.some((r) => r.code === code)) {
      throw new BadRequestException('Entity code already exists');
    }
    if (dto.type === InstitutionEntityType.MAIN_CAMPUS) {
      const mainCount = await this.repo.countMainCampusEntities(institutionId);
      if (mainCount >= 1) {
        throw new BadRequestException('Only one MAIN_CAMPUS is allowed per institution');
      }
    }
    const coupling = dto.coupling ?? defaultCouplingForType(dto.type);
    if (dto.type === InstitutionEntityType.AFFILIATE && coupling !== 'EXTERNAL') {
      throw new BadRequestException('AFFILIATE entities must use EXTERNAL coupling');
    }
    const settings = this.buildSettingsForCreate(dto, coupling);
    const created = await this.repo.createForInstitution(institutionId, {
      code,
      name: dto.name.trim(),
      type: dto.type,
      settings,
    });
    if (this.provisionQueue) {
      await this.provisionQueue.add(
        'provision',
        { institutionId, entityId: created.id },
        { attempts: 5, backoff: { type: 'exponential', delay: 4000 }, removeOnComplete: 1000, removeOnFail: 5000 },
      );
    } else {
      await this.provisioning.provisionEntity(institutionId, created.id);
    }
    const row = await this.repo.findOneInInstitution(institutionId, created.id);
    if (!row) {
      throw new NotFoundException('Institution entity not found after create');
    }
    const billableStudentCount = await this.repo.countBillableStudents(institutionId, row.id);
    return {
      ...row,
      billableStudentCount,
      provisioningQueued: Boolean(this.provisionQueue),
    };
  }

  async updateEntity(
    actor: AuthUser,
    institutionId: string,
    entityId: string,
    dto: UpdateInstitutionEntityDto,
  ) {
    assertInstitutionAccess(actor, institutionId);
    if (actor.entityScope !== 'ALL') {
      throw new ForbiddenException('Updating campuses requires institution-wide (entityScope ALL) context');
    }
    if (!(actor.permissions.includes('*') || actor.permissions.includes('institutions.write'))) {
      throw new ForbiddenException('Missing permission to update campus entities');
    }
    const row = await this.repo.findOneInInstitution(institutionId, entityId);
    if (!row) {
      throw new NotFoundException('Institution entity not found');
    }
    const settingsPatch: InstitutionEntitySettings = {
      ...(dto.shortName !== undefined ? { shortName: dto.shortName } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.location !== undefined ? { location: dto.location } : {}),
      ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
      ...(dto.primaryColor !== undefined ? { primaryColor: dto.primaryColor } : {}),
      ...(dto.customDomain !== undefined ? { customDomain: dto.customDomain } : {}),
      ...(dto.settingsPatch !== undefined
        ? (dto.settingsPatch as InstitutionEntitySettings)
        : {}),
    };
    const merged = mergeEntitySettings(row.settings, settingsPatch);
    const result = await this.repo.updateEntity(institutionId, entityId, {
      name: dto.name?.trim(),
      settings: merged as object,
    });
    if (result.count === 0) {
      throw new NotFoundException('Institution entity not found');
    }
    return this.getById(actor, institutionId, entityId);
  }

  async activateEntity(actor: AuthUser, institutionId: string, entityId: string) {
    assertInstitutionAccess(actor, institutionId);
    if (actor.entityScope !== 'ALL') {
      throw new ForbiddenException('Activating campuses requires institution-wide (entityScope ALL) context');
    }
    if (!(actor.permissions.includes('*') || actor.permissions.includes('institutions.write'))) {
      throw new ForbiddenException('Missing permission to activate campus entities');
    }
    const row = await this.repo.findOneInInstitution(institutionId, entityId);
    if (!row) {
      throw new NotFoundException('Institution entity not found');
    }
    if (row.status === 'PROVISIONING') {
      await this.provisioning.provisionEntity(institutionId, entityId);
      return this.getById(actor, institutionId, entityId);
    }
    const result = await this.repo.reactivateEntity(institutionId, entityId);
    if (result.count === 0) {
      throw new BadRequestException('Entity is not suspended or already active');
    }
    return this.getById(actor, institutionId, entityId);
  }

  async suspendEntity(
    actor: AuthUser,
    institutionId: string,
    entityId: string,
    reason?: string,
  ) {
    assertInstitutionAccess(actor, institutionId);
    if (actor.entityScope !== 'ALL') {
      throw new ForbiddenException('Suspending campuses requires institution-wide (entityScope ALL) context');
    }
    if (!(actor.permissions.includes('*') || actor.permissions.includes('institutions.write'))) {
      throw new ForbiddenException('Missing permission to suspend campus entities');
    }
    const row = await this.repo.findOneInInstitution(institutionId, entityId);
    if (!row) {
      throw new NotFoundException('Institution entity not found');
    }
    if (row.code === 'MAIN') {
      throw new BadRequestException('Cannot suspend the MAIN campus entity');
    }
    const activeOnCampus = await this.repo.countBillableStudents(institutionId, entityId);
    if (activeOnCampus > 0) {
      throw new BadRequestException(
        `Cannot suspend campus with ${activeOnCampus} ACTIVE (billable) students. Inactivate or transfer them first.`,
      );
    }
    const result = await this.repo.suspendEntity(institutionId, entityId);
    if (result.count === 0) {
      throw new NotFoundException('Institution entity not found or already suspended');
    }
    if (reason?.trim()) {
      const merged = mergeEntitySettings(row.settings, {
        suspendReason: reason.trim(),
        suspendedAt: new Date().toISOString(),
      });
      await this.repo.updateEntity(institutionId, entityId, { settings: merged as object });
    }
    await this.flushSessionsForEntity(institutionId, entityId);
    return { ok: true as const };
  }

  private buildSettingsForCreate(
    dto: CreateInstitutionEntityDto,
    coupling: InstitutionEntitySettings['coupling'],
  ): object {
    const base = defaultSettingsForType(dto.type);
    const billing = dto.billingClassification ?? defaultBillingForType(dto.type);
    const merged = mergeEntitySettings(base, {
      coupling,
      billingClassification: billing,
      shortName: dto.shortName?.trim(),
      description: dto.description?.trim(),
      ...(dto.settings ?? {}),
    });
    return merged as object;
  }

  private async flushSessionsForEntity(institutionId: string, entityId: string): Promise<void> {
    const studentRows = await this.prisma.student.findMany({
      where: { institutionId, entityId, deletedAt: null },
      select: { userId: true },
    });
    const accessRows = await this.prisma.userEntityAccess.findMany({
      where: {
        entityId,
        user: { institutionId, deletedAt: null },
      },
      select: { userId: true },
    });
    const ids = [
      ...new Set(
        [...studentRows.map((s) => s.userId), ...accessRows.map((a) => a.userId)].filter(
          (id): id is string => id != null,
        ),
      ),
    ];
    if (ids.length === 0) {
      return;
    }
    await this.prisma.user.updateMany({
      where: { id: { in: ids }, institutionId, deletedAt: null },
      data: { sessionVersion: { increment: 1 } },
    });
  }
}
