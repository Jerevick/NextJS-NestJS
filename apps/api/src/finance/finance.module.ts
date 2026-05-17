import { BullModule } from '@nestjs/bullmq';
import { Logger, Module, forwardRef } from '@nestjs/common';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { MailService } from '../mail/mail.service';
import {
  FINANCE_BULK_CHARGE_QUEUE,
  FINANCE_PAYMENT_REMINDER_QUEUE,
} from '../queues/queue.constants';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { FinanceBalanceCacheService } from './finance-balance-cache.service';
import { FinanceBankIntegrationsController } from './finance-bank-integrations.controller';
import { FinanceBankIntegrationsService } from './finance-bank-integrations.service';
import { FinanceBulkChargeController } from './finance-bulk-charge.controller';
import { FinanceDirectorService } from './finance-director.service';
import { FinanceBulkChargeProcessor } from './finance-bulk-charge.processor';
import { FinanceBulkChargeService } from './finance-bulk-charge.service';
import { FinanceEnrollmentChargesService } from './finance-enrollment-charges.service';
import { FinanceEnrollmentListener } from './finance-enrollment.listener';
import { FinanceReportScopeService } from './finance-report-scope.service';
import { FinanceFeeStructuresController } from './finance-fee-structures.controller';
import { FinanceFinancialHoldsService } from './finance-financial-holds.service';
import { FinancePaymentPlanReminderJobsService } from './finance-payment-plan-reminder-jobs.service';
import { FinancePaymentPlanReminderProcessor } from './finance-payment-plan-reminder.processor';
import { FinancePaymentPlanRemindersService } from './finance-payment-plan-reminders.service';
import { FinanceScholarshipFormsService } from './finance-scholarship-forms.service';
import { FinancePaymentPlansController } from './finance-payment-plans.controller';
import { FinancePaymentsController } from './finance-payments.controller';
import { FinancePaymentsService } from './finance-payments.service';
import { FinanceReportsController } from './finance-reports.controller';
import { FinanceSchedulerService } from './finance-scheduler.service';
import { FinancePaymentsWebhookService } from './finance-payments-webhook.service';
import { FinanceScholarshipFormsAdminService } from './finance-scholarship-forms-admin.service';
import { FinanceScholarshipFormsController } from './finance-scholarship-forms.controller';
import { FinanceScholarshipsController } from './finance-scholarships.controller';
import { FinanceDirectorGuard } from './guards/finance-director.guard';
import { FinanceChartOfAccountsController } from './finance-chart-of-accounts.controller';
import { FinanceGlService } from './finance-gl.service';
import { FinanceStudentAccessService } from './finance-student-access.service';
import { FinanceStudentsController } from './finance-students.controller';
import { FinanceStudentExcessController } from './finance-student-excess.controller';
import { FinanceNotificationsService } from './finance-notifications.service';
import { FinanceReportsService } from './finance-reports.service';
import { FinanceRepository } from './finance.repository';
import { FinanceService } from './finance.service';
import { FlutterwaveFinanceGateway } from './payment-gateway/flutterwave-finance.gateway';
import { NoopFinanceGateway } from './payment-gateway/noop-finance.gateway';
import { PaymobFinanceGateway } from './payment-gateway/paymob-finance.gateway';
import { PaystackFinanceGateway } from './payment-gateway/paystack-finance.gateway';
import { PaymentGatewayService } from './payment-gateway/payment-gateway.service';
import { StripeFinanceGateway } from './payment-gateway/stripe-finance.gateway';

const useBull = Boolean(process.env.REDIS_URL?.trim());
if (!useBull) {
  new Logger('FinanceModule').warn(
    'REDIS_URL is not set — finance bulk charges run synchronously in the API process.',
  );
}

@Module({
  imports: [
    NotificationsModule,
    forwardRef(() => WorkflowEngineModule),
    ...(useBull
      ? [
          BullModule.registerQueue({ name: FINANCE_BULK_CHARGE_QUEUE }),
          BullModule.registerQueue({ name: FINANCE_PAYMENT_REMINDER_QUEUE }),
        ]
      : []),
  ],
  controllers: [
    FinanceFeeStructuresController,
    FinanceChartOfAccountsController,
    FinanceStudentsController,
    FinanceStudentExcessController,
    FinancePaymentPlansController,
    FinanceScholarshipsController,
    FinanceReportsController,
    FinancePaymentsController,
    FinanceBulkChargeController,
    FinanceBankIntegrationsController,
    FinanceScholarshipFormsController,
  ],
  providers: [
    MailService,
    FinanceService,
    FinancePaymentsService,
    FinanceNotificationsService,
    FinanceReportsService,
    FinanceGlService,
    FinanceStudentAccessService,
    FinanceRepository,
    FinanceBalanceCacheService,
    FinanceEnrollmentChargesService,
    FinanceEnrollmentListener,
    FinanceReportScopeService,
    FinanceBulkChargeService,
    FinanceFinancialHoldsService,
    FinancePaymentPlanRemindersService,
    FinancePaymentPlanReminderJobsService,
    FinanceScholarshipFormsService,
    FinanceDirectorService,
    FinanceBankIntegrationsService,
    FinancePaymentsWebhookService,
    FinanceScholarshipFormsAdminService,
    FinanceDirectorGuard,
    FinanceSchedulerService,
    StripeFinanceGateway,
    FlutterwaveFinanceGateway,
    PaystackFinanceGateway,
    PaymobFinanceGateway,
    NoopFinanceGateway,
    PaymentGatewayService,
    PermissionsGuard,
    ...(useBull ? [FinanceBulkChargeProcessor, FinancePaymentPlanReminderProcessor] : []),
  ],
  exports: [FinanceService, FinanceEnrollmentChargesService, FinanceBulkChargeService],
})
export class FinanceModule {}
