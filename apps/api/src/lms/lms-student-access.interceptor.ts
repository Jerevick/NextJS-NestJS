import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { TenantModule } from '@prisma/client';
import type { Observable } from 'rxjs';
import type { AuthUser } from '../auth/auth.types';
import { TenantModulesService } from '../common/tenant-modules/tenant-modules.service';
import { LmsStudentEligibilityService } from './lms-student-eligibility.service';

/** Runs after auth/permission guards — enforces module flags and SIS↔LMS bridge before LMS routes. */
@Injectable()
export class LmsStudentAccessInterceptor implements NestInterceptor {
  constructor(
    private readonly tenantModules: TenantModulesService,
    private readonly eligibility: LmsStudentEligibilityService,
  ) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;
    if (user) {
      const entityId = user.entityScope === 'ENTITY' ? user.entityId : undefined;
      if (user.role === 'STUDENT') {
        await this.tenantModules.assertConcurrentLmsAccess(user);
        await this.eligibility.assertMayUseStudentLms(user);
      } else {
        await this.tenantModules.assertEnabled(user.institutionId, TenantModule.LMS, entityId);
      }
    }
    return next.handle();
  }
}
