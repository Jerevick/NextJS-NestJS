import { Injectable, Logger } from '@nestjs/common';
import { FinanceTransactionType, NotificationPriority, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { financeTransactionEvent } from '../notifications/notification-event-channels.util';
import { NotificationsService } from '../notifications/notifications.service';
import { ObjectStorageService } from '../storage/object-storage.service';
import { financeReceiptToPdfBuffer } from './finance-receipt-pdf.util';
import { FinanceRepository } from './finance.repository';

export type FinanceTransactionNotifyContext = {
  institutionId: string;
  studentId: string;
  entityId?: string;
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
    const { event, channels, priority } = financeTransactionEvent(ctx.type);

    this.audit.append({
      institutionId: ctx.institutionId,
      actorId: 'system-finance',
      action: 'finance.notification.send',
      entity: 'FinanceTransaction',
      entityId: ctx.transactionId,
      newValues: {
        studentId: ctx.studentId,
        type: ctx.type,
        reference: ctx.reference,
        amount: ctx.amount,
        event,
        channels,
        message,
      } as Prisma.InputJsonValue,
    });

    const target = await this.notifications.findStudentNotificationTarget(
      ctx.institutionId,
      ctx.studentId,
    );

    if (target) {
      await this.notifications.sendSystem({
        institutionId: ctx.institutionId,
        entityId: target.entityId,
        recipientId: target.userId,
        event,
        data: {
          message,
          reference: ctx.reference,
          amountLabel: signedLabel,
          studentName: ctx.studentName,
          transactionType: ctx.type,
        },
        actionUrl: '/my-finance',
        channels,
        priority,
      });
    }

    if (ctx.type !== 'PAYMENT') {
      return;
    }

    const email = ctx.studentEmail?.trim();
    if (!email && !target) {
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

      const attachmentFilename = `receipt-${ctx.reference}.pdf`;
      const receiptData = {
        reference: ctx.reference,
        studentName: ctx.studentName,
        amountLabel: signedLabel,
        description: ctx.description,
        receiptStorageKey: stored.key,
        attachmentFilename,
      };

      if (target) {
        await this.notifications.sendSystem({
          institutionId: ctx.institutionId,
          entityId: target.entityId,
          recipientId: target.userId,
          event: 'FINANCE_PAYMENT_RECEIPT',
          data: receiptData,
          channels: ['email'],
          priority: NotificationPriority.HIGH,
        });
        return;
      }

      // Student has no portal user — email receipt via engine override (no in-app row).
      await this.notifications.sendSystem({
        institutionId: ctx.institutionId,
        entityId: ctx.entityId,
        recipientId: ctx.studentId,
        event: 'FINANCE_PAYMENT_RECEIPT',
        data: { ...receiptData, recipientEmail: email },
        channels: ['email'],
        priority: NotificationPriority.HIGH,
      });
    } catch (err) {
      this.log.warn(err instanceof Error ? err.message : 'Finance receipt email failed');
    }
  }
}
