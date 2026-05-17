import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import type { UpsertFinanceBankIntegrationDto } from './dto/upsert-finance-bank-integration.dto';
import { FinanceRepository } from './finance.repository';

@Injectable()
export class FinanceBankIntegrationsService {
  constructor(
    private readonly repo: FinanceRepository,
    private readonly audit: AuditService,
  ) {}

  private scopeEntityId(actor: AuthUser): string | undefined {
    return actor.entityScope === 'ALL' ? undefined : actor.entityId;
  }

  async list(actor: AuthUser) {
    const rows = await this.repo.listBankIntegrations(
      actor.institutionId,
      this.scopeEntityId(actor),
    );
    return {
      data: rows.map((r) => ({
        id: r.id,
        entityId: r.entityId,
        provider: r.provider,
        isActive: r.isActive,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    };
  }

  async upsert(actor: AuthUser, dto: UpsertFinanceBankIntegrationDto) {
    const entityId =
      actor.entityScope === 'ENTITY' ? actor.entityId : (dto.entityId?.trim() ?? actor.entityId);
    if (!entityId) {
      throw new NotFoundException('entityId is required');
    }
    const row = await this.repo.upsertBankIntegration({
      institutionId: actor.institutionId,
      entityId,
      provider: dto.provider.trim().toLowerCase(),
      config: (dto.config ?? {}) as Prisma.InputJsonValue,
      isActive: dto.isActive ?? true,
      webhookSecret: dto.webhookSecret?.trim() || null,
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'finance.bankIntegration.upsert',
      entity: 'FinanceBankIntegration',
      entityId: row.id,
      newValues: { provider: row.provider, entityId } as Prisma.InputJsonValue,
    });
    return { id: row.id, provider: row.provider, isActive: row.isActive };
  }
}
