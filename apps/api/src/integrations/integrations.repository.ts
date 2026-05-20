import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IntegrationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findIntegration(institutionId: string, code: string, entityId: string | null) {
    return this.prisma.institutionIntegration.findFirst({
      where: {
        institutionId,
        code,
        entityId: entityId ?? null,
        deletedAt: null,
      },
    });
  }

  listIntegrations(institutionId: string, entityId?: string | null) {
    return this.prisma.institutionIntegration.findMany({
      where: {
        institutionId,
        deletedAt: null,
        ...(entityId !== undefined ? { entityId: entityId ?? null } : {}),
      },
      orderBy: { code: 'asc' },
    });
  }

  async upsertIntegration(data: {
    institutionId: string;
    entityId: string | null;
    code: string;
    enabled: boolean;
    settings: Record<string, unknown>;
    configuredAt: Date | null;
  }) {
    const settings = data.settings as Prisma.InputJsonValue;
    const existing = await this.findIntegration(data.institutionId, data.code, data.entityId);
    if (existing) {
      return this.prisma.institutionIntegration.update({
        where: { id: existing.id },
        data: {
          enabled: data.enabled,
          settings,
          configuredAt: data.configuredAt,
          deletedAt: null,
        },
      });
    }
    return this.prisma.institutionIntegration.create({
      data: {
        institutionId: data.institutionId,
        entityId: data.entityId,
        code: data.code,
        enabled: data.enabled,
        settings,
        configuredAt: data.configuredAt,
      },
    });
  }

  softDisableIntegration(institutionId: string, code: string, entityId: string | null) {
    return this.prisma.institutionIntegration.updateMany({
      where: { institutionId, code, entityId: entityId ?? null, deletedAt: null },
      data: { enabled: false, configuredAt: null },
    });
  }

  listWebhooks(
    institutionId: string,
    entityId: string | null | undefined,
    take: number,
    cursor?: string,
  ) {
    return this.prisma.institutionWebhook.findMany({
      where: {
        institutionId,
        deletedAt: null,
        ...(entityId !== undefined ? { entityId: entityId ?? null } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
  }

  findWebhook(institutionId: string, webhookId: string) {
    return this.prisma.institutionWebhook.findFirst({
      where: { id: webhookId, institutionId, deletedAt: null },
    });
  }

  createWebhook(data: {
    institutionId: string;
    entityId: string | null;
    event: string;
    url: string;
    secret: string;
  }) {
    return this.prisma.institutionWebhook.create({ data });
  }

  updateWebhook(
    institutionId: string,
    webhookId: string,
    patch: { url?: string; enabled?: boolean; event?: string },
  ) {
    return this.prisma.institutionWebhook.updateMany({
      where: { id: webhookId, institutionId, deletedAt: null },
      data: patch,
    });
  }

  softDeleteWebhook(institutionId: string, webhookId: string) {
    return this.prisma.institutionWebhook.updateMany({
      where: { id: webhookId, institutionId, deletedAt: null },
      data: { deletedAt: new Date(), enabled: false },
    });
  }

  findWebhooksForEvent(institutionId: string, event: string, entityId?: string | null) {
    return this.prisma.institutionWebhook.findMany({
      where: {
        institutionId,
        event,
        enabled: true,
        deletedAt: null,
        OR: [{ entityId: null }, ...(entityId ? [{ entityId }] : [])],
      },
    });
  }

  createDelivery(data: {
    webhookId: string;
    institutionId: string;
    event: string;
    payload: Record<string, unknown>;
    attempt: number;
  }) {
    return this.prisma.institutionWebhookDelivery.create({
      data: {
        webhookId: data.webhookId,
        institutionId: data.institutionId,
        event: data.event,
        payload: data.payload as Prisma.InputJsonValue,
        attempt: data.attempt,
      },
    });
  }

  updateDelivery(
    deliveryId: string,
    patch: {
      statusCode?: number | null;
      responseBody?: string | null;
      success: boolean;
      errorMessage?: string | null;
    },
  ) {
    return this.prisma.institutionWebhookDelivery.update({
      where: { id: deliveryId },
      data: patch,
    });
  }

  listDeliveries(institutionId: string, webhookId: string, take: number, cursor?: string) {
    return this.prisma.institutionWebhookDelivery.findMany({
      where: { webhookId, institutionId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        event: true,
        success: true,
        statusCode: true,
        attempt: true,
        errorMessage: true,
        createdAt: true,
      },
    });
  }

  listApiKeys(institutionId: string, take: number, cursor?: string) {
    return this.prisma.publicApiKey.findMany({
      where: { institutionId, revokedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        name: true,
        entityId: true,
        scopes: true,
        rateLimitPerMinute: true,
        apiKeyLookup: true,
        lastUsedAt: true,
        createdAt: true,
        revokedAt: true,
      },
    });
  }

  findApiKeyByLookup(lookup: string) {
    return this.prisma.publicApiKey.findFirst({
      where: { apiKeyLookup: lookup, revokedAt: null },
    });
  }

  createApiKey(data: {
    institutionId: string;
    entityId: string | null;
    name: string;
    scopes: string[];
    rateLimitPerMinute: number;
    apiKeyLookup: string;
    apiKeyHash: string;
    createdByUserId: string;
  }) {
    return this.prisma.publicApiKey.create({
      data,
      select: {
        id: true,
        name: true,
        entityId: true,
        scopes: true,
        rateLimitPerMinute: true,
        apiKeyLookup: true,
        createdAt: true,
      },
    });
  }

  revokeApiKey(institutionId: string, keyId: string) {
    return this.prisma.publicApiKey.updateMany({
      where: { id: keyId, institutionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  touchApiKeyUsed(keyId: string) {
    return this.prisma.publicApiKey.update({
      where: { id: keyId },
      data: { lastUsedAt: new Date() },
    });
  }

  async assertEntityInInstitution(institutionId: string, entityId: string): Promise<void> {
    const ent = await this.prisma.institutionEntity.findFirst({
      where: { id: entityId, institutionId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!ent) {
      throw new BadRequestException('Invalid or inactive entityId');
    }
  }
}
