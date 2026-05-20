import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { CustomizationService } from '../customization/customization.service';
import type { MarketplaceIntegrationMeta } from './integration.types';
import {
  legacyCustomizationPatchForIntegration,
  maskIntegrationSettings,
} from './integration-settings.util';
import { IntegrationRegistry } from './integration.registry';
import { IntegrationsRepository } from './integrations.repository';

function hasIntegrationsRead(actor: AuthUser): boolean {
  if (actor.permissions.includes('*')) return true;
  return (
    actor.permissions.includes('integrations.read') ||
    actor.permissions.includes('integrations.write') ||
    actor.permissions.includes('institutions.read') ||
    actor.permissions.includes('institutions.write')
  );
}

function assertIntegrationsWrite(actor: AuthUser): void {
  if (actor.permissions.includes('*')) return;
  if (
    actor.permissions.includes('institutions.write') ||
    actor.permissions.includes('integrations.write')
  ) {
    return;
  }
  throw new ForbiddenException('Missing integrations.write permission');
}

function readSettings(val: unknown): Record<string, unknown> {
  return val && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : {};
}

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly repo: IntegrationsRepository,
    private readonly registry: IntegrationRegistry,
    private readonly customization: CustomizationService,
    private readonly audit: AuditService,
  ) {}

  async marketplace(
    actor: AuthUser,
    entityId?: string | null,
  ): Promise<MarketplaceIntegrationMeta[]> {
    if (!hasIntegrationsRead(actor)) {
      throw new ForbiddenException('Missing integrations.read permission');
    }
    const scoped = entityId?.trim() || null;
    const rows = await this.repo.listIntegrations(actor.institutionId, scoped ?? undefined);
    const byCode = new Map(rows.map((r) => [r.code, r]));

    return this.registry.list().map((p) => {
      const row = byCode.get(p.code);
      return {
        code: p.code,
        name: p.name,
        category: p.category,
        description: p.description ?? '',
        enabled: row?.enabled ?? false,
        configured: Boolean(row?.configuredAt),
        configuredAt: row?.configuredAt?.toISOString() ?? null,
      };
    });
  }

  async getConfig(actor: AuthUser, code: string, entityId?: string | null) {
    if (!hasIntegrationsRead(actor)) {
      throw new ForbiddenException('Missing integrations.read permission');
    }
    const provider = this.registry.get(code);
    if (!provider) throw new NotFoundException(`Unknown integration: ${code}`);
    const scoped = entityId?.trim() || null;
    const row = await this.repo.findIntegration(actor.institutionId, code, scoped);
    const settings = readSettings(row?.settings);
    return {
      code,
      enabled: row?.enabled ?? false,
      settings: maskIntegrationSettings(settings),
      configuredAt: row?.configuredAt?.toISOString() ?? null,
    };
  }

  async configure(
    actor: AuthUser,
    code: string,
    entityId: string | null | undefined,
    settings: Record<string, unknown>,
    enabled = true,
  ) {
    assertIntegrationsWrite(actor);
    const provider = this.registry.get(code);
    if (!provider) throw new BadRequestException(`Unknown integration: ${code}`);
    const scoped = entityId?.trim() || null;
    if (scoped) {
      await this.repo.assertEntityInInstitution(actor.institutionId, scoped);
    }
    await provider.configure(actor.institutionId, scoped, settings);
    const row = await this.repo.upsertIntegration({
      institutionId: actor.institutionId,
      entityId: scoped,
      code,
      enabled,
      settings,
      configuredAt: new Date(),
    });
    await this.syncLegacyCustomization(actor, scoped, code, enabled, settings);
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'integrations.configure',
      entity: 'InstitutionIntegration',
      entityId: row.id,
      newValues: { code, entityId: scoped, enabled },
    });
    return { code, enabled: row.enabled, configuredAt: row.configuredAt?.toISOString() ?? null };
  }

  async test(actor: AuthUser, code: string, entityId?: string | null) {
    assertIntegrationsWrite(actor);
    const provider = this.registry.get(code);
    if (!provider) throw new NotFoundException(`Unknown integration: ${code}`);
    const scoped = entityId?.trim() || null;
    const row = await this.repo.findIntegration(actor.institutionId, code, scoped);
    if (provider.code === 'slack' && row) {
      const settings = readSettings(row.settings);
      const webhook = String(settings.incomingWebhookUrl ?? '').trim();
      if (!webhook) return { success: false, message: 'Missing settings: incomingWebhookUrl' };
      return { success: true, message: 'Slack incoming webhook URL configured' };
    }
    if (provider.code === 'bigbluebutton' && row) {
      const settings = readSettings(row.settings);
      const base = String(settings.serverUrl ?? process.env.BBB_SERVER_URL ?? '').trim();
      const secret = String(settings.sharedSecret ?? process.env.BBB_SHARED_SECRET ?? '').trim();
      if (!base || !secret) {
        return { success: false, message: 'Missing BBB serverUrl or sharedSecret' };
      }
      return { success: true, message: 'BigBlueButton configured' };
    }
    return provider.test(actor.institutionId, scoped);
  }

  async disable(actor: AuthUser, code: string, entityId?: string | null) {
    assertIntegrationsWrite(actor);
    const provider = this.registry.get(code);
    if (!provider) throw new NotFoundException(`Unknown integration: ${code}`);
    const scoped = entityId?.trim() || null;
    await provider.disable(actor.institutionId, scoped);
    await this.repo.softDisableIntegration(actor.institutionId, code, scoped);
    await this.syncLegacyCustomization(actor, scoped, code, false, {});
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'integrations.disable',
      entity: 'InstitutionIntegration',
      entityId: code,
      newValues: { code, entityId: scoped },
    });
    return { ok: true };
  }

  private async syncLegacyCustomization(
    actor: AuthUser,
    entityId: string | null,
    code: string,
    enabled: boolean,
    settings: Record<string, unknown>,
  ): Promise<void> {
    const patch = legacyCustomizationPatchForIntegration(code, enabled, settings);
    if (!patch) return;
    try {
      if (entityId) {
        await this.customization.patchEntitySettings(actor, entityId, patch);
      } else {
        await this.customization.patchInstitutionSettings(actor, patch);
      }
    } catch {
      // Non-fatal when customization permissions differ in tests.
    }
  }
}
