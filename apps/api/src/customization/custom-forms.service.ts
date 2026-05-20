import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CustomFormStatus, CustomFormType, Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import {
  inputFields,
  isFieldVisible,
  parseDynamicFormSchema,
  validateDynamicFormResponses,
} from '../common/forms/dynamic-form.schema';
import { assertEntityAccess, assertInstitutionAccess } from '../org-structure/org-structure.utils';
import { CustomizationRepository } from './customization.repository';
import type {
  CreateCustomFormDto,
  SubmitCustomFormDto,
  UpdateCustomFormDto,
} from './dto/custom-form.dto';

@Injectable()
export class CustomFormsService {
  constructor(
    private readonly repo: CustomizationRepository,
    private readonly audit: AuditService,
  ) {}

  private assertManage(actor: AuthUser) {
    if (!(actor.permissions.includes('*') || actor.permissions.includes('institutions.write'))) {
      throw new ForbiddenException('Missing institutions.write permission');
    }
  }

  private scopeEntityId(actor: AuthUser, entityId?: string | null): string | undefined {
    if (actor.entityScope === 'ENTITY') {
      return actor.entityId;
    }
    return entityId ?? undefined;
  }

  async list(
    actor: AuthUser,
    query: { formType?: CustomFormType; status?: CustomFormStatus; entityId?: string },
  ) {
    this.assertManage(actor);
    const entityId = this.scopeEntityId(actor, query.entityId);
    const rows = await this.repo.listForms(actor.institutionId, {
      entityId,
      formType: query.formType,
      status: query.status,
    });
    return rows.map((r) => this.serialize(r));
  }

  async create(actor: AuthUser, dto: CreateCustomFormDto) {
    this.assertManage(actor);
    assertInstitutionAccess(actor, actor.institutionId);
    const entityId = this.scopeEntityId(actor, dto.entityId);
    if (entityId) {
      assertEntityAccess(actor, entityId);
      const ent = await this.repo.findEntity(actor.institutionId, entityId);
      if (!ent) throw new NotFoundException('Entity not found');
    }
    const schema = parseDynamicFormSchema(dto.schema);
    if (!schema) {
      throw new BadRequestException('Invalid form schema — requires at least one field');
    }

    const row = await this.repo.createForm({
      institution: { connect: { id: actor.institutionId } },
      ...(entityId ? { entity: { connect: { id: entityId } } } : {}),
      formType: dto.formType,
      title: dto.title.trim(),
      description: dto.description?.trim() ?? null,
      schema: dto.schema as Prisma.InputJsonValue,
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'custom_form.create',
      entity: 'CustomForm',
      entityId: row.id,
      newValues: { formType: row.formType, title: row.title },
    });
    return this.serialize(row);
  }

  async get(actor: AuthUser, formId: string) {
    this.assertManage(actor);
    const row = await this.repo.findForm(actor.institutionId, formId);
    if (!row) throw new NotFoundException('Form not found');
    if (row.entityId && actor.entityScope === 'ENTITY' && row.entityId !== actor.entityId) {
      throw new ForbiddenException('Form is outside your entity scope');
    }
    return this.serialize(row);
  }

  async update(actor: AuthUser, formId: string, dto: UpdateCustomFormDto) {
    this.assertManage(actor);
    const existing = await this.repo.findForm(actor.institutionId, formId);
    if (!existing) throw new NotFoundException('Form not found');
    if (
      existing.entityId &&
      actor.entityScope === 'ENTITY' &&
      existing.entityId !== actor.entityId
    ) {
      throw new ForbiddenException('Form is outside your entity scope');
    }

    if (dto.schema) {
      const schema = parseDynamicFormSchema(dto.schema);
      if (!schema) throw new BadRequestException('Invalid form schema');
    }

    const data: Prisma.CustomFormUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) data.description = dto.description?.trim() ?? null;
    if (dto.schema !== undefined) data.schema = dto.schema as Prisma.InputJsonValue;
    if (dto.status !== undefined) {
      data.status = dto.status;
      data.publishedAt = dto.status === 'PUBLISHED' ? new Date() : existing.publishedAt;
    }

