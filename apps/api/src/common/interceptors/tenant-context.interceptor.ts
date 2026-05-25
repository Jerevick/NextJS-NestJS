import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tenantAls } from '../context/tenant-als';
import type { AuthUser } from '../../auth/auth.types';

/**
 * Binds `institutionId` from the JWT user into AsyncLocalStorage for the request.
 * Uses `enterWith` so async continuations (e.g. Prisma) still see the store when supported by Node.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;
    if (user?.institutionId) {
      tenantAls.enterWith({
        institutionId: user.institutionId,
        entityId: user.entityId,
        entityScope: user.entityScope,
        bypassTenantFilter: user.permissions.includes('*'),
      });
    }
    return next.handle();
  }
}
