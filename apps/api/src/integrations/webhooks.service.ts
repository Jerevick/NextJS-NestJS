import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { WEBHOOK_PLATFORM_EVENTS, type WebhookPlatformEvent } from './integration.types';
import { IntegrationsRepository } from './integrations.repository';
import { normalizePageLimit, sliceCursorPage } from '../common/pagination/cursor-page.util';
import type { ListIntegrationsQueryDto } from './dto/list-integrations-query.dto';
import { WebhookDeliveryService } from './webhook-delivery.service';

function assertWebhooksRead(actor: AuthUser): void {
  if (actor.permissions.includes('*')) return;
  if (
    actor.permissions.includes('integrations.read') ||
    actor.permissions.includes('integrations.write') ||
    actor.permissions.includes('institutions.read') ||
    actor.permissions.includes('institutions.write')
  ) {
    return;
  }
  throw new ForbiddenException('Missing integrations.read permission');
}

function assertWebhooksWrite(actor: AuthUser): void {
  if (actor.permissions.includes('*')) return;
  if (
    actor.permissions.includes('institutions.write') ||
    actor.permissions.includes('integrations.write')
  ) {
    return;
  }
  throw new ForbiddenException('Missing integrations.write permission');
}

@Injectable()
export class WebhooksService {
  constructor(
    private readonly repo: IntegrationsRepository,
    private readonly delivery: WebhookDeliveryService,
    private readonly audit: AuditService,
  ) {}

  listEvents(): readonly string[] {
    return WEBHOOK_PLATFORM_EVENTS;
  }

  async list(actor: AuthUser, query: ListIntegrationsQueryDto = {}, entityId?: string | null) {
    assertWebhooksRead(actor);
    const limit = normalizePageLimit(query.limit, 50, 100);
    const rows = await this.repo.listWebhooks(
      actor.institutionId,
      entityId !== undefined ? entityId?.trim() || null : undefined,
      limit,
      query.cursor,
    );
    const { data, nextCursor } = sliceCursorPage(rows, limit);
    return {
      data: data.map((r) => ({
        id: r.id,
        event: r.event,
        url: r.url,
        entityId: r.entityId,
        enabled: r.enabled,
        createdAt: r.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }

  async create(actor: AuthUser, input: { event: string; url: string; entityId?: string | null }) {
    assertWebhooksWrite(actor);
    if (!WEBHOOK_PLATFORM_EVENTS.includes(input.event as WebhookPlatformEvent)) {
      throw new BadRequestException(`Unsupported event: ${input.event}`);
    }
    const url = input.url.trim();
    if (!url.startsWith('https://')) {
      throw new BadRequestException('Webhook URL must use HTTPS');
    }
    const scopedEntity = input.entityId?.trim() || null;
    if (scopedEntity) {
      await this.repo.assertEntityInInstitution(actor.institutionId, scopedEntity);
    }
    const secret = randomBytes(24).toString('hex');
    const row = await this.repo.createWebhook({
      institutionId: actor.institutionId,
      entityId: scopedEntity,
      event: input.event,
      url,
      secret,
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'webhooks.create',
      entity: 'InstitutionWebhook',
      entityId: row.id,
      newValues: { event: row.event, url: row.url },
    });
    return {
      id: row.id,
      event: row.event,
      url: row.url,
      entityId: row.entityId,
      secret,
      enabled: row.enabled,
    };
  }

  async remove(actor: AuthUser, webhookId: string) {
    assertWebhooksWrite(actor);
    const n = await this.repo.softDeleteWebhook(actor.institutionId, webhookId);
    if (!n.count) throw new NotFoundException('Webhook not found');
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'webhooks.delete',
      entity: 'InstitutionWebhook',
      entityId: webhookId,
    });
    return { ok: true };
  }

  async test(actor: AuthUser, webhookId: string) {
    assertWebhooksWrite(actor);
    const hook = await this.repo.findWebhook(actor.institutionId, webhookId);
    if (!hook) throw new NotFoundException('Webhook not found');
    const sample = this.delivery.buildEnvelope(hook.event, hook.institutionId, hook.entityId, {
      test: true,
      message: 'UniCore webhook test delivery',
    });
    await this.delivery.enqueueDelivery({
      webhookId: hook.id,
      institutionId: hook.institutionId,
      url: hook.url,
      secret: hook.secret,
      event: hook.event,
      payload: sample,
      attempt: 1,
    });
    return { ok: true, message: 'Test payload queued for delivery' };
  }

  async deliveries(actor: AuthUser, webhookId: string, query: ListIntegrationsQueryDto = {}) {
    assertWebhooksRead(actor);
    const hook = await this.repo.findWebhook(actor.institutionId, webhookId);
    if (!hook) throw new NotFoundException('Webhook not found');
    const limit = normalizePageLimit(query.limit, 50, 100);
    const rows = await this.repo.listDeliveries(
      actor.institutionId,
      webhookId,
      limit,
      query.cursor,
    );
    const { data, nextCursor } = sliceCursorPage(rows, limit);
    return {
      data: data.map((d) => ({
        id: d.id,
        attempt: d.attempt,
        success: d.success,
        statusCode: d.statusCode,
        errorMessage: d.errorMessage,
        createdAt: d.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }

  async emitPlatformEvent(
    institutionId: string,
    event: string,
    data: Record<string, unknown>,
    entityId?: string | null,
  ): Promise<void> {
    const hooks = await this.repo.findWebhooksForEvent(institutionId, event, entityId ?? null);
    const envelope = this.delivery.buildEnvelope(event, institutionId, entityId, data);
    await Promise.all(
      hooks.map((hook) =>
        this.delivery.enqueueDelivery({
          webhookId: hook.id,
          institutionId: hook.institutionId,
          url: hook.url,
          secret: hook.secret,
          event: hook.event,
          payload: envelope,
          attempt: 1,
        }),
      ),
    );
  }
}
