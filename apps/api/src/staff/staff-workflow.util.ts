import type { Prisma } from '@prisma/client';
import type { AuditService } from '../audit/audit.service';
import type { InitiateWorkflowDto } from '../workflow-engine/workflow.types';
import type { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import type { StaffRepository } from './staff.repository';

export async function createLeaveRequestWithWorkflowAtomic(
  workflows: WorkflowEngineService,
  repo: StaffRepository,
  audit: AuditService,
  leave: Parameters<StaffRepository['createLeaveRequestWithWorkflow']>[0],
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

export async function createAppraisalWithWorkflowAtomic(
  workflows: WorkflowEngineService,
  repo: StaffRepository,
  audit: AuditService,
  appraisal: Parameters<StaffRepository['createAppraisalWithWorkflow']>[0],
  workflowDto: Omit<InitiateWorkflowDto, 'entityId_record'>,
) {
  const prepared = await workflows.prepareInitiation({
    ...workflowDto,
    entityId_record: 'pending',
  });
  const { appraisal: row, workflowInstance } = await repo.createAppraisalWithWorkflow(
    appraisal,
    prepared,
  );
  audit.append({
    institutionId: workflowDto.institutionId,
    actorId: workflowDto.initiatedBy,
    action: 'workflow.initiated',
    entity: 'WorkflowInstance',
    entityId: workflowInstance.id,
    newValues: {
      definitionCode: prepared.definitionCode,
      entityType: workflowDto.entityType,
      entityId_record: row.id,
      atomicWithStaffAppraisal: true,
    } as Prisma.InputJsonValue,
  });
  return { appraisal: row, workflowInstance };
}
