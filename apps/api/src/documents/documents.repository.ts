import { Injectable } from '@nestjs/common';
import type { DocumentStatus, DocumentType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DocumentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserInInstitution(institutionId: string, userId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId, institutionId, deletedAt: null },
      select: { id: true },
    });
  }

  createDocument(data: {
    institutionId: string;
    ownerId: string;
    type: DocumentType;
    title: string;
    expiresAt: Date | null;
  }) {
    return this.prisma.document.create({
      data: {
        institutionId: data.institutionId,
        ownerId: data.ownerId,
        type: data.type,
        title: data.title,
        expiresAt: data.expiresAt,
      },
      include: {
        owner: { select: { id: true, email: true, profile: true } },
      },
    });
  }

  findById(institutionId: string, id: string) {
    return this.prisma.document.findFirst({
      where: { id, institutionId, deletedAt: null },
      include: {
        owner: { select: { id: true, email: true, profile: true } },
      },
    });
  }

  buildListWhere(args: {
    institutionId: string;
    ownerId?: string;
    type?: DocumentType;
    status?: DocumentStatus;
  }): Prisma.DocumentWhereInput {
    const where: Prisma.DocumentWhereInput = {
      institutionId: args.institutionId,
      deletedAt: null,
    };
    if (args.ownerId) {
      where.ownerId = args.ownerId;
    }
    if (args.type) {
      where.type = args.type;
    }
    if (args.status) {
      where.status = args.status;
    }
    return where;
  }

  findPage(where: Prisma.DocumentWhereInput, take: number, cursor?: string) {
    return this.prisma.document.findMany({
      where,
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        owner: { select: { id: true, email: true, profile: true } },
      },
    });
  }

  countWhere(where: Prisma.DocumentWhereInput) {
    return this.prisma.document.count({ where });
  }

  updateDocument(id: string, data: Prisma.DocumentUpdateInput) {
    return this.prisma.document.update({
      where: { id },
      data,
      include: {
        owner: { select: { id: true, email: true, profile: true } },
      },
    });
  }

  softDeleteDocument(institutionId: string, id: string, at: Date) {
    return this.prisma.document.updateMany({
      where: { id, institutionId, deletedAt: null },
      data: { deletedAt: at },
    });
  }

  listTemplates(institutionId: string) {
    return this.prisma.documentTemplate.findMany({
      where: { institutionId, deletedAt: null },
      orderBy: [{ type: 'asc' }],
    });
  }

  findTemplate(institutionId: string, id: string) {
    return this.prisma.documentTemplate.findFirst({
      where: { id, institutionId, deletedAt: null },
    });
  }

  upsertTemplate(data: { institutionId: string; type: DocumentType; templateKey: string }) {
    return this.prisma.documentTemplate.upsert({
      where: {
        institutionId_type: {
          institutionId: data.institutionId,
          type: data.type,
        },
      },
      create: {
        institutionId: data.institutionId,
        type: data.type,
        templateKey: data.templateKey,
      },
      update: {
        templateKey: data.templateKey,
        deletedAt: null,
      },
    });
  }

  updateTemplateById(id: string, templateKey: string) {
    return this.prisma.documentTemplate.update({
      where: { id },
      data: { templateKey },
    });
  }

  softDeleteTemplate(institutionId: string, id: string, at: Date) {
    return this.prisma.documentTemplate.updateMany({
      where: { id, institutionId, deletedAt: null },
      data: { deletedAt: at },
    });
  }
}
