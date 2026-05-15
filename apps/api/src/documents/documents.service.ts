import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { DocumentStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import type { CreateDocumentDto } from './dto/create-document.dto';
import type { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import type { UpdateDocumentDto } from './dto/update-document.dto';
import type { UpdateDocumentTemplateDto } from './dto/update-document-template.dto';
import type { UpsertDocumentTemplateDto } from './dto/upsert-document-template.dto';
import { DocumentsRepository } from './documents.repository';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly repo: DocumentsRepository,
    private readonly audit: AuditService,
  ) {}

  private async assertOwnerInInstitution(institutionId: string, ownerId: string) {
    const u = await this.repo.findUserInInstitution(institutionId, ownerId);
    if (!u) {
      throw new BadRequestException('Owner user not found in this institution');
    }
  }

  async create(actor: AuthUser, dto: CreateDocumentDto) {
    await this.assertOwnerInInstitution(actor.institutionId, dto.ownerId);
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('Invalid expiresAt');
    }
    const row = await this.repo.createDocument({
      institutionId: actor.institutionId,
      ownerId: dto.ownerId,
      type: dto.type,
      title: dto.title.trim(),
      expiresAt,
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'document.create',
      entity: 'Document',
      entityId: row.id,
      newValues: { type: row.type, title: row.title, ownerId: row.ownerId, status: row.status },
    });
    return this.serializeDocument(row);
  }

  async list(actor: AuthUser, query: ListDocumentsQueryDto) {
    if (query.ownerId) {
      await this.assertOwnerInInstitution(actor.institutionId, query.ownerId);
    }
    const limit = query.limit ?? 20;
    const where = this.repo.buildListWhere({
      institutionId: actor.institutionId,
      ownerId: query.ownerId,
      type: query.type,
      status: query.status,
    });
    const rows = await this.repo.findPage(where, limit, query.cursor);
    let nextCursor: string | undefined;
    if (rows.length > limit) {
      const last = rows.pop();
      nextCursor = last?.id;
    }
    const total = await this.repo.countWhere(where);
    return {
      data: rows.map((r) => this.serializeDocument(r)),
      nextCursor,
      total,
    };
  }

  async getById(actor: AuthUser, id: string) {
    const row = await this.repo.findById(actor.institutionId, id);
    if (!row) {
      throw new NotFoundException('Document not found');
    }
    return this.serializeDocument(row);
  }

  async update(actor: AuthUser, id: string, dto: UpdateDocumentDto) {
    const existing = await this.repo.findById(actor.institutionId, id);
    if (!existing) {
      throw new NotFoundException('Document not found');
    }
    const data: {
      status?: DocumentStatus;
      fileKey?: string | null;
      title?: string;
      generatedAt?: Date | null;
      issuedAt?: Date | null;
      expiresAt?: Date | null;
    } = {};
    if (dto.status !== undefined) {
      data.status = dto.status;
    }
    if (dto.fileKey !== undefined) {
      data.fileKey = dto.fileKey;
    }
    if (dto.title !== undefined) {
      data.title = dto.title.trim();
    }
    if (dto.generatedAt !== undefined) {
      const d = new Date(dto.generatedAt);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('Invalid generatedAt');
      }
      data.generatedAt = d;
    }
    if (dto.issuedAt !== undefined) {
      const d = new Date(dto.issuedAt);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('Invalid issuedAt');
      }
      data.issuedAt = d;
    }
    if (dto.expiresAt !== undefined) {
      const d = new Date(dto.expiresAt);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('Invalid expiresAt');
      }
      data.expiresAt = d;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    const updated = await this.repo.updateDocument(existing.id, data as Prisma.DocumentUpdateInput);
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'document.update',
      entity: 'Document',
      entityId: existing.id,
      oldValues: {
        status: existing.status,
        title: existing.title,
        fileKey: existing.fileKey,
        generatedAt: existing.generatedAt,
        issuedAt: existing.issuedAt,
        expiresAt: existing.expiresAt,
      },
      newValues: {
        status: updated.status,
        title: updated.title,
        fileKey: updated.fileKey,
        generatedAt: updated.generatedAt,
        issuedAt: updated.issuedAt,
        expiresAt: updated.expiresAt,
      },
    });
    return this.serializeDocument(updated);
  }

  async remove(actor: AuthUser, id: string) {
    const existing = await this.repo.findById(actor.institutionId, id);
    if (!existing) {
      throw new NotFoundException('Document not found');
    }
    const n = await this.repo.softDeleteDocument(actor.institutionId, id, new Date());
    if (n.count === 0) {
      throw new NotFoundException('Document not found');
    }
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'document.delete',
      entity: 'Document',
      entityId: id,
      oldValues: { title: existing.title, type: existing.type, status: existing.status },
      newValues: { softDeleted: true },
    });
    return { ok: true as const, id };
  }

  async listTemplates(actor: AuthUser) {
    const rows = await this.repo.listTemplates(actor.institutionId);
    return rows.map((t) => this.serializeTemplate(t));
  }

  async upsertTemplate(actor: AuthUser, dto: UpsertDocumentTemplateDto) {
    const row = await this.repo.upsertTemplate({
      institutionId: actor.institutionId,
      type: dto.type,
      templateKey: dto.templateKey.trim(),
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'document_template.upsert',
      entity: 'DocumentTemplate',
      entityId: row.id,
      newValues: { type: row.type, templateKey: row.templateKey },
    });
    return this.serializeTemplate(row);
  }

  async updateTemplate(actor: AuthUser, id: string, dto: UpdateDocumentTemplateDto) {
    const existing = await this.repo.findTemplate(actor.institutionId, id);
    if (!existing) {
      throw new NotFoundException('Template not found');
    }
    const row = await this.repo.updateTemplateById(existing.id, dto.templateKey.trim());
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'document_template.update',
      entity: 'DocumentTemplate',
      entityId: existing.id,
      oldValues: { templateKey: existing.templateKey, type: existing.type },
      newValues: { templateKey: row.templateKey, type: row.type },
    });
    return this.serializeTemplate(row);
  }

  async removeTemplate(actor: AuthUser, id: string) {
    const existing = await this.repo.findTemplate(actor.institutionId, id);
    if (!existing) {
      throw new NotFoundException('Template not found');
    }
    const n = await this.repo.softDeleteTemplate(actor.institutionId, id, new Date());
    if (n.count === 0) {
      throw new NotFoundException('Template not found');
    }
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'document_template.delete',
      entity: 'DocumentTemplate',
      entityId: id,
      oldValues: { templateKey: existing.templateKey, type: existing.type },
      newValues: { softDeleted: true },
    });
    return { ok: true as const, id };
  }

  private serializeDocument(
    row: NonNullable<Awaited<ReturnType<DocumentsRepository['findById']>>>,
  ) {
    return {
      id: row.id,
      ownerId: row.ownerId,
      type: row.type,
      title: row.title,
      fileKey: row.fileKey,
      status: row.status,
      requestedAt: row.requestedAt,
      generatedAt: row.generatedAt,
      issuedAt: row.issuedAt,
      expiresAt: row.expiresAt,
      owner: row.owner,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private serializeTemplate(row: {
    id: string;
    institutionId: string;
    type: string;
    templateKey: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      type: row.type,
      templateKey: row.templateKey,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
