import { SetMetadata } from '@nestjs/common';

export const SKIP_INSTITUTION_SCOPE_KEY = 'skipInstitutionScope';

/** Opt out of {@link InstitutionScopeGuard} for platform routes or impersonation flows. */
export const SkipInstitutionScope = () => SetMetadata(SKIP_INSTITUTION_SCOPE_KEY, true);
