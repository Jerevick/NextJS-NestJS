import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import type { CreateLmsQuestionBankDto } from './dto/create-lms-question-bank.dto';
import type { CreateLmsQuestionBankItemDto } from './dto/create-lms-question-bank-item.dto';
import type { UpdateLmsQuestionBankDto } from './dto/update-lms-question-bank.dto';
import type { UpdateLmsQuestionBankItemDto } from './dto/update-lms-question-bank-item.dto';
import { LmsQuestionBankRepository } from './lms-question-bank.repository';
import { assertValidLmsQuestionContent } from './lms-question-content.util';

@Injectable()
export class LmsQuestionBankService {
  constructor(
    private readonly repo: LmsQuestionBankRepository,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthUser) {
    const rows = await this.repo.listBanks(actor.institutionId);
    return {
      data: rows.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        itemCount: b._count.items,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      })),
    };
  }

  async create(actor: AuthUser, dto: CreateLmsQuestionBankDto) {
    const row = await this.repo.createBank(actor.institutionId, {
      name: dto.name,
      description: dto.description,
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'lms.questionBank.create',
      entity: 'LmsQuestionBank',
      entityId: row.id,
      newValues: { name: row.name } as Prisma.InputJsonValue,
    });
    return { id: row.id, name: row.name, description: row.description };
  }

  async get(actor: AuthUser, bankId: string) {
    const b = await this.repo.findBank(actor.institutionId, bankId);
    if (!b) {
      throw new NotFoundException('Question bank not found');
    }
    return {
      id: b.id,
      name: b.name,
      description: b.description,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    };
  }

  async update(actor: AuthUser, bankId: string, dto: UpdateLmsQuestionBankDto) {
    const prior = await this.repo.findBank(actor.institutionId, bankId);
    if (!prior) {
      throw new NotFoundException('Question bank not found');
    }
    const data: Prisma.LmsQuestionBankUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      data.description = dto.description;
    }
    const r = await this.repo.updateBank(actor.institutionId, bankId, data);
    if (r.count === 0) {
      throw new NotFoundException('Question bank not found');
    }
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'lms.questionBank.update',
      entity: 'LmsQuestionBank',
      entityId: bankId,
      newValues: {} as Prisma.InputJsonValue,
    });
    return this.get(actor, bankId);
  }

  async remove(actor: AuthUser, bankId: string) {
    const prior = await this.repo.findBank(actor.institutionId, bankId);
    if (!prior) {
      throw new NotFoundException('Question bank not found');
    }
    const r = await this.repo.softDeleteBank(actor.institutionId, bankId, new Date());
    if (r.count === 0) {
      throw new NotFoundException('Question bank not found');
    }
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'lms.questionBank.delete',
      entity: 'LmsQuestionBank',
      entityId: bankId,
      newValues: { softDeleted: true } as Prisma.InputJsonValue,
    });
    return { deleted: true as const };
  }

  async listItems(actor: AuthUser, bankId: string) {
    await this.ensureBank(actor, bankId);
    const items = await this.repo.listItems(actor.institutionId, bankId);
    return {
      data: items.map((i) => this.serializeBankItem(i)),
    };
  }

  async createItem(actor: AuthUser, bankId: string, dto: CreateLmsQuestionBankItemDto) {
    await this.ensureBank(actor, bankId);
    assertValidLmsQuestionContent(dto.type, dto.content);
    const maxAgg = await this.repo.maxItemSortOrder(bankId, actor.institutionId);
    const sortOrder = dto.sortOrder ?? (maxAgg._max.sortOrder ?? -1) + 1;
    const row = await this.repo.createItem({
      bankId,
      institutionId: actor.institutionId,
      type: dto.type,
      content: dto.content as Prisma.InputJsonValue,
      points: dto.points ?? 1,
      explanation: dto.explanation?.trim() ?? null,
      tags: (dto.tags ?? []).map((t) => t.trim()).filter(Boolean),
      difficulty: dto.difficulty ?? null,
      sortOrder,
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'lms.questionBankItem.create',
      entity: 'LmsQuestionBankItem',
      entityId: row.id,
      newValues: { bankId } as Prisma.InputJsonValue,
    });
    return this.serializeBankItem(row);
  }

  async updateItem(actor: AuthUser, itemId: string, dto: UpdateLmsQuestionBankItemDto) {
    const prior = await this.repo.findItem(actor.institutionId, itemId);
    if (!prior) {
      throw new NotFoundException('Bank item not found');
    }
    const mergedType = dto.type ?? prior.type;
    const mergedContent = (dto.content ?? (prior.content as Record<string, unknown>)) as Record<
      string,
      unknown
    >;
    assertValidLmsQuestionContent(mergedType, mergedContent);

    const data: Prisma.LmsQuestionBankItemUpdateInput = {};
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.content !== undefined) data.content = dto.content as Prisma.InputJsonValue;
    if (dto.points !== undefined) data.points = dto.points;
    if (dto.explanation !== undefined) data.explanation = dto.explanation;
    if (dto.tags !== undefined) data.tags = dto.tags.map((t) => t.trim()).filter(Boolean);
    if (dto.difficulty !== undefined) data.difficulty = dto.difficulty;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    const r = await this.repo.updateItem(actor.institutionId, itemId, data);
    if (r.count === 0) {
      throw new NotFoundException('Bank item not found');
    }
    const fresh = await this.repo.findItem(actor.institutionId, itemId);
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'lms.questionBankItem.update',
      entity: 'LmsQuestionBankItem',
      entityId: itemId,
    });
    return this.serializeBankItem(fresh!);
  }

  async removeItem(actor: AuthUser, itemId: string) {
    const prior = await this.repo.findItem(actor.institutionId, itemId);
    if (!prior) {
      throw new NotFoundException('Bank item not found');
    }
    const r = await this.repo.deleteItem(actor.institutionId, itemId);
    if (r.count === 0) {
      throw new NotFoundException('Bank item not found');
    }
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'lms.questionBankItem.delete',
      entity: 'LmsQuestionBankItem',
      entityId: itemId,
    });
    return { deleted: true as const };
  }

  private serializeBankItem(i: {
    id: string;
    bankId: string;
    type: string;
    content: unknown;
    points: number;
    explanation: string | null;
    tags: string[];
    difficulty: number | null;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: i.id,
      bankId: i.bankId,
      type: i.type,
      content: i.content,
      points: i.points,
      explanation: i.explanation,
      tags: i.tags,
      difficulty: i.difficulty,
      sortOrder: i.sortOrder,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    };
  }

  private async ensureBank(actor: AuthUser, bankId: string) {
    const b = await this.repo.findBank(actor.institutionId, bankId);
    if (!b) {
      throw new NotFoundException('Question bank not found');
    }
  }
}
