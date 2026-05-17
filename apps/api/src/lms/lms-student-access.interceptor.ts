import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { AuthUser } from '../auth/auth.types';
import { LmsStudentEligibilityService } from './lms-student-eligibility.service';

/** Runs after auth/permission guards — blocks non-active or unlinked STUDENT roles from LMS HTTP routes. */
@Injectable()
export class LmsStudentAccessInterceptor implements NestInterceptor {
  constructor(private readonly eligibility: LmsStudentEligibilityService) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;
    if (user) {
      await this.eligibility.assertMayUseStudentLms(user);
    }
    return next.handle();
  }
}
