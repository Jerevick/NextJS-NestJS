import type { Prisma } from '@prisma/client';
import type { AuditService } from '../audit/audit.service';
import type { InitiateWorkflowDto } from '../workflow-engine/workflow.types';
import type { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import type { FinanceRepository } from './finance.repository';

type PendingFinanceRowInput = {
  institutionId: string;
  entityId: string;
  studentAccountId: string;
  type: Parameters<FinanceRepository['createPendingFinanceRequestWithWorkflow']>[0]['type'];
  signedAmount: number;
  currency: string;
  description: string;
  reference: string;
  processedBy: string;
  metadata?: Prisma.InputJsonValue;
};

/** Single DB transaction: pending finance row + workflow instance + approval link. */
export async function createPendingFinanceRequestWithWorkflowAtomic(
  workflows: WorkflowEngineService,
  repo: FinanceRepository,
  audit: AuditService,
  pending: PendingFinanceRowInput,
  workflowDto: Omit<InitiateWorkflowDto, 'entityId_record'>,
) {
  const prepared = await workflows.prepareInitiation({
    ...workflowDto,
    entityId_record: 'pending',
  });
  const { pending: row, workflowInstance } = await repo.createPendingFinanceRequestWithWorkflow(
    pending,
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
      atomicWithFinanceTransaction: true,
    } as Prisma.InputJsonValue,
  });
  return { pending: row, workflowInstance };
}

/** Scholarship application + workflow in one transaction. */
export async function createScholarshipApplicationWithWorkflowAtomic(
  workflows: WorkflowEngineService,
  repo: FinanceRepository,
  audit: AuditService,
  application: Parameters<FinanceRepository['createScholarshipApplicationWithWorkflow']>[0],
  workflowDto: Omit<InitiateWorkflowDto, 'entityId_record'>,
) {
  const prepared = await workflows.prepareInitiation({
    ...workflowDto,
    entityId_record: 'pending',
  });
  const { application: row, workflowInstance } =
    await repo.createScholarshipApplicationWithWorkflow(application, prepared);
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
      atomicWithScholarshipApplication: true,
    } as Prisma.InputJsonValue,
  });
  return { application: row, workflowInstance };
}

/** Scholarship award + workflow in one transaction. */
export async function createScholarshipAwardWithWorkflowAtomic(
  workflows: WorkflowEngineService,
  repo: FinanceRepository,
  audit: AuditService,
  award: Parameters<FinanceRepository['createScholarshipAwardWithWorkflow']>[0],
  workflowDto: Omit<InitiateWorkflowDto, 'entityId_record'>,
) {
  const prepared = await workflows.prepareInitiation({
    ...workflowDto,
    entityId_record: 'pending',
  });
  const { award: row, workflowInstance } = await repo.createScholarshipAwardWithWorkflow(
    award,
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
      atomicWithScholarshipAward: true,
    } as Prisma.InputJsonValue,
  });
  return { award: row, workflowInstance };
}
