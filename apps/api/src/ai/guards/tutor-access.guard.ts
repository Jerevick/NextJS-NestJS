import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthUser } from '../../auth/auth.types';

/** Students with a linked profile may use the tutor; staff need lms.read. */
@Injectable()
export class TutorAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user) return false;
    if (user.permissions?.includes('*')) return true;
    if (user.permissions?.includes('lms.read')) return true;
    if (user.role === 'STUDENT' && user.studentId) return true;
    return false;
  }
}
