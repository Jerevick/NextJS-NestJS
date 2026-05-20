import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { assertEntityAccess, assertInstitutionAccess } from '../org-structure/org-structure.utils';
import { ObjectStorageService } from '../storage/object-storage.service';
import {
  INSTITUTION_ONLY_CATALOG,
  SETTINGS_CATALOG,
  assertEntityMayOverride,
  flattenPatchKeys,
  maskSecretValue,
  mergeSettingsPatch,
  resolveEffectiveSetting,
} from './customization-settings.util';
import { readInstitutionBranding } from '../alumni/alumni-branding.util';
import { TENANT_CACHE_TTL, TenantCacheService } from '../redis/tenant-cache.service';
import { CustomizationRepository } from './customization.repository';
import type { PatchBrandingDto } from './dto/patch-settings.dto';
import { assertUploadMimeMatchesMagicBytes } from '../common/security/upload-magic-bytes.util';

const BRANDING_IMAGE_MIME = new Set(['image/png', 'image/jpeg']);

@Injectable()
export class CustomizationService {
  constructor(
    private readonly repo: CustomizationRepository,
    private readonly audit: AuditService,
    private readonly storage: ObjectStorageService,
    private readonly cache: TenantCacheService,
  ) {}

  private assertRead(actor: AuthUser) {
    if (
      actor.permissions.includes('*') ||
      actor.permissions.includes('institutions.read') ||
      actor.permissions.includes('institutions.write')
    ) {
      return;
    }
    throw new ForbiddenException('Missing institutions.read permission');
  }

  private assertInstitutionWrite(actor: AuthUser) {
    if (!(actor.permissions.includes('*') || actor.permissions.includes('institutions.write'))) {
      throw new ForbiddenException('Missing institutions.write permission');
    }
    if (actor.entityScope !== 'ALL') {
      throw new ForbiddenException('Institution settings require institution-wide scope');
    }
  }

  private assertEntityWrite(actor: AuthUser, entityId: string) {
    if (!(actor.permissions.includes('*') || actor.permissions.includes('institutions.write'))) {
      throw new ForbiddenException('Missing institutions.write permission');
    }
    assertEntityAccess(actor, entityId);
  }

  async getEffectiveSetting(actor: AuthUser, key: string, entityId?: string) {
    this.assertRead(actor);
    assertInstitutionAccess(actor, actor.institutionId);
    const inst = await this.repo.findInstitution(actor.institutionId);
    if (!inst) throw new NotFoundException('Institution not found');

    let entitySettings: unknown;
    const resolvedEntityId =
      entityId ?? (actor.entityScope === 'ENTITY' ? actor.entityId : undefined);
    if (resolvedEntityId) {
      const ent = await this.repo.findEntity(actor.institutionId, resolvedEntityId);
      if (!ent) throw new NotFoundException('Entity not found');
      entitySettings = ent.settings;
    }

    const result = resolveEffectiveSetting(key, inst.settings, entitySettings);
    return {
      ...result,
      value: maskSecretValue(key, result.value),
    };
  }

  async listEffectiveSettings(actor: AuthUser, entityId?: string) {
    this.assertRead(actor);
    const entries = await Promise.all(
      SETTINGS_CATALOG.map(async (item) => {
        const r = await this.getEffectiveSetting(actor, item.key, entityId);
        return {
          key: item.key,
          label: item.label,
          group: item.group,
          value: r.value,
          source: r.source,
        };
      }),
    );
    return {
      settings: entries,
      institutionOnly: INSTITUTION_ONLY_CATALOG,
    };
  }

  /** Programmatic cascade — used by other modules. */
  async getEffectiveSettingForScope(
    institutionId: string,
    key: string,
    entityId?: string,
  ): Promise<unknown> {
    const cacheKey = entityId ? `${institutionId}:${entityId}:${key}` : `${institutionId}:${key}`;
    return this.cache.getOrLoad(
      'institution-settings',
      cacheKey,
      TENANT_CACHE_TTL.institutionSettings,
      async () => {
        const inst = await this.repo.findInstitution(institutionId);
        if (!inst) return resolveEffectiveSetting(key, {}, undefined).value;

        let entitySettings: unknown;
        if (entityId) {
          const ent = await this.repo.findEntity(institutionId, entityId);
          entitySettings = ent?.settings;
        }
        return resolveEffectiveSetting(key, inst.settings, entitySettings).value;
      },
    );
  }

