/**
 * Phase 9 finance module — spec-aligned import path (`apps/api/src/modules/finance/`).
 * Implementation remains in `apps/api/src/finance/` to avoid a disruptive file move.
 */
export { FinanceModule } from './finance.module';
export { FinanceService } from '../../finance/finance.service';
export {
  FINANCE_CHART_OF_ACCOUNTS_VERSION,
  INSTITUTION_DEFAULT_CHART_OF_ACCOUNTS,
  listChartOfAccounts,
} from '../../finance/finance-chart-of-accounts';
