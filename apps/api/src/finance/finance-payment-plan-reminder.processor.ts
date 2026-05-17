import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { FINANCE_PAYMENT_REMINDER_QUEUE } from '../queues/queue.constants';
import { FinancePaymentPlanRemindersService } from './finance-payment-plan-reminders.service';

export type FinancePaymentReminderJobData = { dayIso: string };

@Processor(FINANCE_PAYMENT_REMINDER_QUEUE)
export class FinancePaymentPlanReminderProcessor extends WorkerHost {
  private readonly log = new Logger(FinancePaymentPlanReminderProcessor.name);

  constructor(private readonly reminders: FinancePaymentPlanRemindersService) {
    super();
  }

  async process(_job: Job<FinancePaymentReminderJobData>): Promise<void> {
    const result = await this.reminders.sendDueReminders();
    this.log.log(`Payment plan reminders sent=${result.sent}`);
  }
}
