import { Injectable, Logger } from '@nestjs/common';
import { FinanceTransactionType, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { ObjectStorageService } from '../storage/object-storage.service';
import { financeReceiptToPdfBuffer } from './finance-receipt-pdf.util';
import { NotificationsService } from '../notifications/notifications.service';
import { FinanceRepository } from './finance.repository';

export type FinanceTransactionNotifyContext = {
  institutionId: string;
  studentId: string;
  transactionId: string;
  reference: string;
  type: FinanceTransactionType;
  amount: number;
  currency: string;
  description: string;
  processedAt: string;
  paymentMethod?: string | null;
  studentNumber: string;
  studentName: string;
  studentEmail?: string | null;
  institutionName?: string | null;
};

@Injectable()
export class FinanceNotificationsService {
  private readonly log = new Logger(FinanceNotificationsService.name);

  constructor(
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly storage: ObjectStorageService,
    private readonly repo: FinanceRepository,
    private readonly notifications: NotificationsService,
  ) {}

  async notifyTransactionCompleted(ctx: FinanceTransactionNotifyContext): Promise<void> {
    const signedLabel =
      ctx.amount < 0
        ? `Credit ${Math.abs(ctx.amount).toFixed(2)} ${ctx.currency}`
        : `Charge ${ctx.amount.toFixed(2)} ${ctx.currency}`;

    const message = `${ctx.description} — ${signedLabel}`;
    this.audit.append({
      institutionId: ctx.institutionId,
      actorId: 'system-finance',
      action: 'finance.notification.in_app',
      entity: 'FinanceTransaction',
      entityId: ctx.transactionId,
      newValues: {
        studentId: ctx.studentId,
        type: ctx.type,
        reference: ctx.reference,
        amount: ctx.amount,
        message,
      } as Prisma.InputJsonValue,
    });

    const userId = await this.notifications.findStudentUserId(ctx.institutionId, ctx.studentId);
    if (userId) {
      await this.notifications.create({
        institutionId: ctx.institutionId,
        userId,
        category: 'finance',
        title: `Finance · ${ctx.reference}`,
        body: message,
        actionUrl: `/my-finance`,
        metadata: {
          transactionId: ctx.transactionId,
          type: ctx.type,
          reference: ctx.reference,
        },
      });
    }

    if (!ctx.studentEmail?.trim()) {
      return;
    }

    try {
      const buffer = await financeReceiptToPdfBuffer({
        institutionName: ctx.institutionName ?? undefined,
        studentNumber: ctx.studentNumber,
        studentName: ctx.studentName,
        reference: ctx.reference,
        type: ctx.type,
        amount: ctx.amount,
        currency: ctx.currency,
        description: ctx.description,
        processedAt: ctx.processedAt,
        paymentMethod: ctx.paymentMethod ?? undefined,
      });

      const storageKey = `finance/receipts/${ctx.institutionId}/${ctx.reference}.pdf`;
      const stored = await this.storage.putBuffer(storageKey, buffer, 'application/pdf');
      await this.repo.patchTransactionGatewayResponse(ctx.transactionId, {
        receiptStorageKey: stored.key,
        receiptUrl: stored.url,
      });

      const subject = `Receipt · ${ctx.reference}`;
      const text = `Hello ${ctx.studentName},\n\nYour ${ctx.type} transaction (${ctx.reference}) has been recorded.\n${signedLabel}\n\n${ctx.description}`;
      await this.mail.sendEmail(ctx.studentEmail, subject, text, undefined, [
        { filename: `receipt-${ctx.reference}.pdf`, content: buffer },
      ]);
    } catch (err) {
      this.log.warn(err instanceof Error ? err.message : 'Finance receipt email failed');
    }
  }
}
