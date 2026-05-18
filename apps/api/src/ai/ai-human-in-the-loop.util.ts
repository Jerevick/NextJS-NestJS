import { BadRequestException } from '@nestjs/common';

export type SensitiveAiMutation = 'grade' | 'status' | 'suspension';

export type AiMutationFlags = {
  aiSuggested?: boolean;
  humanConfirmed?: boolean;
};

/** AI may suggest changes but must not apply sensitive mutations without human confirmation. */
export function assertHumanInTheLoop(
  flags: AiMutationFlags | undefined,
  action: SensitiveAiMutation,
): void {
  if (!flags?.aiSuggested) return;
  if (flags.humanConfirmed) return;
  throw new BadRequestException(
    `AI-suggested ${action} changes require humanConfirmed=true before they can be applied`,
  );
}

export function isSuspensionStatus(status: string): boolean {
  return status === 'SUSPENDED';
}
