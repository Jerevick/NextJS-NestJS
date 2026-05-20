import { Injectable, Logger } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { AiService } from '../ai/ai.service';
import { scrubTextForExternalAi } from '../ai/ai-pii.util';
import { buildRuleBasedAcademicTip, type AcademicTipInput } from './portal-academic-tip.util';

export type StudentAcademicTip = {
  tip: string;
  source: 'ai' | 'rules';
};

@Injectable()
export class PortalAcademicTipService {
  private readonly log = new Logger(PortalAcademicTipService.name);

  constructor(private readonly ai: AiService) {}

  async buildStudentTip(actor: AuthUser, input: AcademicTipInput): Promise<StudentAcademicTip> {
    const fallback =
      buildRuleBasedAcademicTip(input) ??
      "Stay on top of this week's LMS modules and check due dates every morning.";

    try {
      const raw = await this.ai.complete(actor.institutionId, [
        {
          role: 'system',
          content:
            'You are a supportive university academic coach speaking directly to a student. ' +
            'Reply with exactly one practical sentence (max 200 characters). Plain text only — no markdown or bullet lists.',
        },
        {
          role: 'user',
          content: scrubTextForExternalAi(
            JSON.stringify({
              cgpa: input.cgpa,
              dueSoonCount: input.dueSoonCount ?? 0,
              lowestAttendance: input.lowestAttendance ?? null,
            }),
          ),
        },
      ]);
      const tip = raw.replace(/\s+/g, ' ').trim().slice(0, 220);
      if (tip.length >= 12) {
        return { tip, source: 'ai' };
      }
    } catch (err) {
      this.log.debug(
        `AI academic tip unavailable for institution ${actor.institutionId}: ${err instanceof Error ? err.message : err}`,
      );
    }

    return { tip: fallback, source: 'rules' };
  }
}
