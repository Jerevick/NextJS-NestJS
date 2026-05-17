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
    code: 'GRADUATION_CLEARANCE',
    name: 'Graduation clearance',
    scope: 'ENTITY',
    triggerEntity: 'GraduationClearanceRequest',
    steps: [
      {
        stepNumber: 1,
        name: 'Programme coordinator (credits)',
        assignedTo: { positionCode: 'PC' },
        slaHours: 72,
        scope: 'ENTITY',
      },
      {
        stepNumber: 2,
        name: 'HoD certification',
        assignedTo: { positionCode: 'HOD' },
        slaHours: 48,
        scope: 'ENTITY',
      },
      {
        stepNumber: 3,
        name: 'Dean endorsement',
        assignedTo: { positionCode: 'DEAN' },
        slaHours: 48,
        scope: 'ENTITY',
      },
      {
        stepNumber: 4,
        name: 'Registrar confirmation',
        assignedTo: { positionCode: 'REG' },
        slaHours: 24,
        scope: 'ENTITY',
      },
      {
        stepNumber: 5,
        name: 'Finance clearance',
        assignedTo: { positionCode: 'BURSAR' },
        slaHours: 48,
        scope: 'INSTITUTION',
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
  {
    code: 'GRADE_RELEASE',
    name: 'Grade submission review',
    scope: 'ENTITY',
    triggerEntity: 'StudentEnrollment',
    steps: [
      {
        stepNumber: 1,
        name: 'HoD academic check',
        assignedTo: { positionCode: 'HOD' },
        slaHours: 48,
        scope: 'ENTITY',
      },
      {
        stepNumber: 2,
        name: 'Dean confirmation',
        assignedTo: { positionCode: 'DEAN' },
        slaHours: 48,
        scope: 'ENTITY',
      },
      {
        stepNumber: 3,
        name: 'Registrar acknowledgement',
        assignedTo: { positionCode: 'REG' },
        slaHours: 24,
        scope: 'ENTITY',
      },
    ],
  },
  {
    code: 'ACADEMIC_PROGRESSION_CONDITIONAL',
    name: 'Conditional academic promotion',
    scope: 'ENTITY',
    triggerEntity: 'ProgressionDecision',
    steps: [
      {
        stepNumber: 1,
        name: 'Registrar review',
        assignedTo: { positionCode: 'REG' },
        slaHours: 48,
        scope: 'ENTITY',
      },
      {
        stepNumber: 2,
        name: 'Dean confirmation',
        assignedTo: { positionCode: 'DEAN' },
        slaHours: 48,
        scope: 'ENTITY',
      },
    ],
  },
  {
    code: 'ACADEMIC_PROGRESSION_FULL_REPEAT',
    name: 'Full session repeat',
    scope: 'ENTITY',
    triggerEntity: 'ProgressionDecision',
    steps: [
      {
        stepNumber: 1,
        name: 'HoD academic plan',
        assignedTo: { positionCode: 'HOD' },
        slaHours: 72,
        scope: 'ENTITY',
      },
      {
        stepNumber: 2,
        name: 'Registrar records update',
        assignedTo: { positionCode: 'REG' },
        slaHours: 48,
        scope: 'ENTITY',
      },
    ],
  },
  {
    code: 'ACADEMIC_PROGRESSION_MAX_DURATION',
    name: 'Maximum programme duration review',
    scope: 'INSTITUTION',
    triggerEntity: 'ProgressionDecision',
    steps: [
      {
        stepNumber: 1,
        name: 'Deputy VC extension',
        assignedTo: { positionCode: 'DVC' },
        slaHours: 120,
        scope: 'INSTITUTION',
      },
      {
        stepNumber: 2,
        name: 'Registrar decision',
        assignedTo: { positionCode: 'REG' },
        slaHours: 48,
        scope: 'INSTITUTION',
      },
    ],
  },
  {
    code: 'ACADEMIC_PROGRESSION_MANUAL',
    name: 'Manual progression review',
    scope: 'ENTITY',
    triggerEntity: 'ProgressionDecision',
    steps: [
      {
        stepNumber: 1,
        name: 'Registrar adjudication',
        assignedTo: { positionCode: 'REG' },
        slaHours: 72,
        scope: 'ENTITY',
      },
    ],
  },
  {
    code: 'FEE_WAIVER',
    name: 'Fee waiver approval',
    scope: 'ENTITY',
    triggerEntity: 'FinanceTransaction',
    steps: [
      {
        stepNumber: 1,
        name: 'Finance Director approval',
        assignedTo: { positionCode: 'BURSAR' },
        slaHours: 72,
        scope: 'INSTITUTION',
      },
    ],
  },
  {
    code: 'FINANCE_REFUND',
    name: 'Finance refund approval',
    scope: 'ENTITY',
    triggerEntity: 'FinanceTransaction',
    steps: [
      {
        stepNumber: 1,
        name: 'Finance Director approval',
        assignedTo: { positionCode: 'BURSAR' },
        slaHours: 72,
        scope: 'INSTITUTION',
      },
      {
        stepNumber: 2,
        name: 'Registrar acknowledgement',
        assignedTo: { positionCode: 'REG' },
        slaHours: 48,
        scope: 'ENTITY',
      },
    ],
  },
  {
    code: 'STUDENT_EXCESS_REFUND',
    name: 'Student excess fee refund',
    scope: 'ENTITY',
    triggerEntity: 'FinanceTransaction',
    steps: [
      {
        stepNumber: 1,
        name: 'Finance Director approval',
        assignedTo: { positionCode: 'BURSAR' },
        slaHours: 72,
        scope: 'INSTITUTION',
      },
    ],
  },
  {
    code: 'STUDENT_EXCESS_TRANSFER',
    name: 'Student excess fee transfer',
    scope: 'ENTITY',
    triggerEntity: 'FinanceTransaction',
    steps: [
      {
        stepNumber: 1,
        name: 'Finance Director approval',
        assignedTo: { positionCode: 'BURSAR' },
        slaHours: 72,
        scope: 'INSTITUTION',
      },
    ],
  },
  {
    code: 'SCHOLARSHIP_APPLICATION',
    name: 'Scholarship application review',
    scope: 'ENTITY',
    triggerEntity: 'FinanceScholarshipApplication',
    steps: [
      {
        stepNumber: 1,
        name: 'Finance Director review',
        assignedTo: { positionCode: 'BURSAR' },
        slaHours: 72,
        scope: 'INSTITUTION',
      },
    ],
  },
  {
    code: 'SCHOLARSHIP_AWARD',
    name: 'Scholarship award approval',
    scope: 'ENTITY',
    triggerEntity: 'FinanceScholarshipAward',
    steps: [
      {
        stepNumber: 1,
        name: 'Finance Director review',
        assignedTo: { positionCode: 'BURSAR' },
        slaHours: 72,
        scope: 'INSTITUTION',
      },
      {
        stepNumber: 2,
        name: 'Registrar acknowledgement',
        assignedTo: { positionCode: 'REG' },
        slaHours: 48,
        scope: 'ENTITY',
      },
    ],
  },
  {
    code: 'AEGROTAT',
    name: 'Aegrotat progression',
    scope: 'ENTITY',
    triggerEntity: 'ProgressionDecision',
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
        slaHours: 48,
        scope: 'ENTITY',
      },
      {
        stepNumber: 3,
        name: 'Registrar confirmation',
        assignedTo: { positionCode: 'REG' },
        slaHours: 48,
        scope: 'ENTITY',
      },
    ],
  },
];
