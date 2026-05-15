import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateOrgUnitDto } from './dto/create-org-unit.dto';
import type { UpdateOrgUnitDto } from './dto/update-org-unit.dto';
import { OrgUnitsRepository } from './org-units.repository';
import {
  assertEntityAccess,
  assertInstitutionAccess,
  assertOrgRead,
  assertOrgWrite,
  buildOrgUnitTree,
} from './org-structure.utils';

@Injectable()
export class OrgUnitsService {
  constructor(
    private readonly repo: OrgUnitsRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getTree(actor: AuthUser, institutionId: string, entityId: string) {
    assertOrgRead(actor);
    assertInstitutionAccess(actor, institutionId);
    assertEntityAccess(actor, entityId);
    await this.assertEntityExists(institutionId, entityId);
    const rows = await this.repo.findManyForEntity(institutionId, entityId);
    return { entityId, tree: buildOrgUnitTree(rows) };
  }

  async getInstitutionTree(actor: AuthUser, institutionId: string) {
    assertOrgRead(actor);
    assertInstitutionAccess(actor, institutionId);
    if (actor.entityScope !== 'ALL') {
      throw new BadRequestException('Institution-wide org tree requires entityScope ALL');
    }
    const entities = await this.prisma.institutionEntity.findMany({
      where: { institutionId, deletedAt: null, status: 'ACTIVE' },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, type: true },
    });
    const result = await Promise.all(
      entities.map(async (entity) => {
        const rows = await this.repo.findManyForEntity(institutionId, entity.id);
        return {
          entity: { id: entity.id, code: entity.code, name: entity.name, type: entity.type },
          tree: buildOrgUnitTree(rows),
        };
      }),
    );
    return { data: result };
  }

  async create(actor: AuthUser, institutionId: string, dto: CreateOrgUnitDto) {
    assertOrgWrite(actor);
    assertInstitutionAccess(actor, institutionId);
    assertEntityAccess(actor, dto.entityId);
    await this.assertEntityExists(institutionId, dto.entityId);
    const code = dto.code.trim().toUpperCase();
    const dup = await this.repo.findByCode(institutionId, dto.entityId, code);
    if (dup) {
      throw new ConflictException('Org unit code already exists on this campus');
    }
    if (dto.parentId) {
      const parent = await this.repo.findById(institutionId, dto.entityId, dto.parentId);
      if (!parent) {
        throw new NotFoundException('Parent org unit not found');
      }
    }
    const row = await this.repo.create({
      institutionId,
      entityId: dto.entityId,
      code,
      name: dto.name.trim(),
      type: dto.type,
      parentId: dto.parentId ?? null,
      sortOrder: dto.sortOrder ?? 0,
    });
    this.audit.append({
      institutionId,
      actorId: actor.userId,
      action: 'org_unit.create',
      entity: 'OrgUnit',
      entityId: row.id,
      newValues: { code: row.code, name: row.name, type: row.type, entityId: row.entityId },
    });
    return row;
  }

  async update(actor: AuthUser, institutionId: string, entityId: string, id: string, dto: UpdateOrgUnitDto) {
    assertOrgWrite(actor);
    assertInstitutionAccess(actor, institutionId);
    assertEntityAccess(actor, entityId);
    const existing = await this.repo.findById(institutionId, entityId, id);
    if (!existing) {
      throw new NotFoundException('Org unit not found');
    }
    const row = await this.repo.update(id, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
    });
    this.audit.append({
      institutionId,
      actorId: actor.userId,
      action: 'org_unit.update',
      entity: 'OrgUnit',
      entityId: id,
      oldValues: { name: existing.name, isActive: existing.isActive },
      newValues: { name: row.name, isActive: row.isActive },
    });
    return row;
  }

  async remove(actor: AuthUser, institutionId: string, entityId: string, id: string) {
    assertOrgWrite(actor);
    assertInstitutionAccess(actor, institutionId);
    assertEntityAccess(actor, entityId);
    const existing = await this.repo.findById(institutionId, entityId, id);
    if (!existing) {
      throw new NotFoundException('Org unit not found');
    }
    const childCount = await this.repo.countActiveChildren(id);
    if (childCount > 0) {
      throw new BadRequestException('Cannot delete org unit with active child units');
    }
    const positionCount = await this.repo.countPositions(id);
    if (positionCount > 0) {
      throw new BadRequestException('Cannot delete org unit with positions — remove positions first');
    }
    await this.repo.softDelete(id);
    this.audit.append({
      institutionId,
      actorId: actor.userId,
      action: 'org_unit.delete',
      entity: 'OrgUnit',
      entityId: id,
    });
    return { ok: true };
  }

  private async assertEntityExists(institutionId: string, entityId: string): Promise<void> {
    const ent = await this.prisma.institutionEntity.findFirst({
      where: { id: entityId, institutionId, deletedAt: null },
      select: { id: true },
    });
    if (!ent) {
      throw new NotFoundException('Campus not found');
    }
  }
}
