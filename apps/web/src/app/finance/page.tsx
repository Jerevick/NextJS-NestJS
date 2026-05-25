import Link from 'next/link';
import { Suspense } from 'react';

import { auth } from '@/auth';
import { FinanceBankIntegrationsPanel } from '@/components/finance/finance-bank-integrations-panel';
import { FinanceBulkChargeForm } from '@/components/finance/finance-bulk-charge-form';
import { FinanceFeeStructureEditor } from '@/components/finance/finance-fee-structure-editor';
import { FinanceGlCoaPanel } from '@/components/finance/finance-gl-coa-panel';
import { FinanceHubForms } from '@/components/finance/finance-hub-forms';
import { FinanceReportsFilters } from '@/components/finance/finance-reports-filters';
import { FinanceReportsPanel } from '@/components/finance/finance-reports-panel';
import { FinanceScholarshipFormsPanel } from '@/components/finance/finance-scholarship-forms-panel';
import { FinanceScholarshipApplicationsPanel } from '@/components/finance/finance-scholarship-applications-panel';
import { FinanceScholarshipsPanel } from '@/components/finance/finance-scholarships-panel';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { canAccessBillingNav, hasPermission } from '@/lib/permissions';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type FeeRow = {
  id: string;
  name: string;
  academicYearName: string;
  isDefault: boolean;
  items: Array<{ code: string; name: string; amount: number }>;
};

