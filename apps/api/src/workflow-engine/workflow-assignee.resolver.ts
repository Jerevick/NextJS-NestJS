import { Injectable } from '@nestjs/common';
import type { WorkflowStepConfig } from './workflow.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkflowAssigneeResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolveStepAssignee(
    institutionId: string,
    instanceEntityId: string,
    step: WorkflowStepConfig,
  ): Promise<{ userId: string; positionCode: string } | null> {
    const positionEntityId =
      step.scope === 'INSTITUTION'
        ? await this.resolveMainCampusEntityId(institutionId)
        : instanceEntityId;

    if (!positionEntityId) {
      return null;
    }

    const position = await this.prisma.position.findFirst({
      where: {
        institutionId,
        entityId: positionEntityId,
        code: step.assignedTo.positionCode,
        deletedAt: null,
      },
      select: { id: true, code: true },
    });
    if (!position) {
      return null;
    }

    const holder = await this.prisma.positionHolder.findFirst({
      where: { positionId: position.id, endDate: null },
      orderBy: { startDate: 'desc' },
      select: { userId: true },
    });
    if (!holder) {
      return null;
    }

    return { userId: holder.userId, positionCode: position.code };
  }

  async resolveEscalationAssignee(
    institutionId: string,
    instanceEntityId: string,
    step: WorkflowStepConfig,
  ): Promise<{ userId: string; positionCode: string } | null> {
    if (!step.escalatesTo) {
      return this.resolveStepAssignee(institutionId, instanceEntityId, step);
    }
    return this.resolveStepAssignee(institutionId, instanceEntityId, {
      ...step,
      assignedTo: step.escalatesTo,
    });
  }

  private async resolveMainCampusEntityId(institutionId: string): Promise<string | null> {
    const main = await this.prisma.institutionEntity.findFirst({
      where: { institutionId, code: 'MAIN', deletedAt: null },
      select: { id: true },
    });
    return main?.id ?? null;
  }
}
