import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { BulkEnrollmentJobStatus, Prisma } from '@prisma/client';
import type { Queue } from 'bullmq';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { BULK_ENROLLMENT_QUEUE } from '../queues/queue.constants';
import type { CreateBulkEnrollmentDto } from './dto/create-bulk-enrollment.dto';
import { EnrollmentService } from './enrollment.service';

export type BulkEnrollmentLineResult = {
  studentId: string;
  ok: boolean;
  detail?: string;
};

export type BulkEnrollmentJobData = {
  jobId: string;
  institutionId: string;
  entityId: string;
  entityScope: 'ALL' | 'ENTITY';
  actorUserId: string;
  actorEmail: string;
  actorRole: string;
  permissions: string[];
  sectionId: string;
  waitlistIfFull: boolean;
  allowInterEntity: boolean;
};

@Injectable()
export class BulkEnrollmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly enrollment: EnrollmentService,
    @Optional() @InjectQueue(BULK_ENROLLMENT_QUEUE) private readonly queue?: Queue,
  ) {}

  async createJob(actor: AuthUser, dto: CreateBulkEnrollmentDto) {
    const ids = [...new Set(dto.studentIds.map((s) => s.trim()).filter(Boolean))];
    if (ids.length === 0) {
      throw new BadRequestException('At least one student id is required');
    }

    const section = await this.prisma.section.findFirst({
      where: { id: dto.sectionId, institutionId: actor.institutionId, deletedAt: null },
      select: { id: true, entityId: true },
    });
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    if (actor.entityScope === 'ENTITY' && section.entityId !== actor.entityId) {
      throw new NotFoundException('Section not found');
    }

    const job = await this.prisma.bulkEnrollmentJob.create({
      data: {
        institutionId: actor.institutionId,
        entityId: actor.entityScope === 'ENTITY' ? actor.entityId : section.entityId,
        sectionId: dto.sectionId,
        initiatedById: actor.userId,
        waitlistIfFull: dto.waitlistIfFull ?? false,
        status: BulkEnrollmentJobStatus.QUEUED,
        studentIds: ids as Prisma.InputJsonValue,
      },
    });

    const payload: BulkEnrollmentJobData = {
      jobId: job.id,
      institutionId: actor.institutionId,
      entityId: actor.entityId,
      entityScope: actor.entityScope,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      permissions: actor.permissions,
      sectionId: dto.sectionId,
      waitlistIfFull: dto.waitlistIfFull ?? false,
      allowInterEntity: dto.allowInterEntity ?? false,
    };

    if (this.queue) {
      await this.queue.add('process', payload, {
        jobId: job.id,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: false,
      });
    } else {
      await this.runJob(payload);
    }

    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'enrollment.bulk.queued',
      entity: 'BulkEnrollmentJob',
      entityId: job.id,
      newValues: { sectionId: dto.sectionId, count: ids.length, queued: Boolean(this.queue) },
    });

    const fresh = await this.prisma.bulkEnrollmentJob.findUnique({ where: { id: job.id } });
    return this.serializeJob(fresh ?? job);
  }

  async getJob(actor: AuthUser, jobId: string) {
    const job = await this.prisma.bulkEnrollmentJob.findFirst({
      where: { id: jobId, institutionId: actor.institutionId },
    });
    if (!job) {
      throw new NotFoundException('Bulk enrollment job not found');
    }
    return this.serializeJob(job);
  }

  async runJob(data: BulkEnrollmentJobData): Promise<void> {
    await this.prisma.bulkEnrollmentJob.update({
      where: { id: data.jobId },
      data: { status: BulkEnrollmentJobStatus.RUNNING },
    });

    const actor: AuthUser = {
      userId: data.actorUserId,
      email: data.actorEmail,
      role: data.actorRole as AuthUser['role'],
      institutionId: data.institutionId,
      entityId: data.entityId,
      entityScope: data.entityScope,
      permissions: data.permissions,
    };

    const studentIds = await this.readStudentIds(data.jobId);
    const results: BulkEnrollmentLineResult[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const studentId of studentIds) {
      try {
        await this.enrollment.create(actor, {
          studentId,
          sectionId: data.sectionId,
          waitlistIfFull: data.waitlistIfFull,
          allowInterEntity: data.allowInterEntity,
        });
        results.push({ studentId, ok: true });
        successCount += 1;
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Enrollment failed';
        results.push({ studentId, ok: false, detail });
        failCount += 1;
      }
    }

    await this.prisma.bulkEnrollmentJob.update({
      where: { id: data.jobId },
      data: {
        status: BulkEnrollmentJobStatus.COMPLETED,
        results: results as Prisma.InputJsonValue,
        successCount,
        failCount,
        completedAt: new Date(),
      },
    });
  }

  private async readStudentIds(jobId: string): Promise<string[]> {
    const job = await this.prisma.bulkEnrollmentJob.findUnique({
      where: { id: jobId },
      select: { studentIds: true },
    });
    if (!job || !Array.isArray(job.studentIds)) {
      return [];
    }
    return job.studentIds.filter((id): id is string => typeof id === 'string');
  }

  private serializeJob(job: {
    id: string;
    sectionId: string;
    status: BulkEnrollmentJobStatus;
    waitlistIfFull: boolean;
    successCount: number;
    failCount: number;
    results: unknown;
    errorMessage: string | null;
    createdAt: Date;
    completedAt: Date | null;
  }) {
    const results = Array.isArray(job.results) ? (job.results as BulkEnrollmentLineResult[]) : [];
    return {
      id: job.id,
      sectionId: job.sectionId,
      status: job.status,
      waitlistIfFull: job.waitlistIfFull,
      successCount: job.successCount,
      failCount: job.failCount,
      total: results.length || job.successCount + job.failCount,
      results,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
    };
  }
}
