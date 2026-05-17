import { workflowDefinitionForRecommendation } from './progression-review-workflow.util';

describe('workflowDefinitionForRecommendation', () => {
  it('maps conditional, repeat, and max-duration classifications', () => {
    expect(workflowDefinitionForRecommendation('CONDITIONAL_REVIEW')).toBe(
      'ACADEMIC_PROGRESSION_CONDITIONAL',
    );
    expect(workflowDefinitionForRecommendation('REPEAT_ADVISED')).toBe(
      'ACADEMIC_PROGRESSION_FULL_REPEAT',
    );
    expect(workflowDefinitionForRecommendation('MAX_DURATION_BLOCK')).toBe(
      'ACADEMIC_PROGRESSION_MAX_DURATION',
    );
  });

  it('returns null when no workflow applies', () => {
    expect(workflowDefinitionForRecommendation('AUTOMATIC_PROMOTION')).toBeNull();
    expect(workflowDefinitionForRecommendation('NO_PROGRESSION_RULE')).toBeNull();
    expect(workflowDefinitionForRecommendation('INSUFFICIENT_GRADE_DATA')).toBeNull();
  });
});
