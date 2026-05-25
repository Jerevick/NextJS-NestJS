import { SetMetadata } from '@nestjs/common';

export const REQUIRE_POSITION_KEY = 'requirePosition';

export const RequirePosition = (...codes: string[]) => SetMetadata(REQUIRE_POSITION_KEY, codes);
