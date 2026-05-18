import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAnyPermissions } from '../common/decorators/require-any-permissions.decorator';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { AiEssayService } from './ai-essay.service';
import { EssayFeedbackDto } from './dto/faculty-content.dto';

@Controller('ai/essay')
@UseGuards(AnyPermissionsGuard)
export class AiEssayController {
  constructor(private readonly essays: AiEssayService) {}

  /** Spec: POST /ai/essay/feedback { submissionId } */
  @Post('feedback')
  @RequireAnyPermissions('lms.write', 'lms.read')
  feedbackBody(@CurrentUser() user: AuthUser, @Body() dto: EssayFeedbackDto) {
    return this.essays.draftFeedback(user.institutionId, dto.submissionId, {
      draftOnly: dto.draftOnly,
    });
  }

  @Post('feedback/:submissionId')
  @RequireAnyPermissions('lms.write', 'lms.read')
  feedbackParam(
    @CurrentUser() user: AuthUser,
    @Param('submissionId') submissionId: string,
    @Body() body: { draftOnly?: boolean },
  ) {
    return this.essays.draftFeedback(user.institutionId, submissionId, {
      draftOnly: body.draftOnly,
    });
  }
}
