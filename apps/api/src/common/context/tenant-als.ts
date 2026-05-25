import { AsyncLocalStorage } from 'node:async_hooks';

export type TenantStore = {
  institutionId: string;
  /** Active campus entity when {@link TenantStore.entityScope} is `ENTITY`. */
  entityId?: string;
  entityScope?: 'ALL' | 'ENTITY';
  /** Platform super-admin / migration jobs — skip Prisma tenant injection. */
  bypassTenantFilter?: boolean;
};

/** Set by {@link TenantContextInterceptor} from the authenticated JWT for optional tenant-scoped helpers. */
export const tenantAls = new AsyncLocalStorage<TenantStore>();
