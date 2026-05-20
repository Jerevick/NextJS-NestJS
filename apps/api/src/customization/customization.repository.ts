import { Injectable } from '@nestjs/common';
import type { CustomFormStatus, CustomFormType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  findInstitution(institutionId: string) {
    return this.prisma.institution.findFirst({
      where: { id: institutionId, deletedAt: null },
      select: { id: true, name: true, domain: true, settings: true },
    });
  }

  updateInstitutionSettings(institutionId: string, settings: Prisma.InputJsonValue) {
    return this.prisma.institution.update({
      where: { id: institutionId },
      data: { settings },
      select: { id: true, settings: true },
    });
  }

  findEntity(institutionId: string, entityId: string) {
    return this.prisma.institutionEntity.findFirst({
      where: { id: entityId, institutionId, deletedAt: null },
      select: { id: true, name: true, settings: true },
    });
  }

  updateEntitySettings(institutionId: string, entityId: string, settings: Prisma.InputJsonValue) {
    return this.prisma.institutionEntity.updateMany({
      where: { id: entityId, institutionId, deletedAt: null },
      data: { settings },
    });
  }

  listForms(
    institutionId: string,
    filters: { entityId?: string; formType?: CustomFormType; status?: CustomFormStatus },
  ) {
    return this.prisma.customForm.findMany({
      where: {
        institutionId,
        deletedAt: null,
        ...(filters.entityId !== undefined ? { entityId: filters.entityId } : {}),
        ...(filters.formType ? { formType: filters.formType } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  findForm(institutionId: string, formId: string) {
    return this.prisma.customForm.findFirst({
      where: { id: formId, institutionId, deletedAt: null },
    });
  }

  createForm(data: Prisma.CustomFormCreateInput) {
    return this.prisma.customForm.create({ data });
  }

  updateForm(id: string, data: Prisma.CustomFormUpdateInput) {
    return this.prisma.customForm.update({ where: { id }, data });
  }

  softDeleteForm(institutionId: string, formId: string, deletedAt: Date) {
    return this.prisma.customForm.updateMany({
      where: { id: formId, institutionId, deletedAt: null },
      data: { deletedAt },
    });
  }

  createSubmission(data: Prisma.FormSubmissionCreateInput) {
    return this.prisma.formSubmission.create({ data });
  }

  countSubmissions(formId: string) {
    return this.prisma.formSubmission.count({ where: { formId } });
  }

  listSubmissions(formId: string, take: number) {
    return this.prisma.formSubmission.findMany({
      where: { formId },
      orderBy: { createdAt: 'desc' },
      take,
      select: { id: true, data: true, createdAt: true, submittedById: true },
    });
  }

  findPublishedForm(formId: string) {
    return this.prisma.customForm.findFirst({
      where: { id: formId, status: 'PUBLISHED', deletedAt: null },
      select: {
        id: true,
        title: true,
        description: true,
        formType: true,
        schema: true,
        institutionId: true,
        entityId: true,
      },
    });
  }

  listSubmissionDatesSince(formId: string, since: Date) {
    return this.prisma.formSubmission.findMany({
      where: { formId, createdAt: { gte: since } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }
}
