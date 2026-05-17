import type { BatchRecommendation } from './progression-batch-eval';

/** Maps automated batch classifications to seeded workflow definition codes (Phase 19). */
export function workflowDefinitionForRecommendation(r: BatchRecommendation): string | null {
  switch (r) {
    case 'CONDITIONAL_REVIEW':
      return 'ACADEMIC_PROGRESSION_CONDITIONAL';
    case 'REPEAT_ADVISED':
      return 'ACADEMIC_PROGRESSION_FULL_REPEAT';
    case 'MAX_DURATION_BLOCK':
      return 'ACADEMIC_PROGRESSION_MAX_DURATION';
    default:
      return null;
  }
}
