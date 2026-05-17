import { Injectable, Logger } from '@nestjs/common';
import { FinanceTransactionType, StudentEnrollmentStatusEnum } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { FinanceBalanceCacheService } from './finance-balance-cache.service';
import { FinanceRepository } from './finance.repository';
import { newFinanceReference, parseFeeStructureItems, signedLedgerAmount } from './finance.util';

type InstitutionFinanceSettings = {
  finance?: { autoChargeOnEnrollment?: boolean };
};

export type EnrollmentFinanceContext = {
  institutionId: string;
  entityId: string;
  studentId: string;
  programId: string;
  semesterId: string;
  courseCode: string;
  enrollmentId: string;
  actorUserId?: string;
};

@Injectable()
export class FinanceEnrollmentChargesService {
  private readonly log = new Logger(FinanceEnrollmentChargesService.name);

  constructor(
    private readonly repo: FinanceRepository,
    private readonly audit: AuditService,
    private readonly balanceCache: FinanceBalanceCacheService,
  ) {}

  private autoChargeEnabled(settings: unknown): boolean {
    const s = (settings ?? {}) as InstitutionFinanceSettings;
    return s.finance?.autoChargeOnEnrollment !== false;
  }

  /** Prompt **9.1** — charge mandatory fee lines when a student enrolls (ACTIVE only). */
  async applyEnrollmentFees(ctx: EnrollmentFinanceContext) {
    const inst = await this.repo.getInstitutionSettings(ctx.institutionId);
    if (!this.autoChargeEnabled(inst?.settings)) {
      return { applied: [], skipped: 'auto_charge_disabled' as const };
    }

    const student = await this.repo.findStudentForFinance(ctx.institutionId, ctx.studentId);
    if (!student || student.enrollmentStatus !== StudentEnrollmentStatusEnum.ACTIVE) {
      return { applied: [], skipped: 'student_not_active' as const };
    }

    const semester = await this.repo.findSemesterWithYear(ctx.institutionId, ctx.semesterId);
    if (!semester) {
      return { applied: [], skipped: 'semester_not_found' as const };
    }

    const feeStructure = await this.repo.resolveFeeStructureForEnrollment({
      institutionId: ctx.institutionId,
      entityId: ctx.entityId,
      academicYearId: semester.academicYearId,
      programId: ctx.programId,
    });
    if (!feeStructure) {
      return { applied: [], skipped: 'no_fee_structure' as const };
    }

    const items = parseFeeStructureItems(feeStructure.items).filter((item) => {
      const when = (item.billedAt ?? 'ENROLLMENT').toUpperCase();
      if (when === 'PER_COURSE') {
        return true;
      }
      return when === 'ENROLLMENT' || when === 'ENROLL';
    });

    if (items.length <= 0) {
      return { applied: [], skipped: 'no_billable_items' as const };
    }

    const account =
      (await this.repo.findAccountByStudent(ctx.institutionId, ctx.studentId)) ??
      (await this.repo.createAccount({
        institution: { connect: { id: ctx.institutionId } },
        entity: { connect: { id: student.entityId } },
        student: { connect: { id: ctx.studentId } },
        currency: 'USD',
      }));

    const applied: Array<{ code: string; transactionId: string; amount: number }> = [];

    for (const item of items) {
      const ref = `ENR-${ctx.enrollmentId}-${item.code}`;
      const exists = await this.repo.findTransactionByReference(ref);
      if (exists) {
        continue;
      }
      const desc =
        item.billedAt?.toUpperCase() === 'PER_COURSE'
          ? `${item.name} · ${ctx.courseCode}`
          : `${item.name} · enrollment`;
      const signed = signedLedgerAmount(FinanceTransactionType.CHARGE, item.amount);
      const row = await this.repo.postLedgerEntry({
        accountId: account.id,
        institutionId: ctx.institutionId,
        entityId: student.entityId,
        type: FinanceTransactionType.CHARGE,
        signedAmount: signed,
        currency: account.currency,
        description: desc,
        reference: ref,
        processedBy: ctx.actorUserId ?? null,
      });
      await this.balanceCache.invalidate(ctx.institutionId, ctx.studentId);
      applied.push({ code: item.code, transactionId: row.id, amount: signed });
      this.audit.append({
        institutionId: ctx.institutionId,
        actorId: ctx.actorUserId ?? 'system',
        action: 'finance.enrollment.autoCharge',
        entity: 'FinanceTransaction',
        entityId: row.id,
        newValues: {
          enrollmentId: ctx.enrollmentId,
          feeCode: item.code,
          amount: signed,
        },
      });
    }

    if (applied.length > 0) {
      this.log.log(
        `Auto-charged ${applied.length} fee line(s) for enrollment ${ctx.enrollmentId} (student ${ctx.studentId})`,
      );
    }

    return { applied, skipped: null };
  }
}
