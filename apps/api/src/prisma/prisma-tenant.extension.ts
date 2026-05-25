import { Prisma } from '@prisma/client';
import { Logger } from '@nestjs/common';
import { tenantAls, type TenantStore } from '../common/context/tenant-als';
import { ENTITY_SCOPED_MODEL_NAMES, TENANT_SCOPED_MODEL_NAMES } from './tenant-scoped-models';

const log = new Logger('PrismaTenantExtension');

function modelHasDeletedAt(model: string): boolean {
  const m = Prisma.dmmf.datamodel.models.find((x) => x.name === model);
  return Boolean(m?.fields.some((f) => f.name === 'deletedAt'));
}

function tenantWhere(store: TenantStore, model: string): Record<string, unknown> {
  const where: Record<string, unknown> = { institutionId: store.institutionId };
  if (store.entityScope === 'ENTITY' && store.entityId && ENTITY_SCOPED_MODEL_NAMES.has(model)) {
    where.entityId = store.entityId;
  }
  if (modelHasDeletedAt(model)) {
    where.deletedAt = null;
  }
  return where;
}

function andWhere<T extends { where?: unknown }>(args: T, extra: Record<string, unknown>): T {
  const w = args.where;
  if (!w || (typeof w === 'object' && Object.keys(w as object).length === 0)) {
    return { ...args, where: extra };
  }
  return { ...args, where: { AND: [w, extra] } };
}

function shouldScope(model: string, store: TenantStore | undefined): store is TenantStore {
  if (!store?.institutionId || store.bypassTenantFilter) {
    return false;
  }
  return TENANT_SCOPED_MODEL_NAMES.has(model);
}

function injectCreateData(
  model: string,
  data: Record<string, unknown>,
  store: TenantStore,
): Record<string, unknown> {
  const next = { ...data };
  if (next.institutionId == null) {
    next.institutionId = store.institutionId;
  }
  if (
    store.entityScope === 'ENTITY' &&
    store.entityId &&
    ENTITY_SCOPED_MODEL_NAMES.has(model) &&
    next.entityId == null
  ) {
    next.entityId = store.entityId;
  }
  return next;
}

export const prismaTenantExtension = Prisma.defineExtension({
  name: 'unicore-tenant-scope',
  query: {
    $allModels: {
      async findMany({ model, args, query }) {
        const store = tenantAls.getStore();
        if (!shouldScope(model, store)) {
          return query(args);
        }
        return query(andWhere(args, tenantWhere(store, model)));
      },
      async findFirst({ model, args, query }) {
        const store = tenantAls.getStore();
        if (!shouldScope(model, store)) {
          return query(args);
        }
        return query(andWhere(args, tenantWhere(store, model)));
      },
      // findUnique left unscoped — callers must use findFirst with institutionId or rely on id-only platform routes
      async count({ model, args, query }) {
        const store = tenantAls.getStore();
        if (!shouldScope(model, store)) {
          return query(args);
        }
        return query(andWhere(args, tenantWhere(store, model)));
      },
      async update({ model, args, query }) {
        const store = tenantAls.getStore();
        if (!shouldScope(model, store)) {
          return query(args);
        }
        return query(andWhere(args, tenantWhere(store, model)));
      },
      async updateMany({ model, args, query }) {
        const store = tenantAls.getStore();
        if (!shouldScope(model, store)) {
          return query(args);
        }
        return query(andWhere(args, tenantWhere(store, model)));
      },
      async delete({ model, args, query }) {
        const store = tenantAls.getStore();
        if (!shouldScope(model, store)) {
          return query(args);
        }
        if (modelHasDeletedAt(model)) {
          log.error(
            `Blocked prisma.${model}.delete — use update({ deletedAt: new Date() }) per UniCore soft-delete law`,
          );
          throw new Error(`Hard delete is not allowed on ${model}`);
        }
        return query(andWhere(args, tenantWhere(store, model)));
      },
      async deleteMany({ model, args, query }) {
        const store = tenantAls.getStore();
        if (!shouldScope(model, store)) {
          return query(args);
        }
        if (modelHasDeletedAt(model)) {
          log.error(`Blocked prisma.${model}.deleteMany — use soft delete`);
          throw new Error(`Hard deleteMany is not allowed on ${model}`);
        }
        return query(andWhere(args, tenantWhere(store, model)));
      },
      async create({ model, args, query }) {
        const store = tenantAls.getStore();
        if (!shouldScope(model, store)) {
          return query(args);
        }
        const data = injectCreateData(model, args.data as Record<string, unknown>, store);
        return query({ ...args, data });
      },
      async createMany({ model, args, query }) {
        const store = tenantAls.getStore();
        if (!shouldScope(model, store)) {
          return query(args);
        }
        const data = Array.isArray(args.data)
          ? (args.data as Record<string, unknown>[]).map((row) =>
              injectCreateData(model, row, store),
            )
          : injectCreateData(model, args.data as Record<string, unknown>, store);
        return query({ ...args, data });
      },
      async upsert({ model, args, query }) {
        const store = tenantAls.getStore();
        if (!shouldScope(model, store)) {
          return query(args);
        }
        const filter = tenantWhere(store, model);
        const where = args.where ? { AND: [args.where, filter] } : filter;
        return query({
          ...args,
          where: where as never,
          create: injectCreateData(model, args.create as Record<string, unknown>, store),
          update: args.update,
        });
      },
    },
  },
});
