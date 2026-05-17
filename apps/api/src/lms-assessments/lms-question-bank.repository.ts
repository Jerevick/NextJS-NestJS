import { Injectable } from '@nestjs/common';
import type { LmsQuestionType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LmsQuestionBankRepository {
  constructor(private readonly prisma: PrismaService) {}

  listBanks(institutionId: string) {
    return this.prisma.lmsQuestionBank.findMany({
      where: { institutionId, deletedAt: null },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { items: true } },
      },
    });
  }

  createBank(institutionId: string, data: { name: string; description?: string | null }) {
    return this.prisma.lmsQuestionBank.create({
      data: {
        institutionId,
        name: data.name.trim(),
        description: data.description?.trim() ?? null,
      },
    });
  }

  findBank(institutionId: string, bankId: string) {
    return this.prisma.lmsQuestionBank.findFirst({
      where: { id: bankId, institutionId, deletedAt: null },
    });
  }

  updateBank(institutionId: string, bankId: string, data: Prisma.LmsQuestionBankUpdateInput) {
    return this.prisma.lmsQuestionBank.updateMany({
      where: { id: bankId, institutionId, deletedAt: null },
      data,
    });
  }

  softDeleteBank(institutionId: string, bankId: string, deletedAt: Date) {
    return this.prisma.lmsQuestionBank.updateMany({
      where: { id: bankId, institutionId, deletedAt: null },
      data: { deletedAt },
    });
  }

  listItems(institutionId: string, bankId: string) {
    return this.prisma.lmsQuestionBankItem.findMany({
      where: { institutionId, bankId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /** Used for cloning into assessments; returns rows in unspecified order — caller resolves order from requested ids */
  findItemsByIds(institutionId: string, ids: string[]) {
    return this.prisma.lmsQuestionBankItem.findMany({
      where: { institutionId, id: { in: ids } },
    });
  }

  maxItemSortOrder(bankId: string, institutionId: string) {
    return this.prisma.lmsQuestionBankItem.aggregate({
      where: { bankId, institutionId },
      _max: { sortOrder: true },
    });
  }

  createItem(data: {
    bankId: string;
    institutionId: string;
    type: LmsQuestionType;
    content: Prisma.InputJsonValue;
    points: number;
    explanation?: string | null;
    tags: string[];
    difficulty?: number | null;
    sortOrder: number;
  }) {
    return this.prisma.lmsQuestionBankItem.create({ data });
  }

  findItem(institutionId: string, itemId: string) {
    return this.prisma.lmsQuestionBankItem.findFirst({
      where: { id: itemId, institutionId },
    });
  }

  updateItem(institutionId: string, itemId: string, data: Prisma.LmsQuestionBankItemUpdateInput) {
    return this.prisma.lmsQuestionBankItem.updateMany({
      where: { id: itemId, institutionId },
      data,
    });
  }

  deleteItem(institutionId: string, itemId: string) {
    return this.prisma.lmsQuestionBankItem.deleteMany({
      where: { id: itemId, institutionId },
    });
  }
}
