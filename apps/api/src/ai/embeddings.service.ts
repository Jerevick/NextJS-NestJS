import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from './ai.service';

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

@Injectable()
export class EmbeddingsService {
  private readonly log = new Logger(EmbeddingsService.name);
  private readonly usePgvector = process.env.PGVECTOR_ENABLED === '1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async upsertDocument(args: {
    institutionId: string;
    entityId?: string;
    sourceType: string;
    sourceId: string;
    content: string;
    metadata?: Record<string, unknown>;
  }) {
    const embedding = await this.ai.embed(args.institutionId, args.content);
    const row = await this.prisma.embeddingDocument.upsert({
      where: {
        institutionId_sourceType_sourceId: {
          institutionId: args.institutionId,
          sourceType: args.sourceType,
          sourceId: args.sourceId,
        },
      },
      create: {
        institutionId: args.institutionId,
        entityId: args.entityId,
        sourceType: args.sourceType,
        sourceId: args.sourceId,
        content: args.content,
        metadata: (args.metadata ?? {}) as Prisma.InputJsonValue,
        embedding: embedding as unknown as Prisma.InputJsonValue,
      },
      update: {
        content: args.content,
        metadata: (args.metadata ?? {}) as Prisma.InputJsonValue,
        embedding: embedding as unknown as Prisma.InputJsonValue,
      },
    });
    if (this.usePgvector) {
      await this.syncPgvector(row.id, embedding).catch((e) =>
        this.log.warn(`pgvector sync failed: ${e}`),
      );
    }
    return row;
  }

  private async syncPgvector(documentId: string, embedding: number[]): Promise<void> {
    const vec = `[${embedding.join(',')}]`;
    await this.prisma.$executeRawUnsafe(
      `UPDATE "EmbeddingDocument" SET "embeddingVector" = $1::vector WHERE id = $2`,
      vec,
      documentId,
    );
  }

  async similaritySearch(args: {
    institutionId: string;
    entityId?: string;
    courseInstanceId?: string;
    sourceIds?: string[];
    query: string;
    topK?: number;
    sourceTypes?: string[];
  }) {
    const queryVec = await this.ai.embed(args.institutionId, args.query);
    const metadataFilter = this.buildMetadataFilter(args);

    if (this.usePgvector) {
      const pg = await this.pgvectorSearch(args, queryVec);
      if (pg.length > 0) return { data: pg };
    }

    const rows = await this.prisma.embeddingDocument.findMany({
      where: {
        institutionId: args.institutionId,
        ...(args.entityId ? { entityId: args.entityId } : {}),
        ...(args.sourceTypes?.length ? { sourceType: { in: args.sourceTypes } } : {}),
        ...(args.sourceIds?.length ? { sourceId: { in: args.sourceIds } } : {}),
        ...metadataFilter,
      },
      take: 200,
    });
    const scored = rows
      .map((r) => ({
        ...r,
        score: cosineSimilarity(queryVec, r.embedding as number[]),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, args.topK ?? 5);
    return { data: scored };
  }

  private buildMetadataFilter(args: {
    courseInstanceId?: string;
  }): Prisma.EmbeddingDocumentWhereInput {
    if (!args.courseInstanceId) return {};
    return {
      metadata: {
        path: ['courseInstanceId'],
        equals: args.courseInstanceId,
      },
    };
  }

  private async pgvectorSearch(
    args: {
      institutionId: string;
      entityId?: string;
      courseInstanceId?: string;
      topK?: number;
      sourceTypes?: string[];
      sourceIds?: string[];
    },
    queryVec: number[],
  ) {
    const vec = `[${queryVec.join(',')}]`;
    const limit = args.topK ?? 5;
    let sql = `
      SELECT id, "institutionId", "entityId", "sourceType", "sourceId", content, metadata, embedding,
             ("embeddingVector" <=> $1::vector) AS score
      FROM "EmbeddingDocument"
      WHERE "institutionId" = $2 AND "embeddingVector" IS NOT NULL`;
    const params: unknown[] = [vec, args.institutionId];
    if (args.entityId) {
      params.push(args.entityId);
      sql += ` AND "entityId" = $${params.length}`;
    }
    if (args.sourceTypes?.length) {
      params.push(args.sourceTypes);
      sql += ` AND "sourceType" = ANY($${params.length}::text[])`;
    }
    if (args.sourceIds?.length) {
      params.push(args.sourceIds);
      sql += ` AND "sourceId" = ANY($${params.length}::text[])`;
    }
    if (args.courseInstanceId) {
      params.push(args.courseInstanceId);
      sql += ` AND metadata->>'courseInstanceId' = $${params.length}`;
    }
    sql += ` ORDER BY "embeddingVector" <=> $1::vector LIMIT $${params.length + 1}`;
    params.push(limit);
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        institutionId: string;
        entityId: string | null;
        sourceType: string;
        sourceId: string;
        content: string;
        metadata: unknown;
        embedding: unknown;
        score: number;
      }>
    >(sql, ...params);
    return rows.map((r) => ({ ...r, score: 1 - Number(r.score) }));
  }
}
