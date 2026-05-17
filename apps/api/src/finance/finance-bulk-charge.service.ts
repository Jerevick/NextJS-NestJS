import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import {
  FinanceBulkChargeJobStatus,
  FinanceTransactionType,
  Prisma,
  StudentEnrollmentStatusEnum,
} from '@prisma/client';
import type { Queue } from 'bullmq';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { FINANCE_BULK_CHARGE_QUEUE } from '../queues/queue.constants';
import type { CreateBulkChargeDto } from './dto/create-bulk-charge.dto';
import { FinanceBalanceCacheService } from './finance-balance-cache.service';
import { FinanceRepository } from './finance.repository';
import { newFinanceReference, signedLedgerAmount } from './finance.util';

export type FinanceBulkChargeJobData = {
  jobId: string;
  institutionId: string;
  entityId: string;
  programId: string;
  amount: number;
  description: string;
  actorUserId: string;
};

export type BulkChargeLineResult = { studentId: string; ok: boolean; detail?: string };

@Injectable()
export class FinanceBulkChargeService {
  private readonly log = new Logger(FinanceBulkChargeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: FinanceRepository,
    private readonly audit: AuditService,
    private readonly balanceCache: FinanceBalanceCacheService,
    @Optional() @InjectQueue(FINANCE_BULK_CHARGE_QUEUE) private readonly queue?: Queue,
  ) {}

  async createJob(actor: AuthUser, dto: CreateBulkChargeDto) {
    const entityId = actor.entityScope === 'ENTITY' ? actor.entityId : dto.entityId?.trim();
    if (!entityId) {
      throw new BadRequestException('entityId is required for institution-wide bulk charges');
    }

    const program = await this.prisma.program.findFirst({
      where: { id: dto.programId, institutionId: actor.institutionId, deletedAt: null },
      select: { id: true, entityId: true },
    });
    if (!program) {
      throw new NotFoundException('Programme not found');
    }
    if (program.entityId !== entityId) {
      throw new BadRequestException('Programme does not belong to the selected entity');
    }

    const job = await this.prisma.financeBulkChargeJob.create({
      data: {
        institutionId: actor.institutionId,
        entityId,
        programId: dto.programId,
        initiatedById: actor.userId,
        amount: dto.amount,
        description: dto.description.trim(),
        status: FinanceBulkChargeJobStatus.QUEUED,
      },
    });

    const payload: FinanceBulkChargeJobData = {
      jobId: job.id,
      institutionId: actor.institutionId,
      entityId,
      programId: dto.programId,
      amount: dto.amount,
      description: dto.description.trim(),
      actorUserId: actor.userId,
    };

    if (this.queue) {
      await this.queue.add('bulk-charge', payload, { jobId: job.id });
      return { jobId: job.id, status: job.status, mode: 'queued' as const };
    }

    await this.runJob(payload);
    const done = await this.prisma.financeBulkChargeJob.findUnique({ where: { id: job.id } });
    return {
      jobId: job.id,
      status: done?.status ?? FinanceBulkChargeJobStatus.COMPLETED,
      mode: 'sync' as const,
      successCount: done?.successCount ?? 0,
      failCount: done?.failCount ?? 0,
    };
  }

  async runJob(data: FinanceBulkChargeJobData) {
    await this.prisma.financeBulkChargeJob.update({
      where: { id: data.jobId },
      data: { status: FinanceBulkChargeJobStatus.RUNNING },
    });

    const students = await this.prisma.student.findMany({
      where: {
        institutionId: data.institutionId,
        entityId: data.entityId,
        programId: data.programId,
        enrollmentStatus: StudentEnrollmentStatusEnum.ACTIVE,
        deletedAt: null,
      },
      select: { id: true, entityId: true },
    });

    const results: BulkChargeLineResult[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const student of students) {
      try {
        const account =
          (await this.repo.findAccountByStudent(data.institutionId, student.id)) ??
          (await this.repo.createAccount({
            institution: { connect: { id: data.institutionId } },
            entity: { connect: { id: student.entityId } },
            student: { connect: { id: student.id } },
            currency: 'USD',
          }));

        const ref = `BLK-${data.jobId}-${student.id}`;
        const exists = await this.repo.findTransactionByReference(ref);
        if (exists) {
          results.push({ studentId: student.id, ok: true, detail: 'already_charged' });
          successCount += 1;
          continue;
        }

        const signed = signedLedgerAmount(FinanceTransactionType.CHARGE, data.amount);
        await this.repo.postLedgerEntry({
          accountId: account.id,
          institutionId: data.institutionId,
          entityId: student.entityId,
          type: FinanceTransactionType.CHARGE,
          signedAmount: signed,
          currency: account.currency,
          description: data.description,
          reference: ref,
          processedBy: data.actorUserId,
        });
        await this.balanceCache.invalidate(data.institutionId, student.id);
        results.push({ studentId: student.id, ok: true });
        successCount += 1;
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        results.push({ studentId: student.id, ok: false, detail });
        failCount += 1;
      }
    }

    await this.prisma.financeBulkChargeJob.update({
      where: { id: data.jobId },
      data: {
        status: FinanceBulkChargeJobStatus.COMPLETED,
        results: results as unknown as Prisma.InputJsonValue,
        successCount,
        failCount,
        completedAt: new Date(),
      },
    });

    this.audit.append({
      institutionId: data.institutionId,
      actorId: data.actorUserId,
      action: 'finance.bulkCharge.complete',
      entity: 'FinanceBulkChargeJob',
      entityId: data.jobId,
      newValues: { successCount, failCount } as Prisma.InputJsonValue,
    });

    this.log.log(`Bulk charge ${data.jobId}: ${successCount} ok, ${failCount} failed`);
  }

  async getJob(actor: AuthUser, jobId: string) {
    const job = await this.prisma.financeBulkChargeJob.findFirst({
      where: { id: jobId, institutionId: actor.institutionId },
    });
    if (!job) {
      throw new NotFoundException('Bulk charge job not found');
    }
    if (actor.entityScope === 'ENTITY' && job.entityId !== actor.entityId) {
      throw new NotFoundException('Bulk charge job not found');
    }
    return job;
  }
}
