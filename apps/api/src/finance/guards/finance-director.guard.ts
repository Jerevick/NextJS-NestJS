import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_FINANCE_DIRECTOR_KEY } from '../../common/decorators/require-finance-director.decorator';
import type { AuthUser } from '../../auth/auth.types';
import { FinanceDirectorService } from '../finance-director.service';

@Injectable()
export class FinanceDirectorGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly financeDirector: FinanceDirectorService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_FINANCE_DIRECTOR_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) {
      return true;
    }
    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!req.user) {
      return false;
    }
    await this.financeDirector.assertFinanceDirector(req.user);
    return true;
  }
}
