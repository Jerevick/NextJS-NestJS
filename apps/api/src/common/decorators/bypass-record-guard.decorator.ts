import { SetMetadata } from '@nestjs/common';

export const BYPASS_RECORD_GUARD_KEY = 'unicore:bypassRecordGuard';

/** Must be paired with {@link SuperAdminOnly}. */
export const BypassRecordGuard = () => SetMetadata(BYPASS_RECORD_GUARD_KEY, true);
