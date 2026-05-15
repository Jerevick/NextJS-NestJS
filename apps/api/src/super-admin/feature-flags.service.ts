import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type FeatureFlagDefinition = {
  key: string;
  description: string;
  defaultEnabled: boolean;
  rolloutPercent: number;
};

type PlatformSettings = {
  featureFlags?: Record<string, FeatureFlagDefinition>;
};

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  private async loadPlatformSettings(): Promise<PlatformSettings> {
    const row = await this.prisma.platform.findUnique({ where: { id: 'default' } });
    if (!row?.settings || typeof row.settings !== 'object' || Array.isArray(row.settings)) {
      return {};
    }
    return row.settings as PlatformSettings;
  }

  private async savePlatformSettings(patch: PlatformSettings): Promise<void> {
    const current = await this.loadPlatformSettings();
    await this.prisma.platform.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        settings: { ...current, ...patch } as Prisma.InputJsonValue,
      },
      update: {
        settings: { ...current, ...patch } as Prisma.InputJsonValue,
      },
    });
  }

  async listGlobal(): Promise<FeatureFlagDefinition[]> {
    const settings = await this.loadPlatformSettings();
    return Object.values(settings.featureFlags ?? {});
  }

  async upsertGlobal(flag: FeatureFlagDefinition): Promise<FeatureFlagDefinition> {
    const settings = await this.loadPlatformSettings();
    const flags = { ...(settings.featureFlags ?? {}), [flag.key]: flag };
    await this.savePlatformSettings({ featureFlags: flags });
    return flag;
  }

  async getEffective(institutionId: string, flagKey: string): Promise<boolean> {
    const settings = await this.loadPlatformSettings();
    const global = settings.featureFlags?.[flagKey];
    if (!global) {
      return false;
    }
    const inst = await this.prisma.institution.findFirst({
      where: { id: institutionId, deletedAt: null },
      select: { settings: true },
    });
    const instSettings = inst?.settings;
    if (
      instSettings &&
      typeof instSettings === 'object' &&
      !Array.isArray(instSettings) &&
      'featureFlags' in instSettings
    ) {
      const overrides = (instSettings as { featureFlags?: Record<string, boolean> }).featureFlags;
      if (overrides && flagKey in overrides) {
        return Boolean(overrides[flagKey]);
      }
    }
    if (!global.defaultEnabled) {
      return false;
    }
    const bucket = institutionId.charCodeAt(0) % 100;
    return bucket < global.rolloutPercent;
  }

  async setInstitutionOverride(
    institutionId: string,
    flagKey: string,
    enabled: boolean,
  ): Promise<{ institutionId: string; flagKey: string; enabled: boolean }> {
    const inst = await this.prisma.institution.findFirst({
      where: { id: institutionId, deletedAt: null },
      select: { settings: true },
    });
    if (!inst) {
      throw new NotFoundException('Institution not found');
    }
    const base =
      inst.settings && typeof inst.settings === 'object' && !Array.isArray(inst.settings)
        ? (inst.settings as Record<string, unknown>)
        : {};
    const featureFlags = {
      ...((base.featureFlags as Record<string, boolean>) ?? {}),
      [flagKey]: enabled,
    };
    await this.prisma.institution.update({
      where: { id: institutionId },
      data: {
        settings: { ...base, featureFlags } as Prisma.InputJsonValue,
      },
    });
    return { institutionId, flagKey, enabled };
  }
}
