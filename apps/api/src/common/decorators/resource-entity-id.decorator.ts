import { SetMetadata } from '@nestjs/common';

export const RESOURCE_ENTITY_ID_KEY = 'resourceEntityId';

export type ResourceEntityIdMeta = {
  paramKey: string;
  resolver: 'student' | 'entity' | 'enrollment';
};

/** Marks routes where ENTITY-scoped users may only access their campus's records. */
export const ResourceEntityId = (
  paramKey: string,
  resolver: ResourceEntityIdMeta['resolver'] = 'student',
) => SetMetadata(RESOURCE_ENTITY_ID_KEY, { paramKey, resolver } satisfies ResourceEntityIdMeta);
