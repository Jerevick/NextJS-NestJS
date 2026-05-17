export type WorkflowAction = 'APPROVE' | 'REJECT' | 'REQUEST_INFO' | 'ESCALATE';

export type WorkflowStepScope = 'ENTITY' | 'INSTITUTION';

export interface WorkflowStepAssignedTo {
  positionCode: string;
}

export interface WorkflowStepConfig {
  stepNumber: number;
  name: string;
  assignedTo: WorkflowStepAssignedTo;
  slaHours: number;
  scope?: WorkflowStepScope;
  actionOptions?: WorkflowAction[];
  escalatesTo?: WorkflowStepAssignedTo;
  requiredFields?: string[];
}

export interface WorkflowHistoryEntry {
  step: number;
  stepName: string;
  actorId: string;
  actorPositionCode?: string;
  action: WorkflowAction;
  notes?: string;
  decidedAt: string;
}

export interface InitiateWorkflowDto {
  institutionId: string;
  entityId: string;
  definitionCode: string;
  entityType: string;
  entityId_record: string;
  initiatedBy: string;
  metadata?: Record<string, unknown>;
}

/** Resolved workflow row ready for Prisma create (used in finance atomic commits). */
export type PreparedWorkflowInitiation = {
  definitionId: string;
  definitionCode: string;
  institutionId: string;
  entityId: string;
  entityType: string;
  initiatedBy: string;
  metadata: Record<string, unknown>;
  currentAssigneeUserId: string;
  currentStepName: string;
  assigneePositionCode: string;
  dueAt: Date;
};

export interface ProcessWorkflowStepDto {
  instanceId: string;
  actorId: string;
  action: WorkflowAction;
  notes?: string;
  additionalData?: Record<string, unknown>;
}

export function parseWorkflowSteps(raw: unknown): WorkflowStepConfig[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw as WorkflowStepConfig[];
}

export function parseWorkflowHistory(raw: unknown): WorkflowHistoryEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw as WorkflowHistoryEntry[];
}
