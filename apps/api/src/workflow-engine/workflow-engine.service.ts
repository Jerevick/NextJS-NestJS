import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  PLATFORM_WEBHOOK_DISPATCH,
  type PlatformWebhookDispatchPayload,
} from '../events/platform-webhook.events';
import { Prisma, WorkflowStatus } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowAssigneeResolver } from './workflow-assignee.resolver';
import { NotificationEventsService } from '../notifications/notification-events.service';
import { WorkflowCompletionHandler } from './workflow-completion.handler';
import type {
  InitiateWorkflowDto,
  PreparedWorkflowInitiation,
  ProcessWorkflowStepDto,
  WorkflowHistoryEntry,
} from './workflow.types';
import { parseWorkflowHistory, parseWorkflowSteps } from './workflow.types';

@Injectable()
export class WorkflowEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assigneeResolver: WorkflowAssigneeResolver,
    private readonly completion: WorkflowCompletionHandler,
    private readonly audit: AuditService,
    private readonly notify: NotificationEventsService,
    private readonly events: EventEmitter2,
  ) {}

  async findDefinition(institutionId: string, entityId: string, code: string) {
    const entitySpecific = await this.prisma.workflowDefinition.findFirst({
      where: { institutionId, entityId, code, isActive: true },
    });
    if (entitySpecific) {
      return entitySpecific;
    }
    return this.prisma.workflowDefinition.findFirst({
      where: { institutionId, entityId: null, code, isActive: true },
    });
  }

  async prepareInitiation(dto: InitiateWorkflowDto): Promise<PreparedWorkflowInitiation> {
    const definition = await this.findDefinition(
      dto.institutionId,
      dto.entityId,
      dto.definitionCode,
    );
    if (!definition) {
      throw new NotFoundException(`Workflow definition not found: ${dto.definitionCode}`);
    }

    const steps = parseWorkflowSteps(definition.steps);
    if (steps.length === 0) {
      throw new BadRequestException('Workflow definition has no steps');
    }

    const firstStep = steps[0];
    const assignee = await this.assigneeResolver.resolveStepAssignee(
      dto.institutionId,
      dto.entityId,
      firstStep,
    );
    if (!assignee) {
      throw new BadRequestException(
        `No active holder for position ${firstStep.assignedTo.positionCode} on this campus`,
      );
    }

    const dueAt = new Date(Date.now() + firstStep.slaHours * 60 * 60 * 1000);

    return {
      definitionId: definition.id,
      definitionCode: definition.code,
      institutionId: dto.institutionId,
      entityId: dto.entityId,
      entityType: dto.entityType,
      initiatedBy: dto.initiatedBy,
      metadata: (dto.metadata ?? {}) as Record<string, unknown>,
      currentAssigneeUserId: assignee.userId,
      currentStepName: firstStep.name,
      assigneePositionCode: assignee.positionCode,
      dueAt,
    };
  }

  async initiateWorkflow(dto: InitiateWorkflowDto) {
    const prepared = await this.prepareInitiation(dto);
    const instance = await this.prisma.workflowInstance.create({
      data: {
        institutionId: prepared.institutionId,
        entityId: prepared.entityId,
        definitionId: prepared.definitionId,
        definitionCode: prepared.definitionCode,
        entityType: prepared.entityType,
        entityId_record: dto.entityId_record,
        currentStep: 1,
        status: WorkflowStatus.IN_PROGRESS,
        initiatedBy: prepared.initiatedBy,
        dueAt: prepared.dueAt,
        metadata: prepared.metadata as Prisma.InputJsonValue,
        currentAssigneeUserId: prepared.currentAssigneeUserId,
        currentStepName: prepared.currentStepName,
        assigneePositionCode: prepared.assigneePositionCode,
        history: [],
      },
      include: {
        definition: { select: { name: true, code: true, scope: true } },
        entity: { select: { id: true, code: true, name: true } },
      },
    });

    this.audit.append({
      institutionId: dto.institutionId,
      actorId: dto.initiatedBy,
      action: 'workflow.initiated',
      entity: 'WorkflowInstance',
      entityId: instance.id,
      newValues: {
        definitionCode: prepared.definitionCode,
        entityType: dto.entityType,
        entityId_record: dto.entityId_record,
      },
    });

    void this.notify.notifyWorkflowActionAssigned({
      institutionId: instance.institutionId,
      entityId: instance.entityId,
      assigneeUserId: prepared.currentAssigneeUserId,
      workflowName: instance.definition.name,
      workflowInstanceId: instance.id,
    });

    return instance;
  }

  async processStep(actor: AuthUser, dto: ProcessWorkflowStepDto) {
    const instance = await this.prisma.workflowInstance.findFirst({
      where: { id: dto.instanceId, institutionId: actor.institutionId },
      include: { definition: true },
    });
    if (!instance) {
      throw new NotFoundException('Workflow instance not found');
    }
    if (
      instance.status !== WorkflowStatus.IN_PROGRESS &&
      instance.status !== WorkflowStatus.ESCALATED
    ) {
      throw new BadRequestException('Workflow is not open for actions');
    }

    if (instance.currentAssigneeUserId !== actor.userId && !actor.permissions.includes('*')) {
      throw new ForbiddenException('You are not the assignee for the current workflow step');
    }

    const steps = parseWorkflowSteps(instance.definition.steps);
    const stepConfig = steps.find((s) => s.stepNumber === instance.currentStep);
    if (!stepConfig) {
      throw new BadRequestException('Current step configuration missing');
    }

    const history = parseWorkflowHistory(instance.history);
    const entry: WorkflowHistoryEntry = {
      step: instance.currentStep,
      stepName: stepConfig.name,
      actorId: dto.actorId,
      actorPositionCode: instance.assigneePositionCode ?? undefined,
      action: dto.action,
      notes: dto.notes?.trim(),
      decidedAt: new Date().toISOString(),
    };
    history.push(entry);

    if (dto.action === 'REJECT') {
      const rejected = await this.prisma.workflowInstance.update({
        where: { id: instance.id },
        data: {
          status: WorkflowStatus.REJECTED,
          completedAt: new Date(),
          completedBy: actor.userId,
          history: history as object,
          currentAssigneeUserId: null,
        },
      });
      await this.completion.handleRejected(
        instance.definitionCode,
        instance.institutionId,
        instance.entityId_record,
        actor.userId,
        dto.notes,
      );
      return rejected;
    }

    if (dto.action === 'REQUEST_INFO') {
      return this.prisma.workflowInstance.update({
        where: { id: instance.id },
        data: {
          history: history as object,
          currentAssigneeUserId: instance.initiatedBy,
          currentStepName: 'Awaiting initiator response',
          assigneePositionCode: null,
        },
      });
    }

    if (dto.action === 'ESCALATE') {
      const escalated = await this.assigneeResolver.resolveEscalationAssignee(
        instance.institutionId,
        instance.entityId,
        stepConfig,
      );
      if (!escalated) {
        throw new BadRequestException('Escalation assignee could not be resolved');
      }
      const dueAt = new Date(Date.now() + stepConfig.slaHours * 60 * 60 * 1000);
      return this.prisma.workflowInstance.update({
        where: { id: instance.id },
        data: {
          status: WorkflowStatus.ESCALATED,
          history: history as object,
          currentAssigneeUserId: escalated.userId,
          assigneePositionCode: escalated.positionCode,
          dueAt,
        },
      });
    }

    const isLastStep = instance.currentStep >= steps.length;
    if (!isLastStep) {
      const nextStep = steps[instance.currentStep];
      const nextAssignee = await this.assigneeResolver.resolveStepAssignee(
        instance.institutionId,
        instance.entityId,
        nextStep,
      );
      if (!nextAssignee) {
        throw new BadRequestException(
          `No active holder for position ${nextStep.assignedTo.positionCode}`,
        );
      }
      const dueAt = new Date(Date.now() + nextStep.slaHours * 60 * 60 * 1000);
      const nextStepNumber = instance.currentStep + 1;
      const advanced = await this.prisma.workflowInstance.update({
        where: { id: instance.id },
        data: {
          currentStep: nextStepNumber,
          history: history as object,
          dueAt,
          currentAssigneeUserId: nextAssignee.userId,
          currentStepName: nextStep.name,
          assigneePositionCode: nextAssignee.positionCode,
          status: WorkflowStatus.IN_PROGRESS,
          metadata: {
            ...(instance.metadata as Record<string, unknown>),
            ...(dto.additionalData ?? {}),
          } as object,
        },
      });
      await this.completion.handleStepAdvanced(
        instance.definitionCode,
        instance.institutionId,
        instance.entityId_record,
        nextStepNumber,
      );
      void this.notify.notifyWorkflowActionAssigned({
        institutionId: advanced.institutionId,
        entityId: advanced.entityId,
        assigneeUserId: nextAssignee.userId,
        workflowName: instance.definition.name,
        workflowInstanceId: advanced.id,
      });
      return advanced;
    }

    const metadata = {
      ...(instance.metadata as Record<string, unknown>),
      ...(dto.additionalData ?? {}),
    };

    const approved = await this.prisma.workflowInstance.update({
      where: { id: instance.id },
      data: {
        status: WorkflowStatus.APPROVED,
        completedAt: new Date(),
        completedBy: actor.userId,
        history: history as object,
        currentAssigneeUserId: null,
        metadata: metadata as object,
      },
    });

    await this.completion.handleCompleted(
      instance.definitionCode,
      instance.institutionId,
      instance.entityId_record,
      actor.userId,
      metadata,
    );

    const webhookPayload: PlatformWebhookDispatchPayload = {
      event: 'workflow.completed',
      institutionId: instance.institutionId,
      entityId: instance.entityId,
      data: {
        workflowInstanceId: instance.id,
        definitionCode: instance.definitionCode,
        entityIdRecord: instance.entityId_record,
        completedByUserId: actor.userId,
      },
    };
    this.events.emit(PLATFORM_WEBHOOK_DISPATCH, webhookPayload);

    return approved;
  }

  async getInbox(actor: AuthUser, limit = 20, definitionCodes?: string[]) {
    const rows = await this.prisma.workflowInstance.findMany({
      where: {
        institutionId: actor.institutionId,
        currentAssigneeUserId: actor.userId,
        status: { in: [WorkflowStatus.IN_PROGRESS, WorkflowStatus.ESCALATED] },
        ...(definitionCodes?.length ? { definitionCode: { in: definitionCodes } } : {}),
      },
      take: Math.min(limit, 50),
      orderBy: { dueAt: 'asc' },
      include: {
        definition: { select: { name: true, code: true } },
        entity: { select: { code: true, name: true } },
        initiator: { select: { email: true, profile: true } },
      },
    });
    return { data: rows };
  }

  async getInitiated(actor: AuthUser, limit = 20) {
    const rows = await this.prisma.workflowInstance.findMany({
      where: {
        institutionId: actor.institutionId,
        initiatedBy: actor.userId,
      },
      take: Math.min(limit, 50),
      orderBy: { initiatedAt: 'desc' },
      include: {
        definition: { select: { name: true, code: true } },
        entity: { select: { code: true, name: true } },
      },
    });
    return { data: rows };
  }

  async getById(actor: AuthUser, id: string) {
    const row = await this.prisma.workflowInstance.findFirst({
      where: { id, institutionId: actor.institutionId },
      include: {
        definition: true,
        entity: { select: { code: true, name: true } },
        initiator: { select: { email: true, profile: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('Workflow instance not found');
    }
    return row;
  }

  async checkSlaBreaches(): Promise<number> {
    const now = new Date();
    const oneHour = new Date(now.getTime() + 60 * 60 * 1000);
    const approaching = await this.prisma.workflowInstance.findMany({
      where: {
        dueAt: { gte: now, lte: oneHour },
        status: { in: [WorkflowStatus.IN_PROGRESS, WorkflowStatus.ESCALATED] },
      },
      take: 100,
      include: { definition: true },
    });
    for (const instance of approaching) {
      const meta = (instance.metadata ?? {}) as Record<string, unknown>;
      if (meta.slaWarningSent === true) {
        continue;
      }
      const steps = parseWorkflowSteps(instance.definition.steps);
      const stepConfig = steps.find((s) => s.stepNumber === instance.currentStep);
      let supervisorUserId: string | null = null;
      if (stepConfig && instance.currentAssigneeUserId) {
        const escalated = await this.assigneeResolver.resolveEscalationAssignee(
          instance.institutionId,
          instance.entityId,
          stepConfig,
        );
        supervisorUserId = escalated?.userId ?? null;
      }
      if (instance.currentAssigneeUserId && instance.dueAt) {
        await this.notify.notifyWorkflowSlaWarning({
          institutionId: instance.institutionId,
          entityId: instance.entityId,
          assigneeUserId: instance.currentAssigneeUserId,
          supervisorUserId,
          workflowName: instance.definition.name,
          workflowInstanceId: instance.id,
          dueAt: instance.dueAt,
        });
        await this.prisma.workflowInstance.update({
          where: { id: instance.id },
          data: {
            metadata: { ...meta, slaWarningSent: true } as object,
          },
        });
      }
    }

    const breached = await this.prisma.workflowInstance.findMany({
      where: {
        dueAt: { lt: now },
        status: { in: [WorkflowStatus.IN_PROGRESS, WorkflowStatus.ESCALATED] },
      },
      take: 100,
      include: { definition: true },
    });

    let count = 0;
    for (const instance of breached) {
      const steps = parseWorkflowSteps(instance.definition.steps);
      const stepConfig = steps.find((s) => s.stepNumber === instance.currentStep);
      if (!stepConfig) {
        continue;
      }
      const escalated = await this.assigneeResolver.resolveEscalationAssignee(
        instance.institutionId,
        instance.entityId,
        stepConfig,
      );
      if (!escalated) {
        continue;
      }
      const dueAt = new Date(Date.now() + stepConfig.slaHours * 60 * 60 * 1000);
      await this.prisma.workflowInstance.update({
        where: { id: instance.id },
        data: {
          status: WorkflowStatus.ESCALATED,
          currentAssigneeUserId: escalated.userId,
          assigneePositionCode: escalated.positionCode,
          dueAt,
        },
      });
      if (instance.currentAssigneeUserId && instance.dueAt) {
        await this.notify.notifyWorkflowSlaWarning({
          institutionId: instance.institutionId,
          entityId: instance.entityId,
          assigneeUserId: instance.currentAssigneeUserId,
          supervisorUserId: escalated.userId,
          workflowName: instance.definition.name,
          workflowInstanceId: instance.id,
          dueAt: instance.dueAt,
        });
      }
      this.audit.append({
        institutionId: instance.institutionId,
        actorId: instance.initiatedBy,
        action: 'workflow.sla_breach',
        entity: 'WorkflowInstance',
        entityId: instance.id,
        newValues: { escalatedTo: escalated.positionCode },
      });
      count += 1;
    }
    return count;
  }

  async seedDefinitionsForInstitution(institutionId: string): Promise<number> {
    const { INSTITUTION_WORKFLOW_DEFINITIONS } = await import('./workflow-definition.defaults');
    let created = 0;
    for (const def of INSTITUTION_WORKFLOW_DEFINITIONS) {
      const exists = await this.prisma.workflowDefinition.findFirst({
        where: { institutionId, entityId: null, code: def.code },
      });
      if (exists) {
        continue;
      }
      await this.prisma.workflowDefinition.create({
        data: {
          institutionId,
          entityId: null,
          name: def.name,
          code: def.code,
          scope: def.scope,
          triggerEntity: def.triggerEntity,
          steps: def.steps as object,
          isActive: true,
        },
      });
      created += 1;
    }
    return created;
  }
}
