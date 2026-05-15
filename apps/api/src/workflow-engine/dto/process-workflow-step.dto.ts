import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import type { WorkflowAction } from '../workflow.types';

const ACTIONS = ['APPROVE', 'REJECT', 'REQUEST_INFO', 'ESCALATE'] as const;

export class ProcessWorkflowStepDto {
  @IsEnum(ACTIONS)
  action!: WorkflowAction;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  additionalData?: Record<string, unknown>;
}
