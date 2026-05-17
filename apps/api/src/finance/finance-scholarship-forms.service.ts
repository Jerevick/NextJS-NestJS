import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  parseDynamicFormSchema,
  validateDynamicFormResponses,
  type DynamicFormSchema,
} from '../common/forms/dynamic-form.schema';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FinanceScholarshipFormsService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveApplicationSchema(
    institutionId: string,
    scholarshipId: string,
  ): Promise<{ scholarshipId: string; schema: DynamicFormSchema | null; source: string }> {
    const scholarship = await this.prisma.financeScholarship.findFirst({
      where: { id: scholarshipId, institutionId, deletedAt: null },
      select: {
        id: true,
        applicationSchemaId: true,
        conditions: true,
      },
    });
    if (!scholarship) {
      throw new NotFoundException('Scholarship not found');
    }

    if (scholarship.applicationSchemaId) {
      const form = await this.prisma.applicationForm.findFirst({
        where: {
          id: scholarship.applicationSchemaId,
          institutionId,
          deletedAt: null,
        },
        select: { schema: true },
      });
      if (form) {
        const schema = parseDynamicFormSchema(form.schema);
        if (schema) {
          return { scholarshipId, schema, source: 'application_form' };
        }
      }
    }

    const conditions =
      scholarship.conditions &&
      typeof scholarship.conditions === 'object' &&
      !Array.isArray(scholarship.conditions)
        ? (scholarship.conditions as Record<string, unknown>)
        : {};
    const inline = parseDynamicFormSchema(conditions.applicationForm ?? conditions.schema);
    if (inline) {
      return { scholarshipId, schema: inline, source: 'scholarship_conditions' };
    }

    return { scholarshipId, schema: null, source: 'none' };
  }

  validateSubmission(schema: DynamicFormSchema, responses: Record<string, unknown>) {
    const result = validateDynamicFormResponses(schema, responses);
    if (!result.valid) {
      throw new BadRequestException(result.errors.join('; '));
    }
  }
}
