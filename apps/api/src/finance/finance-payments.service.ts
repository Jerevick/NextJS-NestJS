import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  PLATFORM_WEBHOOK_DISPATCH,
  type PlatformWebhookDispatchPayload,
} from '../events/platform-webhook.events';
import { FinanceTransactionStatus, FinanceTransactionType, Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import type { InitiateStudentPaymentDto } from './dto/initiate-student-payment.dto';
import { FinanceBalanceCacheService } from './finance-balance-cache.service';
import { FinanceNotificationsService } from './finance-notifications.service';
import { FinanceRepository } from './finance.repository';
import { buildLedgerMetadata } from './finance-ledger-entries.util';
import { signedLedgerAmount } from './finance.util';
import { PaymentGatewayService } from './payment-gateway/payment-gateway.service';
import { FinanceStudentAccessService } from './finance-student-access.service';

@Injectable()
export class FinancePaymentsService {
  private readonly log = new Logger(FinancePaymentsService.name);

  constructor(
    private readonly repo: FinanceRepository,
    private readonly studentAccess: FinanceStudentAccessService,
    private readonly audit: AuditService,
    private readonly balanceCache: FinanceBalanceCacheService,
    private readonly gateways: PaymentGatewayService,
    private readonly notifications: FinanceNotificationsService,
    private readonly events: EventEmitter2,
  ) {}

  async initiateStudentPayment(actor: AuthUser, studentId: string, dto: InitiateStudentPaymentDto) {
    await this.studentAccess.assertFinanceStudentAccess(actor, studentId);
    const student = await this.repo.findStudentForFinance(actor.institutionId, studentId);
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

    const currency = (dto.currency ?? account.currency).toUpperCase();
    const result = await this.gateways.initialize({
      institutionId: actor.institutionId,
      entityId: student.entityId,
      studentId,
      studentAccountId: account.id,
      amount: dto.amount,
      currency,
      description: dto.description.trim(),
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
    });

    await this.repo.createPendingGatewayTransaction({
      institutionId: actor.institutionId,
      entityId: student.entityId,
      studentAccountId: account.id,
      reference: result.reference,
      signedAmount: signedLedgerAmount(FinanceTransactionType.PAYMENT, dto.amount),
      currency,
      description: dto.description.trim(),
      gatewayRef: result.reference,
      gatewayResponse: {
        provider: result.provider,
        paymentUrl: result.paymentUrl,
      } as Prisma.InputJsonValue,
    });

    return result;
  }

  /** Called from Stripe webhook after signature verification. */
  async completeGatewayPayment(reference: string, gatewayPayload?: Prisma.InputJsonValue) {
    const pending = await this.repo.findTransactionByReference(reference);
    if (!pending) {
      this.log.warn(`Gateway payment reference not found: ${reference}`);
      return { ok: false, reason: 'not_found' as const };
    }
    if (pending.status === FinanceTransactionStatus.COMPLETED) {
      return { ok: true, reason: 'already_completed' as const };
    }
    if (pending.type !== FinanceTransactionType.PAYMENT) {
      return { ok: false, reason: 'invalid_type' as const };
    }

    const account = await this.repo.findAccountById(pending.studentAccountId);
    if (!account) {
      return { ok: false, reason: 'account_missing' as const };
    }

    try {
      const verified = await this.gateways.verifyPayment(pending.entityId, reference);
      if (verified.status === 'failed') {
        return { ok: false, reason: 'verification_failed' as const };
      }
    } catch (err) {
      this.log.warn(`verifyPayment failed for ${reference}: ${String(err)}`);
    }

    const signed = Number(pending.amount);
    const row = await this.repo.completePendingTransaction(pending.id, {
      gatewayResponse: gatewayPayload ?? pending.gatewayResponse ?? undefined,
      processedBy: null,
      metadata: buildLedgerMetadata(
        FinanceTransactionType.PAYMENT,
        signed,
      ) as Prisma.InputJsonValue,
    });
    await this.balanceCache.invalidate(pending.institutionId, account.studentId);
    const paymentAmount = Math.abs(Number(pending.amount));
    await this.repo.applyPaymentToActivePlans(pending.studentAccountId, paymentAmount);
    if (row) {
      void this.notifyGatewayPayment(pending.institutionId, account.studentId, row.id);
    }

    this.audit.append({
      institutionId: pending.institutionId,
      actorId: 'gateway',
      action: 'finance.payment.gateway.complete',
      entity: 'FinanceTransaction',
      entityId: pending.id,
      newValues: { reference } as Prisma.InputJsonValue,
    });

    const student = await this.repo.findStudentForFinance(pending.institutionId, account.studentId);
    const webhookPayload: PlatformWebhookDispatchPayload = {
      event: 'payment.received',
      institutionId: pending.institutionId,
      entityId: student?.entityId ?? pending.entityId,
      data: {
        transactionId: pending.id,
        studentId: account.studentId,
        amount: paymentAmount,
        reference,
        currency: pending.currency,
      },
    };
    this.events.emit(PLATFORM_WEBHOOK_DISPATCH, webhookPayload);

    return { ok: true, reason: 'completed' as const, transactionId: pending.id };
  }

  private async notifyGatewayPayment(
    institutionId: string,
    studentId: string,
    transactionId: string,
  ) {
    const txn = await this.repo.findTransaction(institutionId, transactionId);
    if (!txn) return;
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
}
