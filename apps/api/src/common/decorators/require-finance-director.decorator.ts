import { SetMetadata } from '@nestjs/common';

export const REQUIRE_FINANCE_DIRECTOR_KEY = 'requireFinanceDirector';

/** Routes that mutate fee policy, bulk charges, scholarships, waivers, or refunds. */
export const RequireFinanceDirector = () => SetMetadata(REQUIRE_FINANCE_DIRECTOR_KEY, true);