/** Institution finance hub — fee structures + links to SaaS billing. */
export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; departmentId?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const canFinance =
    hasPermission(session?.user?.permissions, 'finance.read') ||
    hasPermission(session?.user?.permissions, 'finance.write');
  const canBilling = canAccessBillingNav(session?.user?.permissions);
  const token = session?.accessToken;

  if (!token) {
    return (
      <main style={{ padding: '2rem' }}>
        <p style={{ color: '#64748b' }}>Sign in to open finance tools.</p>
      </main>
    );
  }

  if (!canFinance && !canBilling) {
    return (
      <main style={{ padding: '2rem', maxWidth: 720 }}>
        <h1 style={{ color: '#0f1729' }}>Finance</h1>
        <p style={{ color: '#64748b' }}>You need finance or billing permissions for this area.</p>
      </main>
    );
  }

  let feeStructures: FeeRow[] = [];
  let academicYears: Array<{ id: string; name: string }> = [];
  let outstanding: Array<{
    studentId: string;
    studentNumber: string;
    studentName: string;
    balance: number;
    currency: string;
  }> = [];
  let totalOutstanding = 0;
  let scholarships: Array<{
    id: string;
    name: string;
    type: string;
    totalFund: number;
    disbursedAmount: number;
  }> = [];
  let awards: Array<{
    id: string;
    scholarshipName: string;
    studentNumber: string;
    amount: number;
    status: string;
  }> = [];
  let aging: {
    buckets: Array<{ label: string; count: number; total: number }>;
    accountCount: number;
  } | null = null;
  let revenue: {
    from: string;
    to: string;
    transactionCount: number;
    byType: Record<string, number>;
    byMethod: Record<string, number>;
  } | null = null;
  let programs: Array<{ id: string; name: string; code: string }> = [];
  let entities: Array<{ id: string; name: string; code: string }> = [];
  let bankIntegrations: Array<{
    id: string;
    entityId: string;
    provider: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }> = [];
  let scholarshipApplications: Array<{
    id: string;
    scholarshipId: string;
    scholarshipName: string;
    studentId: string;
    studentNumber: string;
    status: string;
    workflowInstanceId?: string | null;
    responses: unknown;
    createdAt: string;
  }> = [];
  let scholarshipFormRows: Array<{ id: string; updatedAt: string }> = [];
  let scholarshipForms: Array<{ id: string; label: string }> = [];
  let departments: Array<{ id: string; name: string }> = [];
  let glAccounts: Array<{
    id: string;
    code: string;
    name: string;
    type: string;
    normalBalance: string;
    isSystem: boolean;
    isActive: boolean;
  }> = [];
  let glTrialBalance: {
    accounts: Array<{ accountCode: string; totalDebit: number; totalCredit: number; net: number }>;
  } | null = null;

  const defaultTo = new Date();
  const defaultFrom = new Date(defaultTo.getTime() - 90 * 86_400_000);
  const revenueFrom = sp.from ?? defaultFrom.toISOString();
  const revenueTo = sp.to ?? defaultTo.toISOString();
  const revenueQs = new URLSearchParams();
  if (sp.from) revenueQs.set('from', sp.from);
  if (sp.to) revenueQs.set('to', sp.to);
  if (sp.departmentId) revenueQs.set('departmentId', sp.departmentId);
  const exportQuery = revenueQs.toString() ? `?${revenueQs.toString()}` : '';
  const departmentQuery = sp.departmentId
    ? `?departmentId=${encodeURIComponent(sp.departmentId)}`
    : '';

  if (canFinance && token) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'X-Institution-ID': session!.user!.institutionId,
    };
    appendOptionalEntityHeader(headers, session!.user!);

    const revenueUrl = `${apiBase}/finance/reports/revenue?${new URLSearchParams({
      from: revenueFrom,
      to: revenueTo,
      ...(sp.departmentId ? { departmentId: sp.departmentId } : {}),
    }).toString()}`;

    const [
      feeRes,
      yearRes,
      progRes,
      outRes,
      schRes,
      awardRes,
      agingRes,
      revRes,
      appRes,
      entRes,
      bankRes,
      formsRes,
      deptRes,
      coaRes,
      tbRes,
    ] = await Promise.all([
      fetch(`${apiBase}/finance/fee-structures`, { headers, cache: 'no-store' }),
      fetch(`${apiBase}/academic/years`, { headers, cache: 'no-store' }),
      fetch(`${apiBase}/academic/catalog/programs`, { headers, cache: 'no-store' }),
      fetch(`${apiBase}/finance/reports/outstanding${departmentQuery}`, {
        headers,
        cache: 'no-store',
      }),
      fetch(`${apiBase}/finance/scholarships`, { headers, cache: 'no-store' }),
      fetch(`${apiBase}/finance/scholarships/awards`, { headers, cache: 'no-store' }),
      fetch(`${apiBase}/finance/reports/aging${departmentQuery}`, { headers, cache: 'no-store' }),
      fetch(revenueUrl, { headers, cache: 'no-store' }),
      fetch(`${apiBase}/finance/scholarships/applications`, { headers, cache: 'no-store' }),
      fetch(`${apiBase}/institutions/${session!.user!.institutionId}/entities`, {
        headers,
        cache: 'no-store',
      }),
      fetch(`${apiBase}/finance/bank-integrations`, { headers, cache: 'no-store' }),
      fetch(`${apiBase}/finance/scholarship-forms`, { headers, cache: 'no-store' }),
      fetch(`${apiBase}/academic/catalog/departments`, { headers, cache: 'no-store' }),
      fetch(`${apiBase}/finance/chart-of-accounts?includeInactive=true`, {
        headers,
        cache: 'no-store',
      }),
      fetch(`${apiBase}/finance/gl/trial-balance`, { headers, cache: 'no-store' }),
    ]);
    if (feeRes.ok) {
      const j = (await feeRes.json()) as { data?: FeeRow[] };
      feeStructures = j.data ?? [];
    }
    if (yearRes.ok) {
      const j = (await yearRes.json()) as { data?: Array<{ id: string; name: string }> };
      academicYears = j.data ?? [];
    }
    if (progRes.ok) {
      const j = (await progRes.json()) as
        | Array<{ id: string; name: string; code: string }>
        | { data?: Array<{ id: string; name: string; code: string }> };
      programs = Array.isArray(j) ? j : (j.data ?? []);
    }
    if (outRes.ok) {
      const j = (await outRes.json()) as {
        data?: typeof outstanding;
        totalOutstanding?: number;
      };
      outstanding = j.data ?? [];
      totalOutstanding = j.totalOutstanding ?? 0;
    }
    if (schRes.ok) {
      const j = (await schRes.json()) as { data?: typeof scholarships };
      scholarships = j.data ?? [];
    }
    if (awardRes.ok) {
      const j = (await awardRes.json()) as { data?: typeof awards };
      awards = j.data ?? [];
    }
    if (agingRes.ok) {
      aging = (await agingRes.json()) as typeof aging;
    }
    if (revRes.ok) {
      revenue = (await revRes.json()) as typeof revenue;
    }
    if (appRes.ok) {
      const j = (await appRes.json()) as { data?: typeof scholarshipApplications };
      scholarshipApplications = j.data ?? [];
    }
    if (entRes.ok) {
      const j = (await entRes.json()) as { data?: typeof entities };
      entities = j.data ?? [];
    }
    if (bankRes.ok) {
      const j = (await bankRes.json()) as { data?: typeof bankIntegrations };
      bankIntegrations = j.data ?? [];
    }
    if (formsRes.ok) {
      const j = (await formsRes.json()) as {
        data?: Array<{ id: string; updatedAt: string }>;
      };
      scholarshipFormRows = j.data ?? [];
      scholarshipForms = scholarshipFormRows.map((f) => ({
        id: f.id,
        label: `Form ${f.id.slice(0, 8)}…`,
      }));
    }
    if (coaRes.ok) {
      const j = (await coaRes.json()) as { accounts?: typeof glAccounts };
      glAccounts = j.accounts ?? [];
    }
    if (tbRes.ok) {
      glTrialBalance = (await tbRes.json()) as typeof glTrialBalance;
    }
    if (deptRes.ok) {
      const j = (await deptRes.json()) as
        | Array<{ id: string; name: string }>
        | { data?: Array<{ id: string; name: string }> };
      departments = Array.isArray(j) ? j : (j.data ?? []);
    }
  }

  const entityScopeAll = session?.user?.entityScope === 'ALL';
  const defaultEntityId =
    session?.user?.entityScope === 'ENTITY' ? session.user.entityId : entities[0]?.id;

  return (
    <main
      style={{ padding: '2rem 2.5rem', maxWidth: 900, minHeight: '100vh', background: '#f8fafc' }}
    >
      <Link
        href="/dashboard"
        style={{ color: '#2563eb', fontSize: '0.9rem', textDecoration: 'none' }}
      >
        ← Dashboard
      </Link>
      <h1 style={{ margin: '0.75rem 0 0', color: '#0f1729' }}>Finance</h1>
      <p style={{ color: '#64748b', lineHeight: 1.55, marginTop: '0.5rem' }}>
        Student ledger, fee structures, and payment gateways. Institution SaaS subscription billing
        remains under{' '}
        <Link href="/dashboard/billing" style={{ color: '#2563eb' }}>
          Billing
        </Link>
        .
      </p>

      {canFinance ? (
        <section
          style={{
            marginTop: '1.5rem',
            padding: '1.25rem 1.5rem',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
          }}
        >
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', color: '#0f1729' }}>
            Fee structures
          </h2>
          <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#64748b' }}>
            Enrollment auto-charges ACTIVE students from matching fee structures (ENROLLMENT /
            PER_COURSE lines). Student balances live on each profile · Financial tab.
          </p>
          <FinanceHubForms
            academicYears={academicYears}
            canWrite={hasPermission(session?.user?.permissions, 'finance.write')}
          />
          <FinanceFeeStructureEditor
            feeStructures={feeStructures}
            canWrite={hasPermission(session?.user?.permissions, 'finance.write')}
          />
          {feeStructures.length <= 0 ? (
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
              No fee structures yet for this scope.
            </p>
          ) : null}
        </section>
      ) : null}

      {canBilling ? (
        <section
          style={{
            marginTop: '1.25rem',
            padding: '1.25rem 1.5rem',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
          }}
        >
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', color: '#0f1729' }}>
            Platform billing
          </h2>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#334155', lineHeight: 1.7 }}>
            <li>
              <Link href="/dashboard/billing" style={{ color: '#2563eb' }}>
                Billing overview
              </Link>
            </li>
            <li>
              <Link href="/dashboard/billing/disputes" style={{ color: '#2563eb' }}>
                Billing disputes
              </Link>
            </li>
          </ul>
        </section>
      ) : null}

      {canFinance ? (
        <section
          style={{
            marginTop: '1.25rem',
            padding: '1.25rem 1.5rem',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
          }}
        >
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', color: '#0f1729' }}>
            Outstanding balances
          </h2>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem' }}>
            <Link
              href={`/dashboard/finance/reports/outstanding${departmentQuery}`}
              style={{ color: '#2563eb', fontWeight: 600 }}
            >
              Download outstanding CSV
            </Link>
          </p>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#64748b' }}>
            Total outstanding:{' '}
            <strong style={{ color: '#b45309' }}>
              {totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </strong>
          </p>
          {outstanding.length <= 0 ? (
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
              No positive balances in scope.
            </p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '0.88rem' }}>
              {outstanding.slice(0, 12).map((r) => (
                <li
                  key={r.studentId}
                  style={{ padding: '0.35rem 0', borderBottom: '1px solid #f1f5f9' }}
                >
                  <Link
                    href={`/dashboard/students/${r.studentId}?tab=financial`}
                    style={{ color: '#2563eb' }}
                  >
                    {r.studentNumber}
                  </Link>{' '}
                  · {r.studentName} · {r.balance.toFixed(2)} {r.currency}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {canFinance ? (
        <section
          style={{
            marginTop: '1.25rem',
            padding: '1.25rem 1.5rem',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
          }}
        >
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', color: '#0f1729' }}>
            Bulk charges
          </h2>
          <FinanceBulkChargeForm
            programs={programs}
            canWrite={hasPermission(session?.user?.permissions, 'finance.write')}
          />
        </section>
      ) : null}

      {canFinance ? (
        <section
          style={{
            marginTop: '1.25rem',
            padding: '1.25rem 1.5rem',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
          }}
        >
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', color: '#0f1729' }}>
            Bank & payout integrations
          </h2>
          <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#64748b' }}>
            Per-entity provider configuration for settlements and bank file exports. Sensitive
            config is stored server-side only.
          </p>
          <FinanceBankIntegrationsPanel
            integrations={bankIntegrations}
            entities={entities}
            defaultEntityId={defaultEntityId}
            entityScopeAll={entityScopeAll}
            canWrite={hasPermission(session?.user?.permissions, 'finance.write')}
          />
        </section>
      ) : null}

      {canFinance ? (
        <section
          style={{
            marginTop: '1.25rem',
            padding: '1.25rem 1.5rem',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
          }}
        >
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', color: '#0f1729' }}>
            Institution GL (chart of accounts)
          </h2>
          <FinanceGlCoaPanel
            accounts={glAccounts}
            trialBalance={glTrialBalance}
            canWrite={hasPermission(session?.user?.permissions, 'finance.write')}
          />
        </section>
      ) : null}

      {canFinance ? (
        <section
          style={{
            marginTop: '1.25rem',
            padding: '1.25rem 1.5rem',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
          }}
        >
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', color: '#0f1729' }}>Reports</h2>
          <Suspense fallback={null}>
            <FinanceReportsFilters
              departments={departments}
              defaultFrom={revenueFrom}
              defaultTo={revenueTo}
            />
          </Suspense>
          <FinanceReportsPanel aging={aging} revenue={revenue} exportQuery={exportQuery} />
        </section>
      ) : null}

      {canFinance ? (
        <section
          style={{
            marginTop: '1.25rem',
            padding: '1.25rem 1.5rem',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
          }}
        >
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', color: '#0f1729' }}>
            Scholarships
          </h2>
          <FinanceScholarshipFormsPanel
            forms={scholarshipFormRows}
            canWrite={hasPermission(session?.user?.permissions, 'finance.write')}
          />
          <FinanceScholarshipsPanel
            scholarships={scholarships}
            awards={awards}
            academicYears={academicYears}
            applicationForms={scholarshipForms}
            canWrite={hasPermission(session?.user?.permissions, 'finance.write')}
          />
          <h3 style={{ margin: '1.25rem 0 0.5rem', fontSize: '0.95rem', color: '#334155' }}>
            Applications
          </h3>
          <FinanceScholarshipApplicationsPanel
            applications={scholarshipApplications}
            academicYears={academicYears}
            canWrite={hasPermission(session?.user?.permissions, 'finance.write')}
          />
        </section>
      ) : null}
    </main>
  );
}
