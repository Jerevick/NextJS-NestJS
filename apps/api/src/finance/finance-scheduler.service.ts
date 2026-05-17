import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FinanceFinancialHoldsService } from './finance-financial-holds.service';
import { FinancePaymentPlanReminderJobsService } from './finance-payment-plan-reminder-jobs.service';

@Injectable()
export class FinanceSchedulerService {
  private readonly log = new Logger(FinanceSchedulerService.name);

  constructor(
    private readonly holds: FinanceFinancialHoldsService,
    private readonly planReminderJobs: FinancePaymentPlanReminderJobsService,
  ) {}

  @Cron('0 6 * * *', { timeZone: 'UTC' })
  async dailyFinanceJobs() {
    try {
      const holdResult = await this.holds.scanAndPlaceHolds();
      const reminderResult = await this.planReminderJobs.runDueReminders();
      this.log.log(
        `Finance daily: holds placed=${holdResult.placed} scanned=${holdResult.scanned}, reminders=${reminderResult.sent}`,
      );
    } catch (err) {
      this.log.error(
        `Finance daily jobs failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
