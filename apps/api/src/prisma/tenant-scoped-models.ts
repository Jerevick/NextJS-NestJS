import { Prisma } from '@prisma/client';

/** Models that include `institutionId` (tenant-scoped). */
export const TENANT_SCOPED_MODEL_NAMES = new Set(
  Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === 'institutionId'))
    .map((m) => m.name),
);

/** Subset that also includes `entityId` (campus-scoped when entityScope is ENTITY). */
export const ENTITY_SCOPED_MODEL_NAMES = new Set(
  Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === 'entityId'))
    .map((m) => m.name),
);

/** Platform-global models — never auto-filtered. */
export const PLATFORM_MODEL_NAMES = new Set(
  Prisma.dmmf.datamodel.models
    .filter((m) => !m.fields.some((f) => f.name === 'institutionId'))
    .map((m) => m.name),
);
