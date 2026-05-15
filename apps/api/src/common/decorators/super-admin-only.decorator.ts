import { SetMetadata } from '@nestjs/common';

export const SUPER_ADMIN_ONLY_KEY = 'unicore:superAdminOnly';

/** Restricts handler to platform super-admins (used with {@link BypassRecordGuard}). */
export const SuperAdminOnly = () => SetMetadata(SUPER_ADMIN_ONLY_KEY, true);
