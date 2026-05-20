import { Injectable, Logger } from '@nestjs/common';
import { FinancePaymentPlanStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationEventsService } from '../notifications/notification-events.service';
import { FEE_DUE_REMINDER_DAYS, isFeeDueReminderDay } from './finance-fee-due.util';
import { parsePaymentPlanInstallments } from './finance.util';

@Injectable()
export class FinancePaymentPlanRemindersService {
  private readonly log = new Logger(FinancePaymentPlanRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: NotificationEventsService,
  ) {}

  /** Notify students + guardians at 7, 3, and 1 days before installment due dates. */
  async sendDueReminders(): Promise<{ sent: number }> {
    const today = new Date();
    let sent = 0;
    const sentKeys = new Set<string>();

    const plans = await this.prisma.financePaymentPlan.findMany({
      where: { status: FinancePaymentPlanStatus.ACTIVE },
      include: {
        studentAccount: {
          include: {
            student: {
              select: {
                id: true,
                institutionId: true,
                entityId: true,
                userId: true,
                guardians: true,
                user: { select: { email: true, profile: true } },
              },
            },
          },
        },
      },
      take: 500,
    });

    for (const plan of plans) {
      const student = plan.studentAccount.student;
      const installments = parsePaymentPlanInstallments(plan.installments);
      for (const inst of installments) {
        if (inst.status !== 'PENDING') {
          continue;
        }
        const due = new Date(inst.dueDate);
        for (const daysBefore of FEE_DUE_REMINDER_DAYS) {
          if (!isFeeDueReminderDay(due, daysBefore, today)) {
            continue;
          }
          const dedupeKey = `fee-due:${plan.id}:${inst.dueDate}:${daysBefore}`;
          if (sentKeys.has(dedupeKey)) {
            continue;
          }
          sentKeys.add(dedupeKey);

          await this.notify.notifyFeeDue({
            institutionId: plan.institutionId,
            entityId: student.entityId,
            studentId: student.id,
            studentUserId: student.userId,
            guardians: student.guardians,
            amount: `${inst.amount} ${plan.currency}`,
            dueDate: inst.dueDate,
            daysBefore,
            currency: plan.currency,
          });

          sent += 1;
        }
      }
    }

    if (sent > 0) {
      this.log.log(`Sent ${sent} fee-due notification(s)`);
    }
    return { sent };
  }
}