    const row = await this.repo.updateForm(formId, data);
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'custom_form.update',
      entity: 'CustomForm',
      entityId: formId,
      newValues: { status: row.status },
    });
    return this.serialize(row);
  }

  async remove(actor: AuthUser, formId: string) {
    this.assertManage(actor);
    const existing = await this.repo.findForm(actor.institutionId, formId);
    if (!existing) throw new NotFoundException('Form not found');
    await this.repo.softDeleteForm(actor.institutionId, formId, new Date());
    return { ok: true as const, id: formId };
  }

  async getPublishedSchema(formId: string) {
    const form = await this.repo.findPublishedForm(formId);
    if (!form) {
      throw new NotFoundException('Published form not found');
    }
    const schema = parseDynamicFormSchema(form.schema);
    return {
      id: form.id,
      title: form.title,
      description: form.description,
      formType: form.formType,
      schema: schema ?? form.schema,
    };
  }

  async submit(actor: AuthUser, formId: string, dto: SubmitCustomFormDto) {
    const form = await this.repo.findForm(actor.institutionId, formId);
    if (!form) throw new NotFoundException('Form not found');
    if (form.status !== 'PUBLISHED') {
      throw new BadRequestException('This form is not accepting submissions');
    }
    if (form.entityId && actor.entityScope === 'ENTITY' && form.entityId !== actor.entityId) {
      throw new ForbiddenException('Form is outside your entity scope');
    }

    const schema = parseDynamicFormSchema(form.schema);
    if (!schema) throw new BadRequestException('Form schema is invalid');
    const { valid, errors } = validateDynamicFormResponses(schema, dto.data);
    if (!valid) {
      throw new BadRequestException({ message: 'Validation failed', errors });
    }

    const row = await this.repo.createSubmission({
      institution: { connect: { id: actor.institutionId } },
      form: { connect: { id: formId } },
      ...(form.entityId ? { entity: { connect: { id: form.entityId } } } : {}),
      submittedBy: { connect: { id: actor.userId } },
      data: dto.data as Prisma.InputJsonValue,
    });
    return { id: row.id, formId, createdAt: row.createdAt.toISOString() };
  }

  async analytics(actor: AuthUser, formId: string) {
    this.assertManage(actor);
    const form = await this.repo.findForm(actor.institutionId, formId);
    if (!form) throw new NotFoundException('Form not found');
    if (form.entityId && actor.entityScope === 'ENTITY' && form.entityId !== actor.entityId) {
      throw new ForbiddenException('Form is outside your entity scope');
    }

    const schema = parseDynamicFormSchema(form.schema);
    const total = await this.repo.countSubmissions(formId);
    const recent = await this.repo.listSubmissions(formId, 500);
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const trendRows = await this.repo.listSubmissionDatesSince(formId, since30);

    const fieldStats: Record<
      string,
      { answered: number; completionRate: number; sampleValues: string[] }
    > = {};

    const fields = schema ? inputFields(schema) : [];
    for (const field of fields) {
      let answered = 0;
      let visibleCount = 0;
      const samples: string[] = [];
      for (const sub of recent) {
        const data = sub.data as Record<string, unknown>;
        if (!isFieldVisible(field, data)) {
          continue;
        }
        visibleCount += 1;
        const val = data[field.id];
        const empty =
          val === undefined ||
          val === null ||
          val === '' ||
          (Array.isArray(val) && val.length === 0);
        if (!empty) {
          answered += 1;
          if (samples.length < 5) {
            samples.push(typeof val === 'string' ? val : JSON.stringify(val));
          }
        }
      }
      const denom = visibleCount > 0 ? visibleCount : total;
      fieldStats[field.id] = {
        answered,
        completionRate: denom > 0 ? Math.round((answered / denom) * 1000) / 10 : 0,
        sampleValues: samples,
      };
    }

    const last7 = recent.filter(
      (s) => s.createdAt.getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).length;

    const trendByDay: Record<string, number> = {};
    for (const row of trendRows) {
      const day = row.createdAt.toISOString().slice(0, 10);
      trendByDay[day] = (trendByDay[day] ?? 0) + 1;
    }
    const submissionTrend = Object.entries(trendByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    const requiredCount = fields.filter((f) => f.required).length;
    let fullyComplete = 0;
    for (const sub of recent) {
      const data = sub.data as Record<string, unknown>;
      const ok = fields
        .filter((f) => f.required && isFieldVisible(f, data))
        .every((f) => {
          const val = data[f.id];
          return (
            val !== undefined && val !== null && val !== '' && !(Array.isArray(val) && !val.length)
          );
        });
      if (ok) fullyComplete += 1;
    }

    return {
      formId,
      title: form.title,
      formType: form.formType,
      status: form.status,
      totalSubmissions: total,
      submissionsLast7Days: last7,
      responseRate:
        total > 0 && requiredCount > 0
          ? Math.round((fullyComplete / total) * 1000) / 10
          : total > 0
            ? 100
            : 0,
      fieldStats,
      submissionTrend,
    };
  }

  private serialize(row: {
    id: string;
    institutionId: string;
    entityId: string | null;
    formType: CustomFormType;
    status: CustomFormStatus;
    title: string;
    description: string | null;
    schema: unknown;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      institutionId: row.institutionId,
      entityId: row.entityId,
      formType: row.formType,
      status: row.status,
      title: row.title,
      description: row.description,
      schema: row.schema,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
