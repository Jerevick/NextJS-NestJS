import { SetMetadata } from '@nestjs/common';
import type { PositionScope } from '@prisma/client';

export const REQUIRE_SCOPE_KEY = 'requireScope';

export const RequireScope = (...scopes: PositionScope[]) => SetMetadata(REQUIRE_SCOPE_KEY, scopes);
