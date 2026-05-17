import { Injectable } from '@nestjs/common';
import {
  FinancePaymentPlanStatus,
  FinanceScholarshipApplicationStatus,
  FinanceTransactionStatus,
  FinanceTransactionType,
  Prisma,
  WorkflowStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { applyPaymentToInstallments, parsePaymentPlanInstallments } from './finance.util';
import { FinanceGlService } from './finance-gl.service';
import type { PreparedWorkflowInitiation } from '../workflow-engine/workflow.types';

@Injectable()
export class FinanceRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gl: FinanceGlService,
  ) {}

  listFeeStructures(institutionId: string, entityId?: string) {
    return this.prisma.feeStructure.findMany({
      where: {
        institutionId,
        deletedAt: null,
        ...(entityId ? { entityId } : {}),
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: {
        academicYear: { select: { id: true, name: true } },
      },
    });
  }

  findFeeStructure(institutionId: string, id: string, entityId?: string) {
    return this.prisma.feeStructure.findFirst({
      where: {
        id,
        institutionId,
        deletedAt: null,
        ...(entityId ? { entityId } : {}),
      },
      include: {
        academicYear: { select: { id: true, name: true } },
      },
    });
  }

  createFeeStructure(data: Prisma.FeeStructureCreateInput) {
    return this.prisma.feeStructure.create({ data });
  }

  updateFeeStructure(institutionId: string, id: string, data: Prisma.FeeStructureUpdateInput) {
    return this.prisma.feeStructure.updateMany({
      where: { id, institutionId, deletedAt: null },
      data,
    });
  }

  findStudent(institutionId: string, studentId: string, entityId?: string) {
    return this.prisma.student.findFirst({
      where: {
        id: studentId,
        institutionId,
        deletedAt: null,
        ...(entityId ? { entityId } : {}),
      },
      select: { id: true, entityId: true, enrollmentStatus: true, studentNumber: true },
    });
  }

  findStudentForFinance(institutionId: string, studentId: string) {
    return this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
      select: {
        id: true,
        entityId: true,
        programId: true,
        enrollmentStatus: true,
        studentNumber: true,
      },
    });
  }

  findStudentWithGuardians(institutionId: string, studentId: string) {
    return this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
      select: { id: true, entityId: true, guardians: true },
    });
  }

  getInstitutionSettings(institutionId: string) {
    return this.prisma.institution.findFirst({
      where: { id: institutionId, deletedAt: null },
      select: { settings: true },
    });
  }

  findInstitutionName(institutionId: string) {
    return this.prisma.institution.findFirst({
      where: { id: institutionId, deletedAt: null },
      select: { name: true },
    });
  }

  findSemesterWithYear(institutionId: string, semesterId: string) {
    return this.prisma.semester.findFirst({
      where: { id: semesterId, institutionId, deletedAt: null },
      select: { id: true, academicYearId: true },
    });
  }

  async resolveFeeStructureForEnrollment(args: {
    institutionId: string;
    entityId: string;
    academicYearId: string;
    programId: string;
  }) {
    const scoped = await this.prisma.feeStructure.findFirst({
      where: {
        institutionId: args.institutionId,
        entityId: args.entityId,
        academicYearId: args.academicYearId,
        deletedAt: null,
        programmeIds: { has: args.programId },
      },
      orderBy: { isDefault: 'asc' },
    });
    if (scoped) {
      return scoped;
    }
    return this.prisma.feeStructure.findFirst({
      where: {
        institutionId: args.institutionId,
        entityId: args.entityId,
        academicYearId: args.academicYearId,
        deletedAt: null,
        isDefault: true,
      },
    });
  }

  findTransactionByReference(reference: string) {
    return this.prisma.financeTransaction.findFirst({
      where: { reference },
    });
  }

  createPendingGatewayTransaction(data: {
    institutionId: string;
    entityId: string;
    studentAccountId: string;
    reference: string;
    signedAmount: number;
    currency: string;
    description: string;
    gatewayRef: string;
    gatewayResponse: Prisma.InputJsonValue;
  }) {
    return this.prisma.financeTransaction.create({
      data: {
        institutionId: data.institutionId,
        entityId: data.entityId,
        studentAccountId: data.studentAccountId,
        type: FinanceTransactionType.PAYMENT,
        amount: new Prisma.Decimal(data.signedAmount),
        currency: data.currency,
        description: data.description,
        reference: data.reference,
        paymentMethod: 'gateway',
        gatewayRef: data.gatewayRef,
        gatewayResponse: data.gatewayResponse,
        status: FinanceTransactionStatus.PENDING,
      },
    });
  }

  async sumCompletedBalance(studentAccountId: string, institutionId: string): Promise<number> {
    const agg = await this.prisma.financeTransaction.aggregate({
      where: {
        studentAccountId,
        institutionId,
        status: FinanceTransactionStatus.COMPLETED,
      },
      _sum: { amount: true },
    });
    return Number(agg._sum.amount ?? 0);
  }

  async reconcileAccountBalance(studentAccountId: string, balance: number) {
    return this.prisma.studentAccount.update({
      where: { id: studentAccountId },
      data: { balance: new Prisma.Decimal(balance) },
    });
  }

  async completePendingTransaction(
    transactionId: string,
    data: {
      gatewayResponse?: Prisma.InputJsonValue;
      processedBy?: string | null;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const pending = await tx.financeTransaction.findFirst({ where: { id: transactionId } });
      if (!pending) {
        return null;
      }
      const row = await tx.financeTransaction.update({
        where: { id: transactionId },
        data: {
          status: FinanceTransactionStatus.COMPLETED,
          processedAt: now,
          processedBy: data.processedBy ?? null,
          gatewayResponse: data.gatewayResponse ?? pending.gatewayResponse ?? undefined,
          ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
        },
      });
      const agg = await tx.financeTransaction.aggregate({
        where: {
          studentAccountId: pending.studentAccountId,
          institutionId: pending.institutionId,
          status: FinanceTransactionStatus.COMPLETED,
        },
        _sum: { amount: true },
      });
      const balance = agg._sum.amount ?? new Prisma.Decimal(0);
      await tx.studentAccount.update({
        where: { id: pending.studentAccountId },
        data: { balance, lastTransactionAt: now },
      });
      const meta = data.metadata ?? row.metadata;
      await this.gl.postJournalLinesForTransaction(tx, {
        institutionId: pending.institutionId,
        entityId: pending.entityId,
        financeTransactionId: row.id,
        metadata: meta,
      });
      return row;
    });
  }

  listPaymentPlans(studentAccountId: string, institutionId: string) {
    return this.prisma.financePaymentPlan.findMany({
      where: { studentAccountId, institutionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  createPaymentPlan(data: Prisma.FinancePaymentPlanCreateInput) {
    return this.prisma.financePaymentPlan.create({ data });
  }

  listScholarshipAwards(institutionId: string, scholarshipId?: string, entityId?: string) {
    return this.prisma.financeScholarshipAward.findMany({
      where: {
        institutionId,
        ...(scholarshipId ? { scholarshipId } : {}),
        ...(entityId ? { entityId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        student: { select: { id: true, studentNumber: true } },
        scholarship: { select: { id: true, name: true } },
      },
    });
  }

  accountsWithPositiveBalance(institutionId: string, entityId?: string, departmentIds?: string[]) {
    return this.prisma.studentAccount.findMany({
      where: {
        institutionId,
        balance: { gt: 0 },
        ...(entityId ? { entityId } : {}),
        ...(departmentIds && departmentIds.length > 0
          ? { student: { program: { departmentId: { in: departmentIds } } } }
          : {}),
      },
      select: {
        id: true,
        studentId: true,
        balance: true,
        currency: true,
        lastTransactionAt: true,
        createdAt: true,
      },
    });
  }

  revenueTransactions(
    institutionId: string,
    from: Date,
    to: Date,
    entityId?: string,
    programmeId?: string,
    departmentIds?: string[],
  ) {
    return this.prisma.financeTransaction.findMany({
      where: {
        institutionId,
        status: FinanceTransactionStatus.COMPLETED,
        createdAt: { gte: from, lte: to },
        ...(entityId ? { entityId } : {}),
        ...(programmeId || (departmentIds && departmentIds.length > 0)
          ? {
              studentAccount: {
                student: {
                  ...(programmeId ? { programId: programmeId } : {}),
                  ...(departmentIds && departmentIds.length > 0
                    ? { program: { departmentId: { in: departmentIds } } }
                    : {}),
                },
              },
            }
          : {}),
      },
      select: {
        type: true,
        amount: true,
        paymentMethod: true,
        reference: true,
        description: true,
        studentAccount: {
          select: {
            student: {
              select: {
                programId: true,
                program: { select: { id: true, name: true, departmentId: true } },
              },
            },
          },
        },
      },
    });
  }

  listScholarships(institutionId: string, entityId?: string) {
    return this.prisma.financeScholarship.findMany({
      where: {
        institutionId,
        deletedAt: null,
        ...(entityId ? { entityId } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  createScholarship(data: Prisma.FinanceScholarshipCreateInput) {
    return this.prisma.financeScholarship.create({ data });
  }

  findScholarship(institutionId: string, id: string) {
    return this.prisma.financeScholarship.findFirst({
      where: { id, institutionId, deletedAt: null },
    });
  }

  outstandingBalancesReport(institutionId: string, entityId?: string, departmentIds?: string[]) {
    return this.prisma.studentAccount.findMany({
      where: {
        institutionId,
        ...(entityId ? { entityId } : {}),
        balance: { gt: 0 },
        ...(departmentIds && departmentIds.length > 0
          ? { student: { program: { departmentId: { in: departmentIds } } } }
          : {}),
      },
      orderBy: { balance: 'desc' },
      take: 200,
      include: {
        student: {
          select: {
            id: true,
            studentNumber: true,
            user: { select: { profile: true } },
          },
        },
      },
    });
  }

  findAcademicYear(institutionId: string, academicYearId: string) {
    return this.prisma.academicYear.findFirst({
      where: { id: academicYearId, institutionId, deletedAt: null },
      select: { id: true },
    });
  }

  findAccountByStudent(institutionId: string, studentId: string) {
    return this.prisma.studentAccount.findFirst({
      where: { institutionId, studentId },
    });
  }

  findAccountById(studentAccountId: string) {
    return this.prisma.studentAccount.findFirst({
      where: { id: studentAccountId },
    });
  }

  createAccount(data: Prisma.StudentAccountCreateInput) {
    return this.prisma.studentAccount.create({ data });
  }

  listTransactions(studentAccountId: string, institutionId: string, take = 50) {
    return this.prisma.financeTransaction.findMany({
      where: { studentAccountId, institutionId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  listTransactionsForExcessCredit(studentAccountId: string, institutionId: string) {
    return this.prisma.financeTransaction.findMany({
      where: {
        studentAccountId,
        institutionId,
        status: {
          in: [FinanceTransactionStatus.COMPLETED, FinanceTransactionStatus.PENDING],
        },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        type: true,
        amount: true,
        status: true,
        metadata: true,
      },
    });
  }

  findStudentByStudentNumber(institutionId: string, studentNumber: string, entityId?: string) {
    return this.prisma.student.findFirst({
      where: {
        institutionId,
        studentNumber: studentNumber.trim(),
        deletedAt: null,
        ...(entityId ? { entityId } : {}),
      },
      select: {
        id: true,
        entityId: true,
        studentNumber: true,
        enrollmentStatus: true,
      },
    });
  }

  findPendingExcessRequest(institutionId: string, transactionId: string) {
    return this.prisma.financeTransaction.findFirst({
      where: {
        id: transactionId,
        institutionId,
        status: FinanceTransactionStatus.PENDING,
        OR: [{ type: FinanceTransactionType.REFUND }, { type: FinanceTransactionType.ADJUSTMENT }],
      },
      include: {
        studentAccount: {
          include: {
            student: {
              select: { id: true, studentNumber: true },
            },
          },
        },
      },
    });
  }

  async createPendingExcessTransferRequest(args: {
    institutionId: string;
    entityId: string;
    studentAccountId: string;
    amount: number;
    currency: string;
    description: string;
    reference: string;
    processedBy: string;
    metadata: Prisma.InputJsonValue;
  }) {
    return this.prisma.financeTransaction.create({
      data: {
        institutionId: args.institutionId,
        entityId: args.entityId,
        studentAccountId: args.studentAccountId,
        type: FinanceTransactionType.ADJUSTMENT,
        amount: new Prisma.Decimal(args.amount),
        currency: args.currency,
        description: args.description,
        reference: args.reference,
        status: FinanceTransactionStatus.PENDING,
        processedBy: args.processedBy,
        metadata: args.metadata,
      },
    });
  }

  supersedePendingRequest(transactionId: string) {
    return this.prisma.financeTransaction.updateMany({
      where: { id: transactionId, status: FinanceTransactionStatus.PENDING },
      data: { status: FinanceTransactionStatus.CANCELLED },
    });
  }

  async executeExcessTransferPair(args: {
    institutionId: string;
    sourceAccountId: string;
    sourceEntityId: string;
    sourceStudentId: string;
    targetAccountId: string;
    targetEntityId: string;
    targetStudentId: string;
    amount: number;
    currency: string;
    reference: string;
    description: string;
    processedBy: string;
    sourceMetadata: Prisma.InputJsonValue;
    targetMetadata: Prisma.InputJsonValue;
  }) {
    const now = new Date();
    const outRef = args.reference;
    const inRef = `${args.reference}-IN`;

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.financeTransaction.findFirst({
        where: { reference: { in: [outRef, inRef] } },
      });
      if (existing) {
        throw new Error('TRANSFER_REFERENCE_EXISTS');
      }

      const outRow = await tx.financeTransaction.create({
        data: {
          institutionId: args.institutionId,
          entityId: args.sourceEntityId,
          studentAccountId: args.sourceAccountId,
          type: FinanceTransactionType.ADJUSTMENT,
          amount: new Prisma.Decimal(args.amount),
          currency: args.currency,
          description: args.description,
          reference: outRef,
          status: FinanceTransactionStatus.COMPLETED,
          processedAt: now,
          processedBy: args.processedBy,
          metadata: args.sourceMetadata,
        },
      });

      const inRow = await tx.financeTransaction.create({
        data: {
          institutionId: args.institutionId,
          entityId: args.targetEntityId,
          studentAccountId: args.targetAccountId,
          type: FinanceTransactionType.PAYMENT,
          amount: new Prisma.Decimal(-args.amount),
          currency: args.currency,
          description: `Transfer from ${args.sourceStudentId}`,
          reference: inRef,
          status: FinanceTransactionStatus.COMPLETED,
          processedAt: now,
          processedBy: args.processedBy,
          metadata: args.targetMetadata,
        },
      });

      for (const accountId of [args.sourceAccountId, args.targetAccountId]) {
        const agg = await tx.financeTransaction.aggregate({
          where: {
            studentAccountId: accountId,
            institutionId: args.institutionId,
            status: FinanceTransactionStatus.COMPLETED,
          },
          _sum: { amount: true },
        });
        const balance = agg._sum.amount ?? new Prisma.Decimal(0);
        await tx.studentAccount.update({
          where: { id: accountId },
          data: { balance, lastTransactionAt: now },
        });
      }

      await this.gl.postJournalLinesForTransaction(tx, {
        institutionId: args.institutionId,
        entityId: args.sourceEntityId,
        financeTransactionId: outRow.id,
        metadata: args.sourceMetadata,
      });
      await this.gl.postJournalLinesForTransaction(tx, {
        institutionId: args.institutionId,
        entityId: args.targetEntityId,
        financeTransactionId: inRow.id,
        metadata: args.targetMetadata,
      });

      return { outRow, inRow };
    });
  }

  async createScholarshipApplicationWithWorkflow(
    application: Prisma.FinanceScholarshipApplicationUncheckedCreateInput,
    workflow: PreparedWorkflowInitiation,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.financeScholarshipApplication.create({
        data: {
          ...application,
          status: FinanceScholarshipApplicationStatus.UNDER_REVIEW,
        },
      });
      const instance = await tx.workflowInstance.create({
        data: {
          institutionId: workflow.institutionId,
          entityId: workflow.entityId,
          definitionId: workflow.definitionId,
          definitionCode: workflow.definitionCode,
          entityType: workflow.entityType,
          entityId_record: row.id,
          currentStep: 1,
          status: WorkflowStatus.IN_PROGRESS,
          initiatedBy: workflow.initiatedBy,
          dueAt: workflow.dueAt,
          metadata: workflow.metadata as Prisma.InputJsonValue,
          currentAssigneeUserId: workflow.currentAssigneeUserId,
          currentStepName: workflow.currentStepName,
          assigneePositionCode: workflow.assigneePositionCode,
          history: [],
        },
      });
      const updated = await tx.financeScholarshipApplication.update({
        where: { id: row.id },
        data: { workflowInstanceId: instance.id },
      });
      return { application: updated, workflowInstance: instance };
    });
  }

  async createScholarshipAwardWithWorkflow(
    award: Prisma.FinanceScholarshipAwardUncheckedCreateInput,
    workflow: PreparedWorkflowInitiation,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.financeScholarshipAward.create({ data: award });
      const instance = await tx.workflowInstance.create({
        data: {
          institutionId: workflow.institutionId,
          entityId: workflow.entityId,
          definitionId: workflow.definitionId,
          definitionCode: workflow.definitionCode,
          entityType: workflow.entityType,
          entityId_record: row.id,
          currentStep: 1,
          status: WorkflowStatus.IN_PROGRESS,
          initiatedBy: workflow.initiatedBy,
          dueAt: workflow.dueAt,
          metadata: workflow.metadata as Prisma.InputJsonValue,
          currentAssigneeUserId: workflow.currentAssigneeUserId,
          currentStepName: workflow.currentStepName,
          assigneePositionCode: workflow.assigneePositionCode,
          history: [],
        },
      });
      const updated = await tx.financeScholarshipAward.update({
        where: { id: row.id },
        data: { workflowInstanceId: instance.id },
      });
      return { award: updated, workflowInstance: instance };
    });
  }

  softDeleteFeeStructure(institutionId: string, id: string) {
    return this.prisma.feeStructure.updateMany({
      where: { id, institutionId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  findScholarshipApplicationWorkflow(institutionId: string, applicationId: string) {
    return this.prisma.financeScholarshipApplication.findFirst({
      where: { id: applicationId, institutionId },
      select: {
        id: true,
        status: true,
        workflowInstanceId: true,
        scholarshipId: true,
        studentId: true,
        entityId: true,
      },
    });
  }

  updateScholarshipApplicationWorkflow(
    applicationId: string,
    data: { workflowInstanceId?: string | null; status?: FinanceScholarshipApplicationStatus },
  ) {
    return this.prisma.financeScholarshipApplication.update({
      where: { id: applicationId },
      data,
    });
  }

  async postLedgerEntry(args: {
    accountId: string;
    institutionId: string;
    entityId: string;
    type: FinanceTransactionType;
    signedAmount: number;
    currency: string;
    description: string;
    reference: string;
    paymentMethod?: string | null;
    processedBy?: string | null;
    status?: FinanceTransactionStatus;
    metadata?: Prisma.InputJsonValue;
  }) {
    const status = args.status ?? FinanceTransactionStatus.COMPLETED;
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.financeTransaction.create({
        data: {
          institutionId: args.institutionId,
          entityId: args.entityId,
          studentAccountId: args.accountId,
          type: args.type,
          amount: new Prisma.Decimal(args.signedAmount),
          currency: args.currency,
          description: args.description,
          reference: args.reference,
          paymentMethod: args.paymentMethod ?? null,
          status,
          processedAt: status === FinanceTransactionStatus.COMPLETED ? now : null,
          processedBy: args.processedBy ?? null,
          metadata: args.metadata ?? {},
        },
      });

      if (status === FinanceTransactionStatus.COMPLETED) {
        const agg = await tx.financeTransaction.aggregate({
          where: {
            studentAccountId: args.accountId,
            institutionId: args.institutionId,
            status: FinanceTransactionStatus.COMPLETED,
          },
          _sum: { amount: true },
        });
        const balance = agg._sum.amount ?? new Prisma.Decimal(0);
        await tx.studentAccount.update({
          where: { id: args.accountId },
          data: { balance, lastTransactionAt: now },
        });
        await this.gl.postJournalLinesForTransaction(tx, {
          institutionId: args.institutionId,
          entityId: args.entityId,
          financeTransactionId: row.id,
          metadata: args.metadata ?? row.metadata,
        });
      }

      return row;
    });
  }

  createScholarshipAward(data: Prisma.FinanceScholarshipAwardCreateInput) {
    return this.prisma.financeScholarshipAward.create({ data });
  }

  findScholarshipAward(institutionId: string, awardId: string) {
    return this.prisma.financeScholarshipAward.findFirst({
      where: { id: awardId, institutionId },
      include: {
        scholarship: true,
        student: { select: { id: true, entityId: true, enrollmentStatus: true } },
      },
    });
  }

  markAwardDisbursed(awardId: string, disbursedAt: Date) {
    return this.prisma.financeScholarshipAward.update({
      where: { id: awardId },
      data: { status: 'DISBURSED', disbursedAt },
    });
  }

  incrementScholarshipDisbursed(scholarshipId: string, amount: number) {
    return this.prisma.financeScholarship.update({
      where: { id: scholarshipId },
      data: { disbursedAmount: { increment: amount } },
    });
  }

  updateScholarshipAward(awardId: string, data: Prisma.FinanceScholarshipAwardUpdateInput) {
    return this.prisma.financeScholarshipAward.update({
      where: { id: awardId },
      data,
    });
  }

  async createPendingApprovalTransaction(args: {
    institutionId: string;
    entityId: string;
    studentAccountId: string;
    type: FinanceTransactionType;
    signedAmount: number;
    currency: string;
    description: string;
    reference: string;
    processedBy: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.financeTransaction.create({
      data: {
        institutionId: args.institutionId,
        entityId: args.entityId,
        studentAccountId: args.studentAccountId,
        type: args.type,
        amount: new Prisma.Decimal(args.signedAmount),
        currency: args.currency,
        description: args.description,
        reference: args.reference,
        status: FinanceTransactionStatus.PENDING,
        processedBy: args.processedBy,
        metadata: args.metadata ?? {},
      },
    });
  }

  async linkPendingApprovalWorkflow(transactionId: string, workflowInstanceId: string) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.financeTransaction.update({
        where: { id: transactionId },
        data: { approvalWorkflowId: workflowInstanceId },
      });
      return row;
    });
  }

  /**
   * Atomically creates a pending finance transaction and its workflow instance.
   * Workflow assignee must be resolved before calling (see WorkflowEngineService.prepareInitiation).
   */
  async createPendingFinanceRequestWithWorkflow(
    pending: {
      institutionId: string;
      entityId: string;
      studentAccountId: string;
      type: FinanceTransactionType;
      signedAmount: number;
      currency: string;
      description: string;
      reference: string;
      processedBy: string;
      metadata?: Prisma.InputJsonValue;
    },
    workflow: {
      definitionId: string;
      definitionCode: string;
      institutionId: string;
      entityId: string;
      entityType: string;
      initiatedBy: string;
      metadata: Record<string, unknown>;
      currentAssigneeUserId: string;
      currentStepName: string;
      assigneePositionCode: string;
      dueAt: Date;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const pendingRow = await tx.financeTransaction.create({
        data: {
          institutionId: pending.institutionId,
          entityId: pending.entityId,
          studentAccountId: pending.studentAccountId,
          type: pending.type,
          amount: new Prisma.Decimal(pending.signedAmount),
          currency: pending.currency,
          description: pending.description,
          reference: pending.reference,
          status: FinanceTransactionStatus.PENDING,
          processedBy: pending.processedBy,
          metadata: pending.metadata ?? {},
        },
      });

      const instance = await tx.workflowInstance.create({
        data: {
          institutionId: workflow.institutionId,
          entityId: workflow.entityId,
          definitionId: workflow.definitionId,
          definitionCode: workflow.definitionCode,
          entityType: workflow.entityType,
          entityId_record: pendingRow.id,
          currentStep: 1,
          status: WorkflowStatus.IN_PROGRESS,
          initiatedBy: workflow.initiatedBy,
          dueAt: workflow.dueAt,
          metadata: workflow.metadata as Prisma.InputJsonValue,
          currentAssigneeUserId: workflow.currentAssigneeUserId,
          currentStepName: workflow.currentStepName,
          assigneePositionCode: workflow.assigneePositionCode,
          history: [],
        },
      });

      await tx.financeTransaction.update({
        where: { id: pendingRow.id },
        data: { approvalWorkflowId: instance.id },
      });

      return { pending: pendingRow, workflowInstance: instance };
    });
  }

  findApprovalTransaction(institutionId: string, transactionId: string) {
    return this.prisma.financeTransaction.findFirst({
      where: {
        id: transactionId,
        institutionId,
        status: FinanceTransactionStatus.PENDING,
        type: { in: [FinanceTransactionType.WAIVER, FinanceTransactionType.REFUND] },
      },
      include: {
        studentAccount: {
          include: {
            student: {
              select: {
                id: true,
                studentNumber: true,
                user: { select: { email: true, profile: true } },
              },
            },
          },
        },
      },
    });
  }

  async finalizeApprovalTransaction(
    transactionId: string,
    approvedBy: string,
    gatewayResponse?: Prisma.InputJsonValue,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.completePendingTransaction(transactionId, {
      processedBy: approvedBy,
      gatewayResponse,
      metadata,
    });
  }

  async cancelPendingTransaction(transactionId: string) {
    return this.prisma.financeTransaction.updateMany({
      where: { id: transactionId, status: FinanceTransactionStatus.PENDING },
      data: { status: FinanceTransactionStatus.FAILED },
    });
  }

  patchTransactionGatewayResponse(transactionId: string, patch: Record<string, unknown>) {
    return this.prisma.financeTransaction
      .findFirst({ where: { id: transactionId } })
      .then((row) => {
        if (!row) return null;
        const existing =
          row.gatewayResponse &&
          typeof row.gatewayResponse === 'object' &&
          !Array.isArray(row.gatewayResponse)
            ? (row.gatewayResponse as Record<string, unknown>)
            : {};
        return this.prisma.financeTransaction.update({
          where: { id: transactionId },
          data: {
            gatewayResponse: { ...existing, ...patch } as Prisma.InputJsonValue,
          },
        });
      });
  }

  async applyPaymentToActivePlans(studentAccountId: string, paymentAmount: number) {
    if (paymentAmount <= 0) {
      return { updated: 0 };
    }
    const plans = await this.prisma.financePaymentPlan.findMany({
      where: {
        studentAccountId,
        status: FinancePaymentPlanStatus.ACTIVE,
      },
    });
    let remaining = paymentAmount;
    let updated = 0;
    for (const plan of plans) {
      if (remaining <= 0) break;
      const installments = parsePaymentPlanInstallments(plan.installments);
      const { installments: next, applied } = applyPaymentToInstallments(installments, remaining);
      if (applied <= 0) continue;
      remaining -= applied;
      const allPaid = next.every((i) => i.status === 'PAID');
      await this.prisma.financePaymentPlan.update({
        where: { id: plan.id },
        data: {
          installments: next as unknown as Prisma.InputJsonValue,
          ...(allPaid ? { status: FinancePaymentPlanStatus.COMPLETED } : {}),
        },
      });
      updated += 1;
    }
    return { updated };
  }

  listScholarshipApplications(institutionId: string, scholarshipId?: string, entityId?: string) {
    return this.prisma.financeScholarshipApplication.findMany({
      where: {
        institutionId,
        ...(scholarshipId ? { scholarshipId } : {}),
        ...(entityId ? { entityId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        scholarship: { select: { id: true, name: true } },
        student: { select: { id: true, studentNumber: true } },
      },
    });
  }

  findScholarshipApplication(institutionId: string, applicationId: string) {
    return this.prisma.financeScholarshipApplication.findFirst({
      where: { id: applicationId, institutionId },
      include: {
        scholarship: true,
        student: { select: { id: true, entityId: true, studentNumber: true } },
      },
    });
  }

  findScholarshipApplicationByStudent(scholarshipId: string, studentId: string) {
    return this.prisma.financeScholarshipApplication.findUnique({
      where: { scholarshipId_studentId: { scholarshipId, studentId } },
    });
  }

  createScholarshipApplication(data: Prisma.FinanceScholarshipApplicationCreateInput) {
    return this.prisma.financeScholarshipApplication.create({ data });
  }

  updateScholarshipApplication(
    applicationId: string,
    data: Prisma.FinanceScholarshipApplicationUpdateInput,
  ) {
    return this.prisma.financeScholarshipApplication.update({
      where: { id: applicationId },
      data,
    });
  }

  findTransaction(institutionId: string, transactionId: string) {
    return this.prisma.financeTransaction.findFirst({
      where: { id: transactionId, institutionId },
      include: {
        studentAccount: {
          include: {
            student: {
              select: {
                id: true,
                studentNumber: true,
                user: { select: { profile: true, email: true } },
              },
            },
          },
        },
      },
    });
  }

  listBankIntegrations(institutionId: string, entityId?: string) {
    return this.prisma.financeBankIntegration.findMany({
      where: {
        institutionId,
        ...(entityId ? { entityId } : {}),
      },
      orderBy: [{ entityId: 'asc' }, { provider: 'asc' }],
    });
  }

  async upsertBankIntegration(data: {
    institutionId: string;
    entityId: string;
    provider: string;
    config: Prisma.InputJsonValue;
    isActive: boolean;
    webhookSecret?: string | null;
  }) {
    const existing = await this.prisma.financeBankIntegration.findFirst({
      where: {
        institutionId: data.institutionId,
        entityId: data.entityId,
        provider: data.provider,
      },
    });
    if (existing) {
      return this.prisma.financeBankIntegration.update({
        where: { id: existing.id },
        data: {
          config: data.config,
          isActive: data.isActive,
          ...(data.webhookSecret !== undefined ? { webhookSecret: data.webhookSecret } : {}),
        },
      });
    }
    return this.prisma.financeBankIntegration.create({
      data: {
        institutionId: data.institutionId,
        entityId: data.entityId,
        provider: data.provider,
        config: data.config,
        isActive: data.isActive,
        webhookSecret: data.webhookSecret ?? null,
      },
    });
  }
}
