import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { BulkEnrollmentJobStatus as ImportJobStatus } from '@prisma/client';
import { BulkEnrollmentJobStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { Queue } from 'bullmq';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { STUDENT_CSV_IMPORT_QUEUE } from '../queues/queue.constants';
import type { QueueStudentCsvImportDto } from './dto/queue-student-csv-import.dto';
import { parseStudentImportCsv } from './student-csv-import.parser';
import type { ParsedCsvRow } from './student-csv-import.parser';
import { StudentsService } from './students.service';

export type StudentCsvImportJobData = {
  jobId: string;
  institutionId: string;
  entityIdForActor: string;
  actorEntityScope: 'ALL' | 'ENTITY';
  actorUserId: string;
  actorEmail: string;
  actorRole: string;
  permissions: string[];
};

@Injectable()
export class StudentCsvImportService {
  private readonly log = new Logger(StudentCsvImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly students: StudentsService,
    @Optional() @InjectQueue(STUDENT_CSV_IMPORT_QUEUE) private readonly queue?: Queue,
  ) {}

  async queueJob(actor: AuthUser, dto: QueueStudentCsvImportDto) {
    const rowsPreview = parseStudentImportCsv(dto.csvText);

    const job = await this.prisma.studentCsvImportJob.create({
      data: {
        institutionId: actor.institutionId,
        entityId: dto.entityId?.trim() ?? (actor.entityScope === 'ENTITY' ? actor.entityId : null),
        initiatedById: actor.userId,
        status: BulkEnrollmentJobStatus.QUEUED,
        csvText: dto.csvText,
      },
    });

    const payload: StudentCsvImportJobData = {
      jobId: job.id,
      institutionId: actor.institutionId,
      entityIdForActor: actor.entityId,
      actorEntityScope: actor.entityScope,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      permissions: actor.permissions,
    };

    if (this.queue) {
      await this.queue.add('process', payload, {
        jobId: job.id,
        attempts: 1,
        backoff: { type: 'exponential', delay: 5000 },
      });
    } else {
      await this.runJob(payload);
    }

    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'students.csv_import.queued',
      entity: 'StudentCsvImportJob',
      entityId: job.id,
      newValues: { rowCount: rowsPreview.length, queued: Boolean(this.queue) },
    });

    const fresh = await this.prisma.studentCsvImportJob.findUnique({ where: { id: job.id } });
    return this.serializeJob(fresh ?? job);
  }

  async getJob(actor: AuthUser, jobId: string) {
    const job = await this.prisma.studentCsvImportJob.findFirst({
      where: { id: jobId, institutionId: actor.institutionId },
    });
    if (!job) {
      throw new NotFoundException('CSV import job not found');
    }
    return this.serializeJob(job);
  }

  async runJob(data: StudentCsvImportJobData): Promise<void> {
    await this.prisma.studentCsvImportJob.update({
      where: { id: data.jobId },
      data: { status: BulkEnrollmentJobStatus.RUNNING },
    });

    const actor: AuthUser = {
      userId: data.actorUserId,
      email: data.actorEmail,
      role: data.actorRole as AuthUser['role'],
      institutionId: data.institutionId,
      entityId: data.entityIdForActor,
      entityScope: data.actorEntityScope,
      permissions: data.permissions,
    };

    const rec = await this.prisma.studentCsvImportJob.findUnique({
      where: { id: data.jobId },
      select: { csvText: true },
    });
    const csvText = rec?.csvText ?? '';

    let parsed: ParsedCsvRow[];
    try {
      parsed = parseStudentImportCsv(csvText);
    } catch (err: unknown) {
      const message = err instanceof BadRequestException ? err.message : 'Invalid CSV payload';
      this.log.warn(`student-csv-import ${data.jobId}: ${message}`);
      await this.prisma.studentCsvImportJob.update({
        where: { id: data.jobId },
        data: {
          status: BulkEnrollmentJobStatus.FAILED,
          errorMessage: message,
          completedAt: new Date(),
        },
      });
      return;
    }

    type LineOutcome = {
      index: number;
      ok: boolean;
      studentId?: string;
      studentNumber?: string;
      message?: string;
    };
    const lineResults: LineOutcome[] = [];
    let okCount = 0;
    let failCount = 0;

    for (let i = 0; i < parsed.length; i++) {
      try {
        const created = await this.students.create(
          actor,
          parsed[i]! as Parameters<StudentsService['create']>[1],
        );
        lineResults.push({
          index: i,
          ok: true,
          studentId: created.id,
          studentNumber: created.studentNumber,
        });
        okCount += 1;
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        lineResults.push({ index: i, ok: false, message });
        failCount += 1;
      }
    }

    await this.prisma.studentCsvImportJob.update({
      where: { id: data.jobId },
      data: {
        status: BulkEnrollmentJobStatus.COMPLETED,
        successCount: okCount,
        failCount,
        results: lineResults as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
  }

  private serializeJob(job: {
    id: string;
    status: ImportJobStatus;
    successCount: number;
    failCount: number;
    results: unknown;
    errorMessage: string | null;
    createdAt: Date;
    completedAt: Date | null;
  }) {
    return {
      id: job.id,
      status: job.status,
      successCount: job.successCount,
      failCount: job.failCount,
      total:
        typeof job.results === 'object' && Array.isArray(job.results)
          ? job.results.length
          : job.successCount + job.failCount,
      results: Array.isArray(job.results) ? job.results : [],
      errorMessage: job.errorMessage,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
    };
  }
}