  async getBranding(actor: AuthUser, entityId?: string) {
    this.assertRead(actor);
    const resolvedEntityId =
      entityId ?? (actor.entityScope === 'ENTITY' ? actor.entityId : undefined);
    const inst = await this.repo.findInstitution(actor.institutionId);
    if (!inst) throw new NotFoundException('Institution not found');
    const ent = resolvedEntityId
      ? await this.repo.findEntity(actor.institutionId, resolvedEntityId)
      : null;
    const branding = readInstitutionBranding(inst.name, inst.settings, ent?.settings);
    const logo = resolveEffectiveSetting('branding.logoUrl', inst.settings, ent?.settings);
    const color = resolveEffectiveSetting('branding.primaryColor', inst.settings, ent?.settings);
    const domain = resolveEffectiveSetting('branding.customDomain', inst.settings, ent?.settings);
    return {
      institutionName: inst.name,
      institutionDomain: inst.domain ?? null,
      logoUrl: branding.logoUrl ?? logo.value,
      primaryColor: branding.primaryColor ?? color.value,
      customDomain: domain.value,
      sources: {
        logoUrl: branding.logoUrl ? 'entity' : logo.source,
        primaryColor: branding.primaryColor ? 'entity' : color.source,
        customDomain: domain.source,
      },
    };
  }

  async patchInstitutionSettings(actor: AuthUser, patch: Record<string, unknown>) {
    this.assertInstitutionWrite(actor);
    assertInstitutionAccess(actor, actor.institutionId);
    const inst = await this.repo.findInstitution(actor.institutionId);
    if (!inst) throw new NotFoundException('Institution not found');

    const merged = mergeSettingsPatch(inst.settings, patch);
    await this.repo.updateInstitutionSettings(actor.institutionId, merged as Prisma.InputJsonValue);
    await this.cache.invalidatePrefix('institution-settings', actor.institutionId);
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'customization.institution_settings',
      entity: 'Institution',
      entityId: actor.institutionId,
      newValues: { keys: Object.keys(patch) },
    });
    return this.listEffectiveSettings(actor);
  }

  async patchEntitySettings(actor: AuthUser, entityId: string, patch: Record<string, unknown>) {
    this.assertEntityWrite(actor, entityId);
    assertInstitutionAccess(actor, actor.institutionId);
    for (const key of flattenPatchKeys(patch)) {
      try {
        assertEntityMayOverride(key);
      } catch (e) {
        throw new BadRequestException(e instanceof Error ? e.message : String(e));
      }
    }
    const ent = await this.repo.findEntity(actor.institutionId, entityId);
    if (!ent) throw new NotFoundException('Entity not found');

    const merged = mergeSettingsPatch(ent.settings, patch);
    const n = await this.repo.updateEntitySettings(
      actor.institutionId,
      entityId,
      merged as Prisma.InputJsonValue,
    );
    if (n.count === 0) throw new NotFoundException('Entity not found');

    await this.cache.invalidatePrefix('institution-settings', `${actor.institutionId}:${entityId}`);

    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'customization.entity_settings',
      entity: 'InstitutionEntity',
      entityId,
      newValues: { keys: Object.keys(patch) },
    });
    return this.listEffectiveSettings(actor, entityId);
  }

  async patchBranding(actor: AuthUser, dto: PatchBrandingDto, entityId?: string) {
    const patch: Record<string, unknown> = {};
    if (dto.logoUrl !== undefined) patch['branding.logoUrl'] = dto.logoUrl;
    if (dto.primaryColor !== undefined) patch['branding.primaryColor'] = dto.primaryColor;
    if (dto.customDomain !== undefined) patch['branding.customDomain'] = dto.customDomain;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('No branding fields to update');
    }

    const targetEntityId =
      entityId ?? (actor.entityScope === 'ENTITY' ? actor.entityId : undefined);
    if (targetEntityId) {
      return this.patchEntitySettings(actor, targetEntityId, patch);
    }
    return this.patchInstitutionSettings(actor, patch);
  }

  async uploadBrandingLogo(actor: AuthUser, file: Express.Multer.File, entityId?: string) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Logo file is required');
    }
    const mime = assertUploadMimeMatchesMagicBytes(file.buffer, file.mimetype, BRANDING_IMAGE_MIME);
    const ext = mime === 'image/png' ? 'png' : 'jpg';
    const scope = entityId ?? 'institution';
    const key = `branding/${actor.institutionId}/${scope}/logo-${Date.now()}.${ext}`;
    const stored = await this.storage.putBuffer(key, file.buffer, mime);
    await this.patchBranding(actor, { logoUrl: stored.url }, entityId);
    return { logoUrl: stored.url, key: stored.key };
  }
}
