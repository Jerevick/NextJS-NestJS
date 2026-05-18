import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { InstitutionStatus, PlanTier, Prisma } from '@prisma/client';
import { TenantModule } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import type { CreateInstitutionDto } from './dto/create-institution.dto';
import type { ListInstitutionsQueryDto } from './dto/list-institutions-query.dto';
import type { UpdateInstitutionModulesDto } from './dto/update-institution-modules.dto';
import type { UpdateInstitutionDto } from './dto/update-institution.dto';
import { packInstitutionAiKeys, readInstitutionAiSettings } from '../ai/ai-institution-settings';
import type { UpdateInstitutionAiDto } from './dto/update-institution-ai.dto';
import { InstitutionsRepository } from './institutions.repository';

function isPlatformOperator(user: AuthUser): boolean {
  return user.permissions.includes('*');
}

function mergeSettings(
  existing: Prisma.JsonValue,
  patch: Record<string, unknown> | undefined,
): Prisma.InputJsonValue {
  if (!patch) {
    return existing === null ? {} : (existing as Prisma.InputJsonValue);
  }
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return { ...base, ...patch } as Prisma.InputJsonValue;
}

@Injectable()
export class InstitutionsService {
  constructor(
    private readonly repo: InstitutionsRepository,
    private readonly audit: AuditService,
  ) {}

  private assertRead(actor: AuthUser) {
    if (actor.permissions.includes('*') || actor.permissions.includes('institutions.read')) {
      return;
    }
    throw new ForbiddenException('Missing institutions.read permission');
  }

  private assertWrite(actor: AuthUser) {
    if (actor.permissions.includes('*') || actor.permissions.includes('institutions.write')) {
      return;
    }
    throw new ForbiddenException('Missing institutions.write permission');
  }

  private assertCanAccessInstitution(actor: AuthUser, institutionId: string) {
    if (isPlatformOperator(actor)) {
      return;
    }
    if (actor.institutionId === institutionId) {
      return;
    }
    throw new ForbiddenException('You may only access your own institution');
  }

  private assertPlatformProvision(actor: AuthUser) {
    if (!isPlatformOperator(actor)) {
      throw new ForbiddenException('Only platform operators can create institutions');
    }
  }

