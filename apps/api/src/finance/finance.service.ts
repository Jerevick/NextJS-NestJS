import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  FinanceAwardStatus,
  FinanceScholarshipApplicationStatus,
  FinanceTransactionStatus,
  FinanceTransactionType,
  Prisma,
  StudentEnrollmentStatusEnum,
} from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import type {
  CreateFinanceScholarshipDto,
  CreateScholarshipAwardDto,
} from './dto/create-finance-scholarship.dto';
import type { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import type { PostStudentChargeDto } from './dto/post-student-charge.dto';
import type { PostStudentPaymentDto } from './dto/post-student-payment.dto';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { FinanceBalanceCacheService } from './finance-balance-cache.service';
import { financeReceiptToPdfBuffer } from './finance-receipt-pdf.util';
import { FinanceRepository } from './finance.repository';
import type { CreatePaymentPlanDto } from './dto/create-payment-plan.dto';
import type { RequestFeeWaiverDto } from './dto/request-fee-waiver.dto';
import type { RequestFinanceRefundDto } from './dto/request-finance-refund.dto';
import type {
  ReviewScholarshipApplicationDto,
  SubmitScholarshipApplicationDto,
} from './dto/submit-scholarship-application.dto';
import { FinanceNotificationsService } from './finance-notifications.service';
import { FinanceScholarshipFormsService } from './finance-scholarship-forms.service';
import { FinanceReportScopeService } from './finance-report-scope.service';
import { FinanceReportsService } from './finance-reports.service';
import { PaymentGatewayService } from './payment-gateway/payment-gateway.service';
import { buildLedgerEntries, buildLedgerMetadata } from './finance-ledger-entries.util';
import {
  createPendingFinanceRequestWithWorkflowAtomic,
  createScholarshipApplicationWithWorkflowAtomic,
  createScholarshipAwardWithWorkflowAtomic,
} from './finance-workflow.util';
import {
  buildPaymentPlanInstallments,
  newFinanceReference,
  parseFeeStructureItems,
  parsePaymentPlanInstallments,
  signedLedgerAmount,
} from './finance.util';
import type { UpdateFeeStructureDto } from './dto/update-fee-structure.dto';
import type { RequestStudentExcessRefundDto } from './dto/request-student-excess-refund.dto';
import type { RequestStudentExcessTransferDto } from './dto/request-student-excess-transfer.dto';
import {
  EXCESS_REQUEST_KIND,
  computeExcessCreditSummary,
  sumPendingExcessRequestAmounts,
  sumUnpaidInstallmentPrincipal,
} from './finance-excess-credit.util';
import { FinanceStudentAccessService } from './finance-student-access.service';

@Injectable()
export class FinanceService {
  constructor(
    private readonly repo: FinanceRepository,
    private readonly studentAccess: FinanceStudentAccessService,
    private readonly audit: AuditService,
    private readonly balanceCache: FinanceBalanceCacheService,
    private readonly notifications: FinanceNotificationsService,
    private readonly reports: FinanceReportsService,
    private readonly reportScope: FinanceReportScopeService,
    private readonly gateways: PaymentGatewayService,
    @Inject(forwardRef(() => WorkflowEngineService))
    private readonly workflows: WorkflowEngineService,
    private readonly scholarshipForms: FinanceScholarshipFormsService,
  ) {}

  async getScholarshipApplicationForm(actor: AuthUser, scholarshipId: string) {
    const resolved = await this.scholarshipForms.resolveApplicationSchema(
      actor.institutionId,
      scholarshipId,
    );
    return {
      scholarshipId: resolved.scholarshipId,
      source: resolved.source,
      schema: resolved.schema,
    };
  }

  private scopeEntityId(actor: AuthUser): string | undefined {
    return actor.entityScope === 'ALL' ? undefined : actor.entityId;
  }

  private async buildExcessCreditSummary(actor: AuthUser, studentId: string) {
    const { account } = await this.ensureAccount(actor, studentId);
    const [ledgerRows, paymentPlans] = await Promise.all([
      this.repo.listTransactionsForExcessCredit(account.id, actor.institutionId),
      this.repo.listPaymentPlans(account.id, actor.institutionId),
    ]);
    const ledgerMapped = ledgerRows.map((r) => ({
      type: r.type,
      amount: Number(r.amount),
      status: r.status,
      metadata: r.metadata,
    }));
    const pendingTotal = sumPendingExcessRequestAmounts(ledgerMapped);
    const summary = computeExcessCreditSummary(
      ledgerMapped,
      sumUnpaidInstallmentPrincipal(paymentPlans),
      pendingTotal,
    );
    return { account, summary };
  }

  private async assertExcessRequestAllowed(actor: AuthUser, studentId: string, amount: number) {
    const { summary } = await this.validateExcessAmountForStudent(
      actor.institutionId,
      studentId,
      amount,
      this.scopeEntityId(actor),
    );
    return summary;
  }

  private async validateExcessAmountForStudent(
    institutionId: string,
    studentId: string,
    amount: number,
    entityScope?: string,
    excludePendingTransactionId?: string,
  ) {
    const student = await this.repo.findStudent(institutionId, studentId, entityScope);
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    const account =
      (await this.repo.findAccountByStudent(institutionId, studentId)) ??
      (await this.repo.createAccount({
        institution: { connect: { id: institutionId } },
        entity: { connect: { id: student.entityId } },
        student: { connect: { id: studentId } },
        currency: 'USD',
      }));
    const ledgerRows = await this.repo.listTransactionsForExcessCredit(account.id, institutionId);
    const paymentPlans = await this.repo.listPaymentPlans(account.id, institutionId);
    const ledgerMapped = ledgerRows
      .filter((r) => r.id !== excludePendingTransactionId)
      .map((r) => ({
        type: r.type,
        amount: Number(r.amount),
        status: r.status,
        metadata: r.metadata,
      }));
    const pendingTotal = sumPendingExcessRequestAmounts(ledgerMapped);
    const summary = computeExcessCreditSummary(
      ledgerMapped,
      sumUnpaidInstallmentPrincipal(paymentPlans),
      pendingTotal,
    );
    if (amount > summary.maxRefundable + 0.005) {
      throw new BadRequestException(
        `Amount exceeds refundable cash balance. Maximum available: ${summary.maxRefundable.toFixed(2)}. ` +
          `Scholarship credits (${summary.scholarshipLocked.toFixed(2)} locked) cannot be refunded or transferred. ` +
          `${summary.reservedForPaymentPlans.toFixed(2)} is reserved for upcoming payment plan installments.`,
      );
    }
    return { account, summary };
  }

  private resolveEntityId(actor: AuthUser, explicit?: string): string {
    if (actor.entityScope === 'ENTITY') {
      return actor.entityId;
    }
    const id = explicit?.trim();
    if (!id) {
      throw new BadRequestException('entityId is required for institution-wide finance writes');
    }
    return id;
  }

  async listFeeStructures(actor: AuthUser) {
    const rows = await this.repo.listFeeStructures(actor.institutionId, this.scopeEntityId(actor));
    return {
      data: rows.map((r) => ({
        id: r.id,
        name: r.name,
        entityId: r.entityId,
        academicYearId: r.academicYearId,
        academicYearName: r.academicYear.name,
        programmeIds: r.programmeIds,
        isDefault: r.isDefault,
        items: parseFeeStructureItems(r.items),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    };
  }

  async createFeeStructure(actor: AuthUser, dto: CreateFeeStructureDto) {
    const entityId = this.resolveEntityId(actor, dto.entityId);
    const year = await this.repo.findAcademicYear(actor.institutionId, dto.academicYearId);
    if (!year) {
      throw new NotFoundException('Academic year not found');
    }
    const items = dto.items ?? [];
    const row = await this.repo.createFeeStructure({
      institution: { connect: { id: actor.institutionId } },
      entity: { connect: { id: entityId } },
      academicYear: { connect: { id: dto.academicYearId } },
      name: dto.name.trim(),
      programmeIds: dto.programmeIds ?? [],
      isDefault: dto.isDefault ?? false,
      items: items as unknown as Prisma.InputJsonValue,
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'finance.feeStructure.create',
      entity: 'FeeStructure',
      entityId: row.id,
      newValues: { name: row.name, entityId } as Prisma.InputJsonValue,
    });
    return { id: row.id, name: row.name };
  }

  async updateFeeStructure(actor: AuthUser, feeStructureId: string, dto: UpdateFeeStructureDto) {
    const existing = await this.repo.findFeeStructure(
      actor.institutionId,
      feeStructureId,
      this.scopeEntityId(actor),
    );
    if (!existing) {
      throw new NotFoundException('Fee structure not found');
    }
    const items = dto.items ? (dto.items as unknown as Prisma.InputJsonValue) : undefined;
    const result = await this.repo.updateFeeStructure(actor.institutionId, feeStructureId, {
      ...(dto.name?.trim() ? { name: dto.name.trim() } : {}),
      ...(dto.programmeIds !== undefined ? { programmeIds: dto.programmeIds } : {}),
      ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
      ...(items !== undefined ? { items } : {}),
    });
    if (result.count === 0) {
      throw new NotFoundException('Fee structure not found');
    }
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'finance.feeStructure.update',
      entity: 'FeeStructure',
      entityId: feeStructureId,
    });
    return { id: feeStructureId, ok: true };
  }

  async deleteFeeStructure(actor: AuthUser, feeStructureId: string) {
    const result = await this.repo.softDeleteFeeStructure(actor.institutionId, feeStructureId);
    if (result.count === 0) {
      throw new NotFoundException('Fee structure not found');
    }
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'finance.feeStructure.delete',
      entity: 'FeeStructure',
      entityId: feeStructureId,
    });
    return { id: feeStructureId, ok: true };
  }

  async getExcessCreditSummary(actor: AuthUser, studentId: string) {
    await this.studentAccess.assertFinanceStudentAccess(actor, studentId);
    const student = await this.repo.findStudent(
      actor.institutionId,
      studentId,
      this.scopeEntityId(actor),
    );
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    const { summary } = await this.buildExcessCreditSummary(actor, studentId);
    return {
      studentId,
      currency: (await this.ensureAccount(actor, studentId)).account.currency,
      ...summary,
      rules: {
        scholarshipNonTransferable: true,
        scholarshipNonRefundable: true,
        paymentPlanReserveApplied: summary.reservedForPaymentPlans > 0,
      },
    };
  }

  async requestStudentExcessRefund(
    actor: AuthUser,
    studentId: string,
    dto: RequestStudentExcessRefundDto,
  ) {
    await this.studentAccess.assertFinanceStudentAccess(actor, studentId);
    const { student, account } = await this.ensureAccount(actor, studentId);
    await this.assertExcessRequestAllowed(actor, studentId, dto.amount);

    const currency = (dto.currency ?? account.currency).toUpperCase();
    const signed = signedLedgerAmount(FinanceTransactionType.REFUND, dto.amount);
    const reference = newFinanceReference('XRF');
    const { pending, workflowInstance: instance } =
      await createPendingFinanceRequestWithWorkflowAtomic(
        this.workflows,
        this.repo,
        this.audit,
        {
          institutionId: actor.institutionId,
          entityId: student.entityId,
          studentAccountId: account.id,
          type: FinanceTransactionType.REFUND,
          signedAmount: signed,
          currency,
          description: dto.description.trim(),
          reference,
          processedBy: actor.userId,
          metadata: {
            requestKind: EXCESS_REQUEST_KIND.REFUND,
            requestedByStudent: true,
            ...buildLedgerMetadata(FinanceTransactionType.REFUND, signed),
          } as Prisma.InputJsonValue,
        },
        {
          institutionId: actor.institutionId,
          entityId: student.entityId,
          definitionCode: 'STUDENT_EXCESS_REFUND',
          entityType: 'FinanceTransaction',
          initiatedBy: actor.userId,
          metadata: { studentId, amount: dto.amount, reference },
        },
      );
    if (dto.gatewayReference?.trim()) {
      await this.repo.patchTransactionGatewayResponse(pending.id, {
        gatewayReference: dto.gatewayReference.trim(),
      });
    }

    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'finance.excessRefund.request',
      entity: 'FinanceTransaction',
      entityId: pending.id,
      newValues: { studentId, amount: dto.amount } as Prisma.InputJsonValue,
    });

    return {
      transactionId: pending.id,
      reference,
      workflowInstanceId: instance.id,
      status: 'PENDING',
    };
  }

  async requestStudentExcessTransfer(
    actor: AuthUser,
    studentId: string,
    dto: RequestStudentExcessTransferDto,
  ) {
    await this.studentAccess.assertFinanceStudentAccess(actor, studentId);
    const { student, account } = await this.ensureAccount(actor, studentId);
    await this.assertExcessRequestAllowed(actor, studentId, dto.amount);

    const targetId = dto.targetStudentId?.trim();
    const targetNumber = dto.targetStudentNumber?.trim();
    if (!targetId && !targetNumber) {
      throw new BadRequestException('targetStudentId or targetStudentNumber is required');
    }

    const target =
      targetId != null
        ? await this.repo.findStudentForFinance(actor.institutionId, targetId)
        : await this.repo.findStudentByStudentNumber(
            actor.institutionId,
            targetNumber!,
            this.scopeEntityId(actor),
          );
    if (!target) {
      throw new NotFoundException('Recipient student not found');
    }
    if (target.id === studentId) {
      throw new BadRequestException('Cannot transfer excess to yourself');
    }

    const targetAccount =
      (await this.repo.findAccountByStudent(actor.institutionId, target.id)) ??
      (await this.repo.createAccount({
        institution: { connect: { id: actor.institutionId } },
        entity: { connect: { id: target.entityId } },
        student: { connect: { id: target.id } },
        currency: account.currency,
      }));

    const currency = (dto.currency ?? account.currency).toUpperCase();
    const reference = newFinanceReference('XTR');
    const { pending, workflowInstance: instance } =
      await createPendingFinanceRequestWithWorkflowAtomic(
        this.workflows,
        this.repo,
        this.audit,
        {
          institutionId: actor.institutionId,
          entityId: student.entityId,
          studentAccountId: account.id,
          type: FinanceTransactionType.ADJUSTMENT,
          signedAmount: dto.amount,
          currency,
          description: dto.description.trim(),
          reference,
          processedBy: actor.userId,
          metadata: {
            requestKind: EXCESS_REQUEST_KIND.TRANSFER,
            targetStudentId: target.id,
            targetStudentNumber: target.studentNumber,
            targetAccountId: targetAccount.id,
            ...buildLedgerMetadata(FinanceTransactionType.ADJUSTMENT, dto.amount, {
              transferOut: true,
            }),
          } as Prisma.InputJsonValue,
        },
        {
          institutionId: actor.institutionId,
          entityId: student.entityId,
          definitionCode: 'STUDENT_EXCESS_TRANSFER',
          entityType: 'FinanceTransaction',
          initiatedBy: actor.userId,
          metadata: {
            studentId,
            targetStudentId: target.id,
            amount: dto.amount,
            reference,
          },
        },
      );

    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'finance.excessTransfer.request',
      entity: 'FinanceTransaction',
      entityId: pending.id,
      newValues: {
        studentId,
        targetStudentId: target.id,
        amount: dto.amount,
      } as Prisma.InputJsonValue,
    });

    return {
      transactionId: pending.id,
      reference,
      workflowInstanceId: instance.id,
      targetStudentId: target.id,
      targetStudentNumber: target.studentNumber,
      status: 'PENDING',
    };
  }

  async completeExcessTransferFromWorkflow(
    institutionId: string,
    transactionId: string,
    actorUserId: string,
  ) {
    const pending = await this.repo.findPendingExcessRequest(institutionId, transactionId);
    if (!pending) {
      throw new NotFoundException('Pending transfer request not found');
    }
    const meta =
      pending.metadata && typeof pending.metadata === 'object' && !Array.isArray(pending.metadata)
        ? (pending.metadata as Record<string, unknown>)
        : {};
    if (meta.requestKind !== EXCESS_REQUEST_KIND.TRANSFER) {
      throw new BadRequestException('Not a student excess transfer request');
    }

    const amount = Math.abs(Number(pending.amount));
    const targetStudentId = typeof meta.targetStudentId === 'string' ? meta.targetStudentId : null;
    const targetAccountId = typeof meta.targetAccountId === 'string' ? meta.targetAccountId : null;
    if (!targetStudentId || !targetAccountId) {
      throw new BadRequestException('Transfer metadata is incomplete');
    }

    const sourceStudentId = pending.studentAccount.studentId;
    await this.validateExcessAmountForStudent(
      institutionId,
      sourceStudentId,
      amount,
      undefined,
      transactionId,
    );

    const targetStudent = await this.repo.findStudentForFinance(institutionId, targetStudentId);
    if (!targetStudent) {
      throw new NotFoundException('Recipient student no longer exists');
    }

    const transferMetaBase = {
      requestKind: EXCESS_REQUEST_KIND.TRANSFER,
      transferOut: true,
      peerStudentId: targetStudentId,
    };

    try {
      const { outRow, inRow } = await this.repo.executeExcessTransferPair({
        institutionId,
        sourceAccountId: pending.studentAccountId,
        sourceEntityId: pending.entityId,
        sourceStudentId,
        targetAccountId,
        targetEntityId: targetStudent.entityId,
        targetStudentId,
        amount,
        currency: pending.currency,
        reference: pending.reference,
        description: pending.description,
        processedBy: actorUserId,
        sourceMetadata: {
          ...transferMetaBase,
          ...buildLedgerMetadata(FinanceTransactionType.ADJUSTMENT, amount, { transferOut: true }),
        } as Prisma.InputJsonValue,
        targetMetadata: {
          ...transferMetaBase,
          transferIn: true,
          peerStudentId: sourceStudentId,
          ...buildLedgerMetadata(FinanceTransactionType.PAYMENT, -amount),
        } as Prisma.InputJsonValue,
      });

      await this.repo.supersedePendingRequest(transactionId);
      await this.balanceCache.invalidate(institutionId, sourceStudentId);
      await this.balanceCache.invalidate(institutionId, targetStudentId);

      void this.notifyLedgerTransaction(institutionId, sourceStudentId, outRow.id);
      void this.notifyLedgerTransaction(institutionId, targetStudentId, inRow.id);

      this.audit.append({
        institutionId,
        actorId: actorUserId,
        action: 'finance.excessTransfer.approve',
        entity: 'FinanceTransaction',
        entityId: outRow.id,
        newValues: { pendingId: transactionId, targetStudentId, amount } as Prisma.InputJsonValue,
      });

      return {
        transactionId: outRow.id,
        inboundTransactionId: inRow.id,
        status: FinanceTransactionStatus.COMPLETED,
      };
    } catch (err) {
      if (err instanceof Error && err.message === 'TRANSFER_REFERENCE_EXISTS') {
        throw new ConflictException('Transfer already posted');
      }
      throw err;
    }
  }

  async getStudentAccount(actor: AuthUser, studentId: string) {
    await this.studentAccess.assertFinanceStudentAccess(actor, studentId);
    const student = await this.repo.findStudent(
      actor.institutionId,
      studentId,
      this.scopeEntityId(actor),
    );
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    const account =
      (await this.repo.findAccountByStudent(actor.institutionId, studentId)) ??
      (await this.repo.createAccount({
        institution: { connect: { id: actor.institutionId } },
        entity: { connect: { id: student.entityId } },
        student: { connect: { id: studentId } },
        currency: 'USD',
      }));

    const summed = await this.repo.sumCompletedBalance(account.id, actor.institutionId);
    const cached = await this.balanceCache.getCachedBalance(actor.institutionId, studentId);
    const balance = cached ?? summed;
    if (cached == null) {
      void this.balanceCache.setCachedBalance(actor.institutionId, studentId, summed);
    }
    if (Math.abs(Number(account.balance) - summed) > 0.005) {
      void this.repo.reconcileAccountBalance(account.id, summed);
    }

    const transactions = await this.repo.listTransactions(account.id, actor.institutionId);
    const paymentPlans = await this.repo.listPaymentPlans(account.id, actor.institutionId);
    return {
      studentId,
      studentNumber: student.studentNumber,
      enrollmentStatus: student.enrollmentStatus,
      account: {
        id: account.id,
        balance,
        currency: account.currency,
        lastTransactionAt: account.lastTransactionAt?.toISOString() ?? null,
      },
      paymentPlans: paymentPlans.map((p) => ({
        id: p.id,
        totalAmount: Number(p.totalAmount),
        currency: p.currency,
        status: p.status,
        installments: parsePaymentPlanInstallments(p.installments),
        createdAt: p.createdAt.toISOString(),
      })),
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        currency: t.currency,
        description: t.description,
        reference: t.reference,
        status: t.status,
        paymentMethod: t.paymentMethod,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }

  private async ensureAccount(actor: AuthUser, studentId: string) {
    const student = await this.repo.findStudent(
      actor.institutionId,
      studentId,
      this.scopeEntityId(actor),
    );
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    const account =
      (await this.repo.findAccountByStudent(actor.institutionId, studentId)) ??
      (await this.repo.createAccount({
        institution: { connect: { id: actor.institutionId } },
        entity: { connect: { id: student.entityId } },
        student: { connect: { id: studentId } },
        currency: 'USD',
      }));
    return { student, account };
  }

  async postCharge(actor: AuthUser, studentId: string, dto: PostStudentChargeDto) {
    if (actor.studentId && actor.studentId !== studentId) {
      throw new ForbiddenException('Students cannot post charges for other learners');
    }
    const { student, account } = await this.ensureAccount(actor, studentId);
    if (student.enrollmentStatus !== StudentEnrollmentStatusEnum.ACTIVE) {
      throw new ForbiddenException('New charges are not allowed for inactive students');
    }
    const type =
      dto.type === 'ADJUSTMENT' ? FinanceTransactionType.ADJUSTMENT : FinanceTransactionType.CHARGE;
    if (type !== FinanceTransactionType.CHARGE && type !== FinanceTransactionType.ADJUSTMENT) {
      throw new BadRequestException('Charge endpoint supports CHARGE or ADJUSTMENT types only');
    }
    const currency = (dto.currency ?? account.currency).toUpperCase();
    const signed = signedLedgerAmount(type, dto.amount);
    const row = await this.repo.postLedgerEntry({
      accountId: account.id,
      institutionId: actor.institutionId,
      entityId: student.entityId,
      type,
      signedAmount: signed,
      currency,
      description: dto.description.trim(),
      reference: newFinanceReference('CHG'),
      processedBy: actor.userId,
      metadata: buildLedgerMetadata(type, signed) as Prisma.InputJsonValue,
    });
    await this.balanceCache.invalidate(actor.institutionId, studentId);
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'finance.charge.post',
      entity: 'FinanceTransaction',
      entityId: row.id,
      newValues: { studentId, amount: signed } as Prisma.InputJsonValue,
    });
    const result = {
      transactionId: row.id,
      reference: row.reference,
      signedAmount: Number(row.amount),
      status: row.status,
    };
    void this.notifyLedgerTransaction(actor.institutionId, studentId, row.id);
    return result;
  }

  /** Payments clear debt — permitted for inactive students per master prompt. */
  async postPayment(actor: AuthUser, studentId: string, dto: PostStudentPaymentDto) {
    const { student, account } = await this.ensureAccount(actor, studentId);
    const currency = (dto.currency ?? account.currency).toUpperCase();
    const signed = signedLedgerAmount(FinanceTransactionType.PAYMENT, dto.amount);
    const row = await this.repo.postLedgerEntry({
      accountId: account.id,
      institutionId: actor.institutionId,
      entityId: student.entityId,
      type: FinanceTransactionType.PAYMENT,
      signedAmount: signed,
      currency,
      description: dto.description.trim(),
      reference: newFinanceReference('PAY'),
      paymentMethod: dto.paymentMethod?.trim() ?? null,
      processedBy: actor.userId,
      metadata: {
        ...buildLedgerMetadata(FinanceTransactionType.PAYMENT, signed),
      } as Prisma.InputJsonValue,
    });
    await this.balanceCache.invalidate(actor.institutionId, studentId);
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'finance.payment.post',
      entity: 'FinanceTransaction',
      entityId: row.id,
      newValues: { studentId, amount: signed } as Prisma.InputJsonValue,
    });
    const result = {
      transactionId: row.id,
      reference: row.reference,
      signedAmount: Number(row.amount),
      status: row.status,
    };
    void this.notifyLedgerTransaction(actor.institutionId, studentId, row.id);
    return result;
  }

  async requestFeeWaiver(actor: AuthUser, studentId: string, dto: RequestFeeWaiverDto) {
    const { student, account } = await this.ensureAccount(actor, studentId);
    const currency = (dto.currency ?? account.currency).toUpperCase();
    const signed = signedLedgerAmount(FinanceTransactionType.WAIVER, dto.amount);
    const reference = newFinanceReference('WVR');
    const { pending, workflowInstance: instance } =
      await createPendingFinanceRequestWithWorkflowAtomic(
        this.workflows,
        this.repo,
        this.audit,
        {
          institutionId: actor.institutionId,
          entityId: student.entityId,
          studentAccountId: account.id,
          type: FinanceTransactionType.WAIVER,
          signedAmount: signed,
          currency,
          description: dto.description.trim(),
          reference,
          processedBy: actor.userId,
          metadata: buildLedgerMetadata(
            FinanceTransactionType.WAIVER,
            signed,
          ) as Prisma.InputJsonValue,
        },
        {
          institutionId: actor.institutionId,
          entityId: student.entityId,
          definitionCode: 'FEE_WAIVER',
          entityType: 'FinanceTransaction',
          initiatedBy: actor.userId,
          metadata: { studentId, amount: dto.amount, reference },
        },
      );

    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'finance.waiver.request',
      entity: 'FinanceTransaction',
      entityId: pending.id,
      newValues: { studentId, amount: dto.amount } as Prisma.InputJsonValue,
    });

    return {
      transactionId: pending.id,
      reference,
      workflowInstanceId: instance.id,
      status: 'PENDING',
    };
  }

  async requestRefund(actor: AuthUser, studentId: string, dto: RequestFinanceRefundDto) {
    const { student, account } = await this.ensureAccount(actor, studentId);
    const currency = (dto.currency ?? account.currency).toUpperCase();
    const signed = signedLedgerAmount(FinanceTransactionType.REFUND, dto.amount);
    const reference = newFinanceReference('RFD');
    const { pending, workflowInstance: instance } =
      await createPendingFinanceRequestWithWorkflowAtomic(
        this.workflows,
        this.repo,
        this.audit,
        {
          institutionId: actor.institutionId,
          entityId: student.entityId,
          studentAccountId: account.id,
          type: FinanceTransactionType.REFUND,
          signedAmount: signed,
          currency,
          description: dto.description.trim(),
          reference,
          processedBy: actor.userId,
          metadata: buildLedgerMetadata(
            FinanceTransactionType.REFUND,
            signed,
          ) as Prisma.InputJsonValue,
        },
        {
          institutionId: actor.institutionId,
          entityId: student.entityId,
          definitionCode: 'FINANCE_REFUND',
          entityType: 'FinanceTransaction',
          initiatedBy: actor.userId,
          metadata: {
            studentId,
            amount: dto.amount,
            reference,
            gatewayReference: dto.gatewayReference ?? null,
          },
        },
      );
    if (dto.gatewayReference?.trim()) {
      await this.repo.patchTransactionGatewayResponse(pending.id, {
        gatewayReference: dto.gatewayReference.trim(),
      });
    }

    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'finance.refund.request',
      entity: 'FinanceTransaction',
      entityId: pending.id,
      newValues: { studentId, amount: dto.amount } as Prisma.InputJsonValue,
    });

    return {
      transactionId: pending.id,
      reference,
      workflowInstanceId: instance.id,
      status: 'PENDING',
    };
  }

  async completeFinanceApprovalFromWorkflow(
    institutionId: string,
    transactionId: string,
    actorUserId: string,
    metadata: Record<string, unknown>,
  ) {
    const txn = await this.repo.findApprovalTransaction(institutionId, transactionId);
    if (!txn) {
      throw new NotFoundException('Pending approval transaction not found');
    }

    const pendingMeta =
      txn.metadata && typeof txn.metadata === 'object' && !Array.isArray(txn.metadata)
        ? (txn.metadata as Record<string, unknown>)
        : {};
    if (pendingMeta.requestKind === EXCESS_REQUEST_KIND.REFUND) {
      await this.validateExcessAmountForStudent(
        institutionId,
        txn.studentAccount.studentId,
        Math.abs(Number(txn.amount)),
        undefined,
        transactionId,
      );
    }

    if (txn.type === FinanceTransactionType.REFUND) {
      const gw =
        txn.gatewayResponse &&
        typeof txn.gatewayResponse === 'object' &&
        !Array.isArray(txn.gatewayResponse)
          ? (txn.gatewayResponse as Record<string, unknown>).gatewayReference
          : metadata.gatewayReference;
      if (typeof gw === 'string' && gw.trim()) {
        try {
          const refund = await this.gateways.initiateRefund(
            txn.entityId,
            gw.trim(),
            Math.abs(Number(txn.amount)),
          );
          await this.repo.patchTransactionGatewayResponse(transactionId, {
            gatewayRefund: refund,
          });
        } catch {
          // Manual refund may still post to ledger after approval.
        }
      }
    }

    const existingMeta =
      txn.metadata && typeof txn.metadata === 'object' && !Array.isArray(txn.metadata)
        ? (txn.metadata as Record<string, unknown>)
        : {};
    const approvalMetadata =
      existingMeta.ledgerEntries != null
        ? (existingMeta as Prisma.InputJsonValue)
        : ({
            ...buildLedgerMetadata(txn.type, Number(txn.amount)),
          } as Prisma.InputJsonValue);

    const row = await this.repo.finalizeApprovalTransaction(
      transactionId,
      actorUserId,
      undefined,
      approvalMetadata,
    );
    if (!row) {
      throw new NotFoundException('Transaction not found');
    }
    const studentId = txn.studentAccount.studentId;
    await this.balanceCache.invalidate(institutionId, studentId);
    await this.repo.applyPaymentToActivePlans(txn.studentAccountId, Math.abs(Number(txn.amount)));
    void this.notifyLedgerTransaction(institutionId, studentId, transactionId);

    this.audit.append({
      institutionId,
      actorId: actorUserId,
      action: `finance.${txn.type === FinanceTransactionType.WAIVER ? 'waiver' : 'refund'}.approve`,
      entity: 'FinanceTransaction',
      entityId: transactionId,
      newValues: { status: FinanceTransactionStatus.COMPLETED } as Prisma.InputJsonValue,
    });

    return { transactionId, status: FinanceTransactionStatus.COMPLETED };
  }

  async rejectFinanceApprovalFromWorkflow(
    institutionId: string,
    transactionId: string,
    actorUserId: string,
  ) {
    const pending = await this.repo.findPendingExcessRequest(institutionId, transactionId);
    const meta =
      pending?.metadata && typeof pending.metadata === 'object' && !Array.isArray(pending.metadata)
        ? (pending.metadata as Record<string, unknown>)
        : {};
    if (meta.requestKind === EXCESS_REQUEST_KIND.TRANSFER) {
      await this.repo.supersedePendingRequest(transactionId);
    } else {
      await this.repo.cancelPendingTransaction(transactionId);
    }
    this.audit.append({
      institutionId,
      actorId: actorUserId,
      action: 'finance.approval.reject',
      entity: 'FinanceTransaction',
      entityId: transactionId,
    });
  }

  async submitScholarshipApplication(
    actor: AuthUser,
    scholarshipId: string,
    dto: SubmitScholarshipApplicationDto,
  ) {
    if (!actor.studentId) {
      throw new ForbiddenException('Only students may submit scholarship applications');
    }
    const scholarship = await this.repo.findScholarship(actor.institutionId, scholarshipId);
    if (!scholarship) {
      throw new NotFoundException('Scholarship not found');
    }
    const existing = await this.repo.findScholarshipApplicationByStudent(
      scholarshipId,
      actor.studentId,
    );
    if (existing) {
      throw new ConflictException('Application already submitted for this scholarship');
    }
    const student = await this.repo.findStudentForFinance(actor.institutionId, actor.studentId);
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    const responses = (dto.responses ?? {}) as Record<string, unknown>;
    const { schema } = await this.scholarshipForms.resolveApplicationSchema(
      actor.institutionId,
      scholarshipId,
    );
    if (schema) {
      this.scholarshipForms.validateSubmission(schema, responses);
    }
    try {
      const { application: row } = await createScholarshipApplicationWithWorkflowAtomic(
        this.workflows,
        this.repo,
        this.audit,
        {
          institutionId: actor.institutionId,
          entityId: student.entityId,
          scholarshipId,
          studentId: actor.studentId,
          responses: responses as Prisma.InputJsonValue,
          status: FinanceScholarshipApplicationStatus.SUBMITTED,
        },
        {
          institutionId: actor.institutionId,
          entityId: student.entityId,
          definitionCode: 'SCHOLARSHIP_APPLICATION',
          entityType: 'FinanceScholarshipApplication',
          initiatedBy: actor.userId,
          metadata: { scholarshipId, studentId: actor.studentId },
        },
      );
      return { id: row.id, status: row.status };
    } catch {
      const row = await this.repo.createScholarshipApplication({
        institution: { connect: { id: actor.institutionId } },
        entity: { connect: { id: student.entityId } },
        scholarship: { connect: { id: scholarshipId } },
        student: { connect: { id: actor.studentId } },
        responses: responses as Prisma.InputJsonValue,
        status: FinanceScholarshipApplicationStatus.SUBMITTED,
      });
      return { id: row.id, status: row.status };
    }
  }

  async listScholarshipApplications(actor: AuthUser, scholarshipId?: string) {
    const rows = await this.repo.listScholarshipApplications(
      actor.institutionId,
      scholarshipId,
      this.scopeEntityId(actor),
    );
    return {
      data: rows.map((r) => ({
        id: r.id,
        scholarshipId: r.scholarshipId,
        scholarshipName: r.scholarship.name,
        studentId: r.studentId,
        studentNumber: r.student.studentNumber,
        status: r.status,
        workflowInstanceId: r.workflowInstanceId,
        responses: r.responses,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async reviewScholarshipApplication(
    actor: AuthUser,
    applicationId: string,
    dto: ReviewScholarshipApplicationDto,
  ) {
    const app = await this.repo.findScholarshipApplication(actor.institutionId, applicationId);
    if (!app) {
      throw new NotFoundException('Application not found');
    }
    if (app.workflowInstanceId && app.status === FinanceScholarshipApplicationStatus.UNDER_REVIEW) {
      throw new BadRequestException(
        'Application is pending workflow approval. Complete the SCHOLARSHIP_APPLICATION workflow first.',
      );
    }
    const status =
      dto.status === 'APPROVED'
        ? FinanceScholarshipApplicationStatus.APPROVED
        : FinanceScholarshipApplicationStatus.REJECTED;
    if (
      status === FinanceScholarshipApplicationStatus.APPROVED &&
      (!dto.academicYearId?.trim() || !dto.awardAmount || dto.awardAmount <= 0)
    ) {
      throw new BadRequestException('academicYearId and awardAmount are required to approve');
    }
    await this.repo.updateScholarshipApplication(applicationId, {
      status,
      reviewedBy: actor.userId,
      reviewedAt: new Date(),
      reviewNotes: dto.reviewNotes?.trim() ?? null,
    });

    if (
      status === FinanceScholarshipApplicationStatus.APPROVED &&
      dto.academicYearId &&
      dto.awardAmount
    ) {
      await this.createScholarshipAward(actor, app.scholarshipId, {
        studentId: app.studentId,
        academicYearId: dto.academicYearId,
        amount: dto.awardAmount,
        entityId: app.entityId,
      });
    }

    return { id: applicationId, status };
  }

  async approveScholarshipApplicationFromWorkflow(
    institutionId: string,
    applicationId: string,
    actorUserId: string,
  ) {
    await this.repo.updateScholarshipApplication(applicationId, {
      status: FinanceScholarshipApplicationStatus.APPROVED,
      reviewedBy: actorUserId,
      reviewedAt: new Date(),
    });
    this.audit.append({
      institutionId,
      actorId: actorUserId,
      action: 'finance.scholarshipApplication.workflow.approve',
      entity: 'FinanceScholarshipApplication',
      entityId: applicationId,
    });
  }

  async rejectScholarshipApplicationFromWorkflow(
    institutionId: string,
    applicationId: string,
    actorUserId: string,
  ) {
    await this.repo.updateScholarshipApplication(applicationId, {
      status: FinanceScholarshipApplicationStatus.REJECTED,
      reviewedBy: actorUserId,
      reviewedAt: new Date(),
    });
    this.audit.append({
      institutionId,
      actorId: actorUserId,
      action: 'finance.scholarshipApplication.workflow.reject',
      entity: 'FinanceScholarshipApplication',
      entityId: applicationId,
    });
  }

  async listScholarships(actor: AuthUser) {
    const rows = await this.repo.listScholarships(actor.institutionId, this.scopeEntityId(actor));
    return {
      data: rows.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        fundingSource: r.fundingSource,
        totalFund: Number(r.totalFund),
        disbursedAmount: Number(r.disbursedAmount),
        entityId: r.entityId,
        applicationSchemaId: r.applicationSchemaId,
      })),
    };
  }

  async createScholarship(actor: AuthUser, dto: CreateFinanceScholarshipDto) {
    const entityId = this.resolveEntityId(actor, dto.entityId);
    const row = await this.repo.createScholarship({
      institution: { connect: { id: actor.institutionId } },
      entity: { connect: { id: entityId } },
      name: dto.name.trim(),
      type: dto.type,
      fundingSource: dto.fundingSource.trim(),
      totalFund: dto.totalFund,
      applicationSchemaId: dto.applicationSchemaId?.trim() ?? null,
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'finance.scholarship.create',
      entity: 'FinanceScholarship',
      entityId: row.id,
      newValues: { name: row.name } as Prisma.InputJsonValue,
    });
    return { id: row.id, name: row.name };
  }

  async createScholarshipAward(
    actor: AuthUser,
    scholarshipId: string,
    dto: CreateScholarshipAwardDto,
  ) {
    const scholarship = await this.repo.findScholarship(actor.institutionId, scholarshipId);
    if (!scholarship) {
      throw new NotFoundException('Scholarship not found');
    }
    const entityId = this.resolveEntityId(actor, dto.entityId ?? scholarship.entityId);
    const student = await this.repo.findStudent(actor.institutionId, dto.studentId, entityId);
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    const year = await this.repo.findAcademicYear(actor.institutionId, dto.academicYearId);
    if (!year) {
      throw new NotFoundException('Academic year not found');
    }
    try {
      const { award: row } = await createScholarshipAwardWithWorkflowAtomic(
        this.workflows,
        this.repo,
        this.audit,
        {
          institutionId: actor.institutionId,
          entityId,
          scholarshipId,
          studentId: dto.studentId,
          academicYearId: dto.academicYearId,
          amount: dto.amount,
          status: FinanceAwardStatus.PENDING,
          awardedBy: actor.userId,
        },
        {
          institutionId: actor.institutionId,
          entityId,
          definitionCode: 'SCHOLARSHIP_AWARD',
          entityType: 'FinanceScholarshipAward',
          initiatedBy: actor.userId,
          metadata: { scholarshipId, studentId: dto.studentId, amount: dto.amount },
        },
      );
      return { id: row.id, status: row.status };
    } catch {
      const row = await this.repo.createScholarshipAward({
        institution: { connect: { id: actor.institutionId } },
        entity: { connect: { id: entityId } },
        scholarship: { connect: { id: scholarshipId } },
        student: { connect: { id: dto.studentId } },
        academicYear: { connect: { id: dto.academicYearId } },
        amount: dto.amount,
        status: FinanceAwardStatus.PENDING,
        awardedBy: actor.userId,
      });
      return { id: row.id, status: row.status };
    }
  }

  async disburseScholarshipAward(actor: AuthUser, awardId: string) {
    const award = await this.repo.findScholarshipAward(actor.institutionId, awardId);
    if (!award) {
      throw new NotFoundException('Scholarship award not found');
    }
    if (award.status === FinanceAwardStatus.DISBURSED) {
      throw new BadRequestException('Award already disbursed');
    }
    if (award.status === FinanceAwardStatus.REVOKED) {
      throw new BadRequestException('Award was revoked');
    }
    if (award.workflowInstanceId && award.status === FinanceAwardStatus.PENDING) {
      throw new BadRequestException(
        'Scholarship award requires workflow approval before disbursement',
      );
    }
    return this.executeScholarshipDisbursement(actor.institutionId, awardId, actor.userId);
  }

  /** Used by workflow completion handler after SCHOLARSHIP_AWARD approval. */
  async disburseScholarshipAwardFromWorkflow(
    institutionId: string,
    awardId: string,
    actorUserId: string,
  ) {
    await this.repo.updateScholarshipAward(awardId, { status: FinanceAwardStatus.APPROVED });
    return this.executeScholarshipDisbursement(institutionId, awardId, actorUserId);
  }

  private async executeScholarshipDisbursement(
    institutionId: string,
    awardId: string,
    actorUserId: string,
  ) {
    const award = await this.repo.findScholarshipAward(institutionId, awardId);
    if (!award) {
      throw new NotFoundException('Scholarship award not found');
    }
    if (award.status === FinanceAwardStatus.DISBURSED) {
      throw new BadRequestException('Award already disbursed');
    }
    if (award.status === FinanceAwardStatus.REVOKED) {
      throw new BadRequestException('Award was revoked');
    }
    const amount = Number(award.amount);
    const remaining =
      Number(award.scholarship.totalFund) - Number(award.scholarship.disbursedAmount);
    if (amount > remaining) {
      throw new BadRequestException('Scholarship fund would be exceeded');
    }

    const student = await this.repo.findStudentForFinance(institutionId, award.studentId);
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    const account =
      (await this.repo.findAccountByStudent(institutionId, award.studentId)) ??
      (await this.repo.createAccount({
        institution: { connect: { id: institutionId } },
        entity: { connect: { id: student.entityId } },
        student: { connect: { id: award.studentId } },
        currency: 'USD',
      }));
    const signed = signedLedgerAmount(FinanceTransactionType.SCHOLARSHIP_CREDIT, amount);
    const ref = `SCH-${awardId}`;
    const existing = await this.repo.findTransactionByReference(ref);
    if (existing) {
      throw new ConflictException('Disbursement already posted');
    }

    const row = await this.repo.postLedgerEntry({
      accountId: account.id,
      institutionId,
      entityId: award.entityId,
      type: FinanceTransactionType.SCHOLARSHIP_CREDIT,
      signedAmount: signed,
      currency: account.currency,
      description: `Scholarship · ${award.scholarship.name}`,
      reference: ref,
      processedBy: actorUserId,
      metadata: {
        ...buildLedgerMetadata(FinanceTransactionType.SCHOLARSHIP_CREDIT, signed),
      } as Prisma.InputJsonValue,
    });
    const now = new Date();
    await this.repo.markAwardDisbursed(awardId, now);
    await this.repo.incrementScholarshipDisbursed(award.scholarshipId, amount);
    await this.balanceCache.invalidate(institutionId, award.studentId);

    this.audit.append({
      institutionId,
      actorId: actorUserId,
      action: 'finance.scholarship.disburse',
      entity: 'FinanceScholarshipAward',
      entityId: awardId,
      newValues: { transactionId: row.id, amount: signed } as Prisma.InputJsonValue,
    });

    void this.notifyLedgerTransaction(institutionId, award.studentId, row.id);

    return {
      awardId,
      transactionId: row.id,
      signedAmount: Number(row.amount),
      status: FinanceAwardStatus.DISBURSED,
    };
  }

  async createPaymentPlan(actor: AuthUser, studentId: string, dto: CreatePaymentPlanDto) {
    const { student, account } = await this.ensureAccount(actor, studentId);
    const sum = dto.installments.reduce((a, i) => a + i.amount, 0);
    if (Math.abs(sum - dto.totalAmount) > 0.01) {
      throw new BadRequestException('Installment amounts must sum to totalAmount');
    }
    const installments = buildPaymentPlanInstallments(dto.installments);
    const currency = (dto.currency ?? account.currency).toUpperCase();
    const row = await this.repo.createPaymentPlan({
      institution: { connect: { id: actor.institutionId } },
      entity: { connect: { id: student.entityId } },
      studentAccount: { connect: { id: account.id } },
      totalAmount: dto.totalAmount,
      currency,
      installments: installments as unknown as Prisma.InputJsonValue,
      createdBy: actor.userId,
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'finance.paymentPlan.create',
      entity: 'FinancePaymentPlan',
      entityId: row.id,
      newValues: { studentId, totalAmount: dto.totalAmount } as Prisma.InputJsonValue,
    });
    return { id: row.id, status: row.status };
  }

  async listScholarshipAwards(actor: AuthUser, scholarshipId?: string) {
    const rows = await this.repo.listScholarshipAwards(
      actor.institutionId,
      scholarshipId,
      this.scopeEntityId(actor),
    );
    return {
      data: rows.map((r) => ({
        id: r.id,
        scholarshipId: r.scholarshipId,
        scholarshipName: r.scholarship.name,
        studentId: r.studentId,
        studentNumber: r.student.studentNumber,
        amount: Number(r.amount),
        status: r.status,
        academicYearId: r.academicYearId,
        disbursedAt: r.disbursedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async agingReport(actor: AuthUser, filters?: { departmentId?: string }) {
    const scope = await this.reportScope.resolve(actor, filters);
    if (scope.empty) {
      return {
        buckets: [
          { label: '0–30 days', count: 0, total: 0 },
          { label: '31–60 days', count: 0, total: 0 },
          { label: '61–90 days', count: 0, total: 0 },
          { label: '90+ days', count: 0, total: 0 },
        ],
        accountCount: 0,
      };
    }
    const accounts = await this.repo.accountsWithPositiveBalance(
      actor.institutionId,
      scope.entityId,
      scope.departmentIds,
    );
    const buckets = {
      current: { label: '0–30 days', count: 0, total: 0 },
      days31to60: { label: '31–60 days', count: 0, total: 0 },
      days61to90: { label: '61–90 days', count: 0, total: 0 },
      over90: { label: '90+ days', count: 0, total: 0 },
    };
    const now = Date.now();
    for (const a of accounts) {
      const anchor = a.lastTransactionAt ?? a.createdAt;
      const days = Math.floor((now - anchor.getTime()) / 86_400_000);
      const bal = Number(a.balance);
      if (days <= 30) {
        buckets.current.count += 1;
        buckets.current.total += bal;
      } else if (days <= 60) {
        buckets.days31to60.count += 1;
        buckets.days31to60.total += bal;
      } else if (days <= 90) {
        buckets.days61to90.count += 1;
        buckets.days61to90.total += bal;
      } else {
        buckets.over90.count += 1;
        buckets.over90.total += bal;
      }
    }
    return { buckets: Object.values(buckets), accountCount: accounts.length };
  }

  async revenueReport(
    actor: AuthUser,
    fromIso?: string,
    toIso?: string,
    filters?: { programmeId?: string; departmentId?: string },
  ) {
    return this.reports.buildRevenueBreakdown(actor, fromIso, toIso, filters);
  }

  async exportRevenueExcel(
    actor: AuthUser,
    fromIso?: string,
    toIso?: string,
    filters?: { programmeId?: string; departmentId?: string },
  ) {
    return this.reports.exportRevenueExcel(actor, fromIso, toIso, filters);
  }

  async exportRevenuePdf(
    actor: AuthUser,
    fromIso?: string,
    toIso?: string,
    filters?: { programmeId?: string; departmentId?: string },
  ) {
    return this.reports.exportRevenuePdf(actor, fromIso, toIso, filters);
  }

  private async notifyLedgerTransaction(
    institutionId: string,
    studentId: string,
    transactionId: string,
  ) {
    const txn = await this.repo.findTransaction(institutionId, transactionId);
    if (!txn || txn.status !== FinanceTransactionStatus.COMPLETED) {
      return;
    }
    const profile = txn.studentAccount.student.user?.profile as {
      firstName?: string;
      lastName?: string;
    } | null;
    const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || '—';
    const institution = await this.repo.findInstitutionName(institutionId);
    await this.notifications.notifyTransactionCompleted({
      institutionId,
      studentId,
      transactionId: txn.id,
      reference: txn.reference,
      type: txn.type,
      amount: Number(txn.amount),
      currency: txn.currency,
      description: txn.description,
      processedAt: (txn.processedAt ?? txn.createdAt).toISOString(),
      paymentMethod: txn.paymentMethod,
      studentNumber: txn.studentAccount.student.studentNumber,
      studentName: name,
      studentEmail: txn.studentAccount.student.user?.email ?? null,
      institutionName: institution?.name ?? null,
    });
  }

  async outstandingBalancesReport(actor: AuthUser, filters?: { departmentId?: string }) {
    const scope = await this.reportScope.resolve(actor, filters);
    if (scope.empty) {
      return { data: [], totalOutstanding: 0 };
    }
    const rows = await this.repo.outstandingBalancesReport(
      actor.institutionId,
      scope.entityId,
      scope.departmentIds,
    );
    return {
      data: rows.map((r) => {
        const profile = r.student.user?.profile as { firstName?: string; lastName?: string } | null;
        const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || '—';
        return {
          studentId: r.studentId,
          studentNumber: r.student.studentNumber,
          studentName: name,
          balance: Number(r.balance),
          currency: r.currency,
        };
      }),
      totalOutstanding: rows.reduce((sum, r) => sum + Number(r.balance), 0),
    };
  }

  async exportOutstandingCsv(
    actor: AuthUser,
    filters?: { departmentId?: string },
  ): Promise<string> {
    const { data } = await this.outstandingBalancesReport(actor, filters);
    const lines = ['studentId,studentNumber,studentName,balance,currency'];
    for (const r of data) {
      lines.push(
        `${r.studentId},${r.studentNumber},"${r.studentName.replace(/"/g, '""')}",${r.balance},${r.currency}`,
      );
    }
    return lines.join('\n');
  }

  async transactionReceiptPdf(actor: AuthUser, studentId: string, transactionId: string) {
    const txn = await this.repo.findTransaction(actor.institutionId, transactionId);
    if (!txn || txn.studentAccount.studentId !== studentId) {
      throw new NotFoundException('Transaction not found');
    }
    if (actor.entityScope === 'ENTITY' && txn.entityId !== actor.entityId) {
      throw new NotFoundException('Transaction not found');
    }
    const profile = txn.studentAccount.student.user?.profile as {
      firstName?: string;
      lastName?: string;
    } | null;
    const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || '—';
    const institution = await this.repo.findInstitutionName(actor.institutionId);
    const instName = institution?.name;

    const buffer = await financeReceiptToPdfBuffer({
      institutionName: instName,
      studentNumber: txn.studentAccount.student.studentNumber,
      studentName: name,
      reference: txn.reference,
      type: txn.type,
      amount: Number(txn.amount),
      currency: txn.currency,
      description: txn.description,
      processedAt: (txn.processedAt ?? txn.createdAt).toISOString(),
      paymentMethod: txn.paymentMethod,
    });
    return { buffer, filename: `receipt-${txn.reference}.pdf` };
  }
}
