import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { FINANCE_PAYMENT_REMINDER_QUEUE } from '../queues/queue.constants';
import { FinancePaymentPlanRemindersService } from './finance-payment-plan-reminders.service';

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class FinancePaymentPlanReminderJobsService {
  private readonly log = new Logger(FinancePaymentPlanReminderJobsService.name);

  constructor(
    private readonly reminders: FinancePaymentPlanRemindersService,
    @Optional()
    @InjectQueue(FINANCE_PAYMENT_REMINDER_QUEUE)
    private readonly reminderQueue?: Queue,
  ) {}

  usesQueue(): boolean {
    return Boolean(this.reminderQueue);
  }

  async runDueReminders(
    day: Date = new Date(),
  ): Promise<{ sent: number; mode: 'queued' | 'sync' }> {
    if (this.reminderQueue) {
      await this.reminderQueue.add(
        'send-due',
        { dayIso: day.toISOString() },
        {
          jobId: `finance-reminders-${utcDayKey(day)}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 50,
          removeOnFail: 25,
        },
      );
      this.log.log('Enqueued finance payment plan reminder job');
      return { sent: 0, mode: 'queued' };
    }
    const result = await this.reminders.sendDueReminders();
    return { ...result, mode: 'sync' };
  }
}
