import { Injectable } from '@nestjs/common';
import type { InstitutionEntityStatus, InstitutionEntityType, InstitutionStatus, PlanTier, Prisma, TenantModule } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InstitutionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  buildListWhere(args: {
    scopeInstitutionId?: string;
    status?: InstitutionStatus;
    search?: string;
  }): Prisma.InstitutionWhereInput {
    const where: Prisma.InstitutionWhereInput = {
      deletedAt: null,
    };
    if (args.scopeInstitutionId) {
      where.id = args.scopeInstitutionId;
    }
    if (args.status) {
      where.status = args.status;
    }
    if (args.search?.trim()) {
      const q = args.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  findPage(where: Prisma.InstitutionWhereInput, take: number, cursor?: string) {
    return this.prisma.institution.findMany({
      where,
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      include: {
        modules: {
          where: { deletedAt: null },
          orderBy: { module: 'asc' },
        },
      },
    });
  }

  countWhere(where: Prisma.InstitutionWhereInput) {
    return this.prisma.institution.count({ where });
  }

  findById(id: string) {
    return this.prisma.institution.findFirst({
      where: { id, deletedAt: null },
      include: {
        modules: {
          where: { deletedAt: null },
          orderBy: { module: 'asc' },
        },
      },
    });
  }

  findBySlug(slug: string) {
    return this.prisma.institution.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true },
    });
  }

  findByDomain(domain: string, excludeInstitutionId?: string) {
    return this.prisma.institution.findFirst({
      where: {
        domain,
        deletedAt: null,
        ...(excludeInstitutionId ? { NOT: { id: excludeInstitutionId } } : {}),
      },
      select: { id: true },
    });
  }

  create(data: {
    slug: string;
    name: string;
    domain: string | null;
    plan: PlanTier;
    maxStudents: number;
    settings: Prisma.InputJsonValue;
  }) {
    return this.prisma.institution.create({
      data: {
        slug: data.slug,
        name: data.name,
        domain: data.domain,
        plan: data.plan,
        maxStudents: data.maxStudents,
        settings: data.settings,
      },
      include: {
        modules: {
          where: { deletedAt: null },
          orderBy: { module: 'asc' },
        },
      },
    });
  }

  createDefaultModules(institutionId: string, pairs: { module: TenantModule; enabled: boolean }[]) {
    return this.prisma.institutionModule.createMany({
      data: pairs.map((p) => ({
        institutionId,
        module: p.module,
        enabled: p.enabled,
      })),
      skipDuplicates: true,
    });
  }

  update(id: string, data: Prisma.InstitutionUpdateInput) {
    return this.prisma.institution.update({
      where: { id },
      data,
      include: {
        modules: {
          where: { deletedAt: null },
          orderBy: { module: 'asc' },
        },
      },
    });
  }

  syncModuleToggles(
    institutionId: string,
    toggles: { module: TenantModule; enabled: boolean }[],
  ) {
    return this.prisma.$transaction(
      toggles.map((t) =>
        this.prisma.institutionModule.upsert({
          where: {
            institutionId_module: { institutionId, module: t.module },
          },
          create: {
            institutionId,
            module: t.module,
            enabled: t.enabled,
          },
          update: {
            enabled: t.enabled,
            deletedAt: null,
          },
        }),
      ),
    );
  }

  /** Ensures each tenant has a MAIN campus row (Phase 2 provisioning baseline). */
  ensureMainCampusEntity(
    institutionId: string,
    institutionName: string,
    args?: { type?: InstitutionEntityType; status?: InstitutionEntityStatus },
  ) {
    const type = args?.type ?? 'MAIN_CAMPUS';
    const status = args?.status ?? 'ACTIVE';
    return this.prisma.institutionEntity.upsert({
      where: {
        institutionId_code: { institutionId, code: 'MAIN' },
      },
      create: {
        institutionId,
        code: 'MAIN',
        name: `${institutionName} — Main Campus`,
        type,
        status,
      },
      update: {
        name: `${institutionName} — Main Campus`,
        deletedAt: null,
        status,
      },
    });
  }
}
