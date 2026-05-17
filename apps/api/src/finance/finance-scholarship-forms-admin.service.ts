import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { parseDynamicFormSchema } from '../common/forms/dynamic-form.schema';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const SCHOLARSHIP_CYCLE_NAME = 'Scholarship applications (system)';

@Injectable()
export class FinanceScholarshipFormsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async ensureScholarshipCycleId(institutionId: string): Promise<string> {
    const inst = await this.prisma.institution.findFirst({
      where: { id: institutionId, deletedAt: null },
      select: { settings: true },
    });
    const settings =
      inst?.settings && typeof inst.settings === 'object' && !Array.isArray(inst.settings)
        ? (inst.settings as Record<string, unknown>)
        : {};
    const finance =
      settings.finance && typeof settings.finance === 'object' && !Array.isArray(settings.finance)
        ? (settings.finance as Record<string, unknown>)
        : {};
    const existingId =
      typeof finance.scholarshipFormsCycleId === 'string' ? finance.scholarshipFormsCycleId : '';
    if (existingId) {
      const cycle = await this.prisma.admissionCycle.findFirst({
        where: { id: existingId, institutionId, deletedAt: null },
        select: { id: true },
      });
      if (cycle) {
        return cycle.id;
      }
    }

    const byName = await this.prisma.admissionCycle.findFirst({
      where: { institutionId, name: SCHOLARSHIP_CYCLE_NAME, deletedAt: null },
      select: { id: true },
    });
    if (byName) {
      return byName.id;
    }

    const year = await this.prisma.academicYear.findFirst({
      where: { institutionId, deletedAt: null },
      orderBy: { startDate: 'desc' },
      select: { id: true },
    });
    if (!year) {
      throw new NotFoundException('Create an academic year before scholarship application forms');
    }

    const now = new Date();
    const cycle = await this.prisma.admissionCycle.create({
      data: {
        institutionId,
        name: SCHOLARSHIP_CYCLE_NAME,
        academicYearId: year.id,
        applicationOpenDate: now,
        applicationCloseDate: new Date(now.getFullYear() + 5, 11, 31),
        status: 'OPEN',
      },
    });

    await this.prisma.institution.update({
      where: { id: institutionId },
      data: {
        settings: {
          ...settings,
          finance: { ...finance, scholarshipFormsCycleId: cycle.id },
        } as Prisma.InputJsonValue,
      },
    });

    return cycle.id;
  }

  async listForms(actor: AuthUser) {
    const cycleId = await this.ensureScholarshipCycleId(actor.institutionId);
    const rows = await this.prisma.applicationForm.findMany({
      where: { institutionId: actor.institutionId, cycleId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
    return {
      cycleId,
      data: rows.map((r) => ({
        id: r.id,
        schema: r.schema,
        updatedAt: r.updatedAt.toISOString(),
      })),
    };
  }

  async createForm(actor: AuthUser, schema: Record<string, unknown>) {
    const parsed = parseDynamicFormSchema(schema);
    if (!parsed) {
      throw new BadRequestException('Invalid form schema: requires a non-empty fields array');
    }
    const cycleId = await this.ensureScholarshipCycleId(actor.institutionId);
    const row = await this.prisma.applicationForm.create({
      data: {
        institutionId: actor.institutionId,
        cycleId,
        schema: schema as Prisma.InputJsonValue,
      },
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'finance.scholarshipForm.create',
      entity: 'ApplicationForm',
      entityId: row.id,
    });
    return { id: row.id, schema: row.schema };
  }
}
