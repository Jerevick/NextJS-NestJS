import { Injectable, Logger } from '@nestjs/common';
import { BillingCycle } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  mergeEntitySettings,
  parseEntitySettings,
} from './entity-settings.types';
import { OrgTemplatesService } from '../org-structure/org-templates.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { defaultBillingForType, defaultSettingsForType } from './entity-type-defaults';

export type EntityProvisionResult = {
  entityId: string;
  institutionId: string;
  status: 'ACTIVE';
  provisioningLog: string[];
};

/**
 * Finalizes a PROVISIONING campus: settings, org template, billing defaults.
 */
@Injectable()
export class EntityProvisioningService {
  private readonly log = new Logger(EntityProvisioningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orgTemplates: OrgTemplatesService,
    private readonly workflows: WorkflowEngineService,
  ) {}

  async provisionEntity(institutionId: string, entityId: string): Promise<EntityProvisionResult | null> {
    const entity = await this.prisma.institutionEntity.findFirst({
      where: { id: entityId, institutionId, deletedAt: null, status: 'PROVISIONING' },
      select: { id: true, type: true, settings: true, code: true },
    });
    if (!entity) {
      return null;
    }

    const steps: string[] = [];
    const existing = parseEntitySettings(entity.settings);
    const merged = mergeEntitySettings(existing, {
      ...defaultSettingsForType(entity.type),
      ...existing,
      coupling: existing.coupling ?? defaultSettingsForType(entity.type).coupling,
      billingClassification:
        existing.billingClassification ?? defaultBillingForType(entity.type),
    });

    const orgResult = await this.orgTemplates.applyToEntity(institutionId, entityId, entity.type);
    if (orgResult.skipped) {
      steps.push('org_template_skipped:existing_units');
    } else {
      steps.push(
        `org_template_applied:units=${orgResult.orgUnitsCreated}:positions=${orgResult.positionsCreated}`,
      );
    }
    const wfCount = await this.workflows.seedDefinitionsForInstitution(institutionId);
    steps.push(`workflow_definitions_seeded:${wfCount}`);

    const billing = merged.billingClassification ?? 'BILLED_TO_PARENT';
    if (billing === 'BILLED_INDEPENDENTLY') {
      const hasSub = await this.prisma.subscription.findFirst({
        where: { institutionId, deletedAt: null },
        select: { id: true },
      });
      if (!hasSub) {
        await this.prisma.subscription.create({
          data: {
            institutionId,
            planId: 'entity-independent',
            billingCycle: BillingCycle.ANNUAL,
            amount: 0,
            currency: 'USD',
          },
        });
        steps.push('subscription_created:institution_placeholder');
      } else {
        steps.push('subscription_exists:linked_at_institution_level');
      }
    }

    merged.provisioningLog = [...(merged.provisioningLog ?? []), ...steps];
    merged.provisionedAt = new Date().toISOString();

    await this.prisma.institutionEntity.update({
      where: { id: entityId },
      data: {
        status: 'ACTIVE',
        settings: merged as object,
      },
    });

    this.log.log(`entity.provisioned institution=${institutionId} entity=${entityId} code=${entity.code}`);
    return {
      entityId,
      institutionId,
      status: 'ACTIVE',
      provisioningLog: merged.provisioningLog ?? steps,
    };
  }
}
