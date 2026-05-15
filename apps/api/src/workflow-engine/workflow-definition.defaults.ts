import type { WorkflowScope } from '@prisma/client';
import type { WorkflowStepConfig } from './workflow.types';

export interface WorkflowDefinitionSeed {
  code: string;
  name: string;
  scope: WorkflowScope;
  triggerEntity: string;
  steps: WorkflowStepConfig[];
}

export const INSTITUTION_WORKFLOW_DEFINITIONS: WorkflowDefinitionSeed[] = [
  {
    code: 'STUDENT_REACTIVATION',
    name: 'Student reactivation',
    scope: 'ENTITY',
    triggerEntity: 'ReactivationRequest',
    steps: [
      {
        stepNumber: 1,
        name: 'HoD recommendation',
        assignedTo: { positionCode: 'HOD' },
        slaHours: 48,
        scope: 'ENTITY',
      },
      {
        stepNumber: 2,
        name: 'Dean endorsement',
        assignedTo: { positionCode: 'DEAN' },
        slaHours: 48,
        scope: 'ENTITY',
      },
      {
        stepNumber: 3,
        name: 'Registrar confirmation',
        assignedTo: { positionCode: 'REG' },
        slaHours: 24,
        scope: 'ENTITY',
      },
    ],
  },
  {
    code: 'BACKFILL_REQUEST',
    name: 'Academic backfill',
    scope: 'ENTITY',
    triggerEntity: 'BackfillRequest',
    steps: [
      {
        stepNumber: 1,
        name: 'HoD academic review',
        assignedTo: { positionCode: 'HOD' },
        slaHours: 72,
        scope: 'ENTITY',
      },
      {
        stepNumber: 2,
        name: 'Dean approval',
        assignedTo: { positionCode: 'DEAN' },
        slaHours: 72,
        scope: 'ENTITY',
      },
      {
        stepNumber: 3,
        name: 'Registrar final approval',
        assignedTo: { positionCode: 'REG' },
        slaHours: 48,
        scope: 'ENTITY',
      },
      {
        stepNumber: 4,
        name: 'Finance retroactive billing',
        assignedTo: { positionCode: 'BURSAR' },
        slaHours: 48,
        scope: 'INSTITUTION',
      },
    ],
  },
  {
    code: 'STUDENT_INACTIVATION',
    name: 'Student inactivation',
    scope: 'ENTITY',
    triggerEntity: 'Student',
    steps: [
      {
        stepNumber: 1,
        name: 'Registrar execution',
        assignedTo: { positionCode: 'REG' },
        slaHours: 24,
        scope: 'ENTITY',
      },
    ],
  },
  {
    code: 'GRADE_OVERRIDE',
    name: 'Grade override',
    scope: 'ENTITY',
    triggerEntity: 'GradeOverride',
    steps: [
      {
        stepNumber: 1,
        name: 'Lecturer comments',
        assignedTo: { positionCode: 'PC' },
        slaHours: 24,
        scope: 'ENTITY',
      },
      {
        stepNumber: 2,
        name: 'HoD review',
        assignedTo: { positionCode: 'HOD' },
        slaHours: 48,
        scope: 'ENTITY',
      },
      {
        stepNumber: 3,
        name: 'Dean approval',
        assignedTo: { positionCode: 'DEAN' },
        slaHours: 72,
        scope: 'ENTITY',
      },
      {
        stepNumber: 4,
        name: 'Registrar execution',
        assignedTo: { positionCode: 'REG' },
        slaHours: 24,
        scope: 'ENTITY',
      },
    ],
  },
];
