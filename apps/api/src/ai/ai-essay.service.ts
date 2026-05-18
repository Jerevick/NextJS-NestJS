import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { scrubTextForExternalAi } from './ai-pii.util';
import { AiService } from './ai.service';

@Injectable()
export class AiEssayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async draftFeedback(institutionId: string, submissionId: string, opts?: { draftOnly?: boolean }) {
    const submission = await this.prisma.lmsSubmission.findFirst({
      where: { id: submissionId, institutionId },
      include: {
        assessment: { select: { title: true, instructions: true, rubric: true } },
      },
    });
    if (!submission) throw new NotFoundException('Submission not found');

    const answersText = scrubTextForExternalAi(JSON.stringify(submission.answers ?? {}, null, 2));
    const rubric = submission.assessment?.rubric
      ? scrubTextForExternalAi(JSON.stringify(submission.assessment.rubric))
      : 'No rubric on file';

    const feedback = await this.ai.complete(institutionId, [
      {
        role: 'system',
        content:
          'Draft constructive essay feedback for faculty review only. ' +
          'Do not assign a final letter grade or numeric score. ' +
          'Sections: Strengths, Gaps, Rubric alignment, Suggested next steps. ' +
          'Use "the student" — never include names or emails from the submission.',
      },
      {
        role: 'user',
        content: [
          `Assessment: ${submission.assessment?.title ?? submission.assessmentId}`,
          submission.assessment?.instructions
            ? `Instructions: ${scrubTextForExternalAi(submission.assessment.instructions)}`
            : '',
          `Rubric: ${rubric}`,
          `Submission (scrubbed):\n${answersText}`,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ]);

    return {
      submissionId,
      feedback,
      draftOnly: opts?.draftOnly ?? true,
      isAIGenerated: true,
    };
  }
}
