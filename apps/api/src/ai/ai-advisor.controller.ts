import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAnyPermissions } from '../common/decorators/require-any-permissions.decorator';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { AiAdvisorService } from './ai-advisor.service';

/** AI academic advisor — graduation gaps, recommendations, at-risk flags (Prompt 13.1). */
@Controller('ai/advisor')
@UseGuards(AnyPermissionsGuard)
export class AiAdvisorController {
  constructor(private readonly advisor: AiAdvisorService) {}

  @Post(':studentId')
  @RequireAnyPermissions('students.read', 'students.write')
  async advise(@CurrentUser() user: AuthUser, @Param('studentId') studentId: string) {
    this.advisor.assertInstitutionAccess(user, user.institutionId);
    return this.advisor.advise(user, studentId);
  }
}