  async list(actor: AuthUser, query: ListInstitutionsQueryDto) {
    this.assertRead(actor);
    const limit = query.limit ?? 20;
    const scopeId = isPlatformOperator(actor) ? undefined : actor.institutionId;
    const where = this.repo.buildListWhere({
      scopeInstitutionId: scopeId,
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
    return { data: rows.map((r) => this.serialize(r)), nextCursor, total };
  }

  async getById(actor: AuthUser, id: string) {
    this.assertRead(actor);
    this.assertCanAccessInstitution(actor, id);
    const row = await this.repo.findById(id);
    if (!row) {
      throw new NotFoundException('Institution not found');
    }
    return this.serialize(row);
  }

  async create(actor: AuthUser, dto: CreateInstitutionDto) {
    this.assertWrite(actor);
    this.assertPlatformProvision(actor);
    const slug = dto.slug.trim().toLowerCase();
    const dup = await this.repo.findBySlug(slug);
    if (dup) {
      throw new ConflictException('An institution with this slug already exists');
    }
    const domain =
      dto.domain === undefined || dto.domain === null || dto.domain === ''
        ? null
        : dto.domain.trim().toLowerCase();
    if (domain) {
      const domainTaken = await this.repo.findByDomain(domain);
      if (domainTaken) {
        throw new ConflictException('This domain is already assigned to an institution');
      }
    }
    const plan = dto.plan ?? ('STARTER' as PlanTier);
    const maxStudents = dto.maxStudents ?? 500;
    const settings = mergeSettings({}, dto.settings as Record<string, unknown> | undefined);
    const row = await this.repo.create({
      slug,
      name: dto.name.trim(),
      domain,
      plan,
      maxStudents,
      settings,
    });
    await this.repo.createDefaultModules(row.id, [
      { module: TenantModule.SIS, enabled: true },
      { module: TenantModule.LMS, enabled: true },
      { module: TenantModule.FINANCE, enabled: false },
      { module: TenantModule.HR, enabled: false },
      { module: TenantModule.ELECTIONS, enabled: true },
      { module: TenantModule.ALUMNI, enabled: false },
      { module: TenantModule.SPORTS, enabled: false },
      { module: TenantModule.MEETINGS, enabled: true },
    ]);
    await this.repo.ensureMainCampusEntity(row.id, row.name);
    const withModules = await this.repo.findById(row.id);
    this.audit.append({
      institutionId: row.id,
      actorId: actor.userId,
      action: 'institution.create',
      entity: 'Institution',
      entityId: row.id,
      newValues: { slug: row.slug, name: row.name, plan: row.plan },
    });
    return this.serialize(withModules!);
  }

  async update(actor: AuthUser, id: string, dto: UpdateInstitutionDto) {
    this.assertWrite(actor);
    this.assertCanAccessInstitution(actor, id);
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException('Institution not found');
    }
    if (dto.slug !== undefined && dto.slug.trim().toLowerCase() !== existing.slug) {
      const other = await this.repo.findBySlug(dto.slug.trim().toLowerCase());
      if (other && other.id !== existing.id) {
        throw new ConflictException('An institution with this slug already exists');
      }
    }
    if (dto.domain !== undefined && dto.domain !== null && String(dto.domain).trim() !== '') {
      const d = String(dto.domain).trim().toLowerCase();
      const taken = await this.repo.findByDomain(d, existing.id);
      if (taken) {
        throw new ConflictException('This domain is already assigned to an institution');
      }
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
    if (dto.settings !== undefined) {
      data.settings = mergeSettings(existing.settings, dto.settings);
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    const updated = await this.repo.update(existing.id, data);
    this.audit.append({
      institutionId: id,
      actorId: actor.userId,
      action: 'institution.update',
      entity: 'Institution',
      entityId: id,
      oldValues: {
        slug: existing.slug,
        name: existing.name,
        status: existing.status,
        plan: existing.plan,
        maxStudents: existing.maxStudents,
      },
      newValues: {
        slug: updated.slug,
        name: updated.name,
        status: updated.status,
        plan: updated.plan,
        maxStudents: updated.maxStudents,
      },
    });
    return this.serialize(updated);
  }

  async updateModules(actor: AuthUser, id: string, dto: UpdateInstitutionModulesDto) {
    this.assertWrite(actor);
    this.assertCanAccessInstitution(actor, id);
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException('Institution not found');
    }
    await this.repo.syncModuleToggles(
      id,
      dto.modules.map((m) => ({ module: m.module, enabled: m.enabled })),
    );
    const row = await this.repo.findById(id);
    this.audit.append({
      institutionId: id,
      actorId: actor.userId,
      action: 'institution.modules_update',
      entity: 'Institution',
      entityId: id,
      newValues: {
        modules: dto.modules.map((m) => ({ module: m.module, enabled: m.enabled })),
      } as Prisma.InputJsonValue,
    });
    return this.serialize(row!);
  }

  async getAiSettings(actor: AuthUser, id: string) {
    this.assertRead(actor);
    this.assertCanAccessInstitution(actor, id);
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Institution not found');
    const cfg = readInstitutionAiSettings(existing.settings);
    return {
      aiProvider: cfg.aiProvider ?? null,
      hasOpenAiKey: Boolean(cfg.openaiApiKey),
      hasAnthropicKey: Boolean(cfg.anthropicApiKey),
      dailyTokenLimit: cfg.dailyTokenLimit ?? null,
      tutorDailyTokenLimit: cfg.tutorDailyTokenLimit ?? null,
    };
  }

  async updateAiSettings(actor: AuthUser, id: string, dto: UpdateInstitutionAiDto) {
    this.assertWrite(actor);
    this.assertCanAccessInstitution(actor, id);
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Institution not found');
    const current = readInstitutionAiSettings(existing.settings);
    const base =
      existing.settings &&
      typeof existing.settings === 'object' &&
      !Array.isArray(existing.settings)
        ? (existing.settings as Record<string, unknown>)
        : {};
    const aiBlock: Record<string, unknown> = {
      ...((base.ai as Record<string, unknown>) ?? {}),
    };
    if (dto.aiProvider !== undefined) aiBlock.aiProvider = dto.aiProvider;
    if (dto.dailyTokenLimit !== undefined) aiBlock.dailyTokenLimit = dto.dailyTokenLimit;
    if (dto.tutorDailyTokenLimit !== undefined) {
      aiBlock.tutorDailyTokenLimit = dto.tutorDailyTokenLimit;
    }
    if (dto.openaiApiKey !== undefined || dto.anthropicApiKey !== undefined) {
      aiBlock.keys = packInstitutionAiKeys({
        openaiApiKey: dto.openaiApiKey ?? current.openaiApiKey,
        anthropicApiKey: dto.anthropicApiKey ?? current.anthropicApiKey,
      });
    }
    const updated = await this.repo.update(existing.id, {
      settings: { ...base, ai: aiBlock } as Prisma.InputJsonValue,
    });
    return this.getAiSettings(actor, updated.id);
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
      contractStartDate: row.contractStartDate,
      contractEndDate: row.contractEndDate,
      maxStudents: row.maxStudents,
      currentStudentCount: row.currentStudentCount,
      modules: row.modules.map((m) => ({ id: m.id, module: m.module, enabled: m.enabled })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
