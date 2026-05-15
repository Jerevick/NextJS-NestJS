import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AppointPositionDto } from './dto/appoint-position.dto';
import type { CreatePositionDto } from './dto/create-position.dto';
import { PositionsRepository } from './positions.repository';
import { assertEntityAccess, assertInstitutionAccess, assertOrgRead, assertOrgWrite } from './org-structure.utils';

@Injectable()
export class PositionsService {
  constructor(
    private readonly repo: PositionsRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthUser, institutionId: string, entityId: string, vacantOnly: boolean) {
    assertOrgRead(actor);
    assertInstitutionAccess(actor, institutionId);
    assertEntityAccess(actor, entityId);
    const rows = vacantOnly
      ? await this.repo.findVacantForEntity(institutionId, entityId)
      : await this.repo.findManyForEntity(institutionId, entityId);
    return { data: rows.map((r) => this.mapPosition(r)) };
  }

  async create(actor: AuthUser, institutionId: string, dto: CreatePositionDto) {
    assertOrgWrite(actor);
    assertInstitutionAccess(actor, institutionId);
    assertEntityAccess(actor, dto.entityId);
    const orgUnit = await this.prisma.orgUnit.findFirst({
      where: { id: dto.orgUnitId, institutionId, entityId: dto.entityId, deletedAt: null },
    });
    if (!orgUnit) {
      throw new NotFoundException('Org unit not found');
    }
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.position.findFirst({
      where: {
        institutionId,
        entityId: dto.entityId,
        orgUnitId: dto.orgUnitId,
        code,
        deletedAt: null,
      },
    });
    if (existing) {
      throw new ConflictException('Position code already exists on this org unit');
    }
    const row = await this.repo.create({
      institutionId,
      entityId: dto.entityId,
      orgUnitId: dto.orgUnitId,
      code,
      title: dto.title.trim(),
      level: dto.level,
      scope: dto.scope,
      permissionBundles: dto.permissionBundles ?? [],
      isUnique: dto.isUnique,
    });
    return this.mapPosition(row);
  }

  async appoint(
    actor: AuthUser,
    institutionId: string,
    entityId: string,
    positionId: string,
    dto: AppointPositionDto,
  ) {
    assertOrgWrite(actor);
    assertInstitutionAccess(actor, institutionId);
    assertEntityAccess(actor, entityId);
    const position = await this.repo.findById(institutionId, entityId, positionId);
    if (!position) {
      throw new NotFoundException('Position not found');
    }
    if (position.isUnique) {
      const active = await this.repo.countActiveHolders(positionId);
      if (active > 0) {
        throw new ConflictException('This position already has an active holder');
      }
    }
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, institutionId, deletedAt: null, isActive: true },
    });
    if (!user) {
      throw new NotFoundException('User not found in this institution');
    }
    const startDate = new Date(dto.startDate);
    const holder = await this.repo.createHolder({
      institutionId,
      entityId,
      positionId,
      userId: dto.userId,
      startDate,
      isActing: dto.isActing ?? false,
      delegatedBy: dto.delegatedBy ?? null,
      appointedById: actor.userId,
    });
    this.audit.append({
      institutionId,
      actorId: actor.userId,
      action: 'position.appoint',
      entity: 'PositionHolder',
      entityId: holder.id,
      newValues: { positionId, userId: dto.userId, startDate: startDate.toISOString() },
    });
    return holder;
  }

  async handover(
    actor: AuthUser,
    institutionId: string,
    entityId: string,
    positionId: string,
    dto: AppointPositionDto,
  ) {
    assertOrgWrite(actor);
    assertInstitutionAccess(actor, institutionId);
    assertEntityAccess(actor, entityId);
    const position = await this.repo.findById(institutionId, entityId, positionId);
    if (!position) {
      throw new NotFoundException('Position not found');
    }
    const endDate = new Date(dto.startDate);
    await this.repo.endActiveHolders(positionId, endDate);
    return this.appoint(actor, institutionId, entityId, positionId, dto);
  }

  private mapPosition(row: {
    id: string;
    code: string;
    title: string;
    level: number;
    scope: string;
    entityId: string;
    permissionBundles: string[];
    isUnique: boolean;
    orgUnit: { id: string; code: string; name: string; type: string };
    holders: Array<{
      id: string;
      userId: string;
      startDate: Date;
      endDate: Date | null;
      isActing: boolean;
      user: { id: string; email: string; role: string; profile: unknown };
    }>;
  }) {
    const holder = row.holders[0];
    const profile = holder?.user.profile as { firstName?: string; lastName?: string } | null;
    const holderName =
      profile?.firstName || profile?.lastName
        ? `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim()
        : holder?.user.email ?? null;
    return {
      id: row.id,
      code: row.code,
      title: row.title,
      level: row.level,
      scope: row.scope,
      entityId: row.entityId,
      permissionBundles: row.permissionBundles,
      isUnique: row.isUnique,
      orgUnit: row.orgUnit,
      isVacant: !holder,
      currentHolder: holder
        ? {
            id: holder.id,
            userId: holder.userId,
            name: holderName,
            email: holder.user.email,
            startDate: holder.startDate.toISOString(),
            isActing: holder.isActing,
          }
        : null,
    };
  }
}
