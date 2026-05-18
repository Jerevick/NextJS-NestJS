import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAnyPermissions } from '../common/decorators/require-any-permissions.decorator';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { AiContentService } from './ai-content.service';
import { AiService } from './ai.service';
import { GenerateQuizDto, GenerateRubricDto, SummarizeLessonDto } from './dto/faculty-content.dto';

/** Faculty content tools — lesson summarize, quiz, rubric (Prompt 13.1). */
@Controller('ai/content')
@UseGuards(AnyPermissionsGuard)
export class AiContentController {
  constructor(
    private readonly content: AiContentService,
    private readonly ai: AiService,
  ) {}

  @Post('summarize-lesson')
  @RequireAnyPermissions('lms.write', 'lms.read')
  summarize(@CurrentUser() user: AuthUser, @Body() dto: SummarizeLessonDto) {
    return this.content.summarizeLesson(user.institutionId, dto.lessonId, dto.content);
  }

  @Post('generate-quiz')
  @RequireAnyPermissions('lms.write', 'lms.read')
  quiz(@CurrentUser() user: AuthUser, @Body() dto: GenerateQuizDto) {
    return this.content.generateQuiz(
      user.institutionId,
      dto.lessonId,
      dto.count,
      dto.difficulty,
      dto.content,
    );
  }

  @Post('generate-rubric')
  @RequireAnyPermissions('lms.write', 'lms.read')
  async rubric(@CurrentUser() user: AuthUser, @Body() dto: GenerateRubricDto) {
    const rubric = await this.ai.complete(user.institutionId, [
      {
        role: 'system',
        content:
          'Generate a clear grading rubric in markdown with criteria rows and performance levels. ' +
          'Include point ranges if appropriate. Faculty will edit before use.',
      },
      { role: 'user', content: dto.assignmentDescription },
    ]);
    return { rubric, isAIGenerated: true };
  }
}
