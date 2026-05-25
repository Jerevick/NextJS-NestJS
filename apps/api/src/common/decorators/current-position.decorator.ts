import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../../auth/auth.types';

export type RequestPosition = NonNullable<AuthUser['position']>;

export const CurrentPosition = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestPosition | undefined => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    return req.user?.position;
  },
);
