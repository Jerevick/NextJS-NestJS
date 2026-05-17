import { Injectable, Logger } from '@nestjs/common';
import { FinancePaymentPlanStatus } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { parsePaymentPlanInstallments } from './finance.util';

@Injectable()
export class FinancePaymentPlanRemindersService {
  private readonly log = new Logger(FinancePaymentPlanRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** Notify students of installments due within 3 days (email + audit log). */
  async sendDueReminders(): Promise<{ sent: number }> {
    const now = new Date();
    const horizon = new Date(now.getTime() + 3 * 86_400_000);
    let sent = 0;

    const plans = await this.prisma.financePaymentPlan.findMany({
      where: { status: FinancePaymentPlanStatus.ACTIVE },
      include: {
        studentAccount: {
          include: {
            student: {
              select: {
                id: true,
                institutionId: true,
                userId: true,
                user: { select: { email: true, profile: true } },
              },
            },
          },
        },
      },
      take: 500,
    });

    for (const plan of plans) {
      const installments = parsePaymentPlanInstallments(plan.installments);
      for (const inst of installments) {
        if (inst.status !== 'PENDING') {
          continue;
        }
        const due = new Date(inst.dueDate);
        if (due < now || due > horizon) {
          continue;
        }
        await this.prisma.auditLog.create({
          data: {
            institutionId: plan.institutionId,
            actorId: 'system-finance-reminders',
            action: 'finance.paymentPlan.reminder',
            entity: 'FinancePaymentPlan',
            entityId: plan.id,
            newValues: {
              studentId: plan.studentAccount.studentId,
              dueDate: inst.dueDate,
              amount: inst.amount,
              installmentDueDate: inst.dueDate,
            },
          },
        });
        const email = plan.studentAccount.student.user?.email?.trim();
        if (email) {
          const profile = plan.studentAccount.student.user?.profile as {
            firstName?: string;
          } | null;
          const name = profile?.firstName ?? 'Student';
          await this.mail.sendEmail(
            email,
            'Payment plan installment due soon',
            `Hello ${name},\n\nAn installment of ${inst.amount} ${plan.currency} is due on ${inst.dueDate}. Please sign in to pay your balance.`,
          );
        }
        sent += 1;
      }
    }

    if (sent > 0) {
      this.log.log(`Queued ${sent} payment plan reminder audit entries`);
    }
    return { sent };
  }
}
