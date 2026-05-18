import type { Prisma } from '@prisma/client';
import type { AuditService } from '../audit/audit.service';
import type { InitiateWorkflowDto } from '../workflow-engine/workflow.types';
import type { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import type { LeaveRepository } from './leave.repository';

export async function createLeaveRequestWithWorkflowAtomic(
  workflows: WorkflowEngineService,
  repo: LeaveRepository,
  audit: AuditService,
  leave: Parameters<LeaveRepository['createLeaveRequestWithWorkflow']>[0],
  workflowDto: Omit<InitiateWorkflowDto, 'entityId_record'>,
) {
  const prepared = await workflows.prepareInitiation({
    ...workflowDto,
    entityId_record: 'pending',
  });
  const { request, workflowInstance } = await repo.createLeaveRequestWithWorkflow(leave, prepared);
  audit.append({
    institutionId: workflowDto.institutionId,
    actorId: workflowDto.initiatedBy,
    action: 'workflow.initiated',
    entity: 'WorkflowInstance',
    entityId: workflowInstance.id,
    newValues: {
      definitionCode: prepared.definitionCode,
      entityType: workflowDto.entityType,
      entityId_record: request.id,
      atomicWithLeaveRequest: true,
    } as Prisma.InputJsonValue,
  });
  return { request, workflowInstance };
}
