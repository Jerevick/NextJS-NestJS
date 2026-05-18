'use client';

import { StaffHubForms } from '@/components/staff/staff-hub-forms';
import { StaffAppraisalTracker } from '@/components/staff/staff-appraisal-tracker';
import {
  StaffLeaveCalendar,
  type LeaveCalendarEvent,
} from '@/components/staff/staff-leave-calendar';
import { StaffMyProfile } from '@/components/staff/staff-my-profile';
import { StaffRegistryTable } from '@/components/staff/staff-registry-table';
import { StaffWorkloadHeatmap } from '@/components/staff/staff-workload-heatmap';
import Link from 'next/link';
import { StaffCalendarConnectPanel } from '@/components/staff/staff-calendar-connect-panel';
import { StaffEntityAccessPanel } from '@/components/staff/staff-entity-access-panel';
import { StaffOrgChart } from '@/components/staff/staff-org-chart';
import { StaffOrgChartFlow } from '@/components/staff/staff-org-chart-flow';

type Profile = {
  id: string;
  staffNumber: string;
  name: string;
  email: string;
  photoUrl?: string | null;
  entity?: { id: string; code: string; name: string };
  position: { title: string };
  orgUnit: { name: string };
  salary?: { amount: number; currency: string } | null;
};

type LeaveRequest = {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  staff: { staffNumber: string };
  leaveType: { name: string };
};

export function StaffHubPanels({
  profiles,
  leaveTypes,
  leaveRequests,
  appraisals,
  workload,
  semesters,
  academicYears,
  orgChartTree,
  calendarEvents,
  orgUnits,
  positions,
  myProfile,
  entityAccess,
  leaveBalances,
  icsExportUrl,
  campusEntities,
  calendarOAuth,
  canWrite,
  directoryScope = 'entity',
}: {
  profiles: Profile[];
  leaveTypes: Array<{ id: string; name: string; code: string; annualAllocation: number }>;
  leaveRequests: LeaveRequest[];
  appraisals: Array<{
    id: string;
    status: string;
    type: string;
    staff: { staffNumber: string; positionId?: string };
    workflowInstance?: {
      id: string;
      currentStep: number;
      currentStepName: string | null;
      status: string;
    } | null;
  }>;
  workload: Array<{
    id: string;
    totalCreditHours: number;
    maxCreditHours: number;
    utilizationPct: number;
    overCapacity: boolean;
    staff: { staffNumber: string };
  }>;
  semesters: Array<{ id: string; name: string }>;
  academicYears: Array<{ id: string; name: string }>;
  orgChartTree: unknown[];
  calendarEvents: LeaveCalendarEvent[];
  orgUnits: Array<{ id: string; name: string }>;
  positions: Array<{ id: string; title: string; orgUnitId: string }>;
  myProfile: Profile | null;
  entityAccess: {
    homeEntityId: string;
    teachingEntities: Array<{ id: string; code: string; name: string }>;
  } | null;
  leaveBalances: Array<{
    id: string;
    allocated: number;
    used: number;
    pending: number;
    carriedOver: number;
    staff: { staffNumber: string };
    leaveType: { name: string };
    academicYear: { name: string };
  }>;
  icsExportUrl: string;
  campusEntities: Array<{ id: string; name: string; code: string }>;
  calendarOAuth: { google: boolean; microsoft: boolean };
  canWrite: boolean;
  directoryScope?: 'entity' | 'institution';
}) {
  const sectionStyle = {
    marginTop: '1.25rem',
    padding: '1.25rem 1.5rem',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
  } as const;

  return (
    <div>
      <StaffMyProfile profile={myProfile} entityAccess={entityAccess} />

      <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
        <Link href="/staff/inbox" style={{ color: '#2563eb', fontWeight: 600 }}>
          HR workflow inbox →
        </Link>
      </p>

      <StaffCalendarConnectPanel
        googleEnabled={calendarOAuth.google}
        microsoftEnabled={calendarOAuth.microsoft}
      />

      <StaffEntityAccessPanel profiles={profiles} entities={campusEntities} canWrite={canWrite} />

      <section style={sectionStyle}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', color: '#0f1729' }}>
          Staff registry
          {directoryScope === 'institution' ? ' (institution-wide)' : ''}
        </h2>
        {profiles.length === 0 ? (
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
            No staff profiles yet.
            {canWrite ? ' Use HR actions below to register staff.' : ''}
          </p>
        ) : (
          <StaffRegistryTable profiles={profiles} directoryScope={directoryScope} />
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', color: '#0f1729' }}>
          Workload heatmap
        </h2>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: '#64748b' }}>
          Credit-hour utilization by lecturer — warmer colors indicate staff near or over capacity.
        </p>
        <StaffWorkloadHeatmap
          initialRows={workload}
          semesters={semesters}
          initialSemesterId={semesters[0]?.id}
        />
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', color: '#0f1729' }}>
          Leave calendar
        </h2>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: '#64748b' }}>
          Approved leave blocks. Types:{' '}
          {leaveTypes.map((t) => `${t.name} (${t.annualAllocation}d)`).join(', ') ||
            'none configured'}
          .
        </p>
        <StaffLeaveCalendar events={calendarEvents} icsExportUrl={icsExportUrl} />
        {leaveRequests.length === 0 ? (
          <p style={{ margin: '1rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>
            No leave requests.
          </p>
        ) : (
          <ul
            style={{
              margin: '1rem 0 0',
              paddingLeft: '1.1rem',
              fontSize: '0.85rem',
              color: '#334155',
            }}
          >
            {leaveRequests.slice(0, 12).map((r) => (
              <li key={r.id} style={{ marginBottom: 4 }}>
                {r.staff.staffNumber} · {r.leaveType.name} · {r.durationDays}d ·{' '}
                <span style={{ color: '#64748b' }}>{r.status}</span> ·{' '}
                {new Date(r.startDate).toLocaleDateString()} –{' '}
                {new Date(r.endDate).toLocaleDateString()}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', color: '#0f1729' }}>
          Appraisal status tracker
        </h2>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: '#64748b' }}>
          Self-assessment → immediate head review → HoD → Dean endorsement.
        </p>
        <StaffAppraisalTracker appraisals={appraisals} />
      </section>

      <StaffHubForms
        profiles={profiles}
        leaveTypes={leaveTypes}
        semesters={semesters}
        academicYears={academicYears}
        orgUnits={orgUnits}
        positions={positions}
        appraisals={appraisals}
        canWrite={canWrite}
        icsExportUrl={icsExportUrl}
      />

      {leaveBalances.length > 0 ? (
        <section style={sectionStyle}>
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', color: '#0f1729' }}>
            Leave balances
          </h2>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem', color: '#334155' }}>
            {leaveBalances.slice(0, 20).map((b) => (
              <li key={b.id} style={{ marginBottom: 4 }}>
                {b.staff.staffNumber} · {b.leaveType.name} · {b.academicYear.name}:{' '}
                {b.used + b.pending}/{b.allocated + b.carriedOver}d used
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section style={sectionStyle}>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', color: '#0f1729' }}>Org chart</h2>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: '#64748b' }}>
          Derived from org units, positions, and staff profiles.
        </p>
        <StaffOrgChartFlow tree={orgChartTree as Parameters<typeof StaffOrgChartFlow>[0]['tree']} />
        <details style={{ marginTop: '0.75rem' }}>
          <summary style={{ cursor: 'pointer', fontSize: '0.82rem', color: '#64748b' }}>
            List view
          </summary>
          <StaffOrgChart tree={orgChartTree as Parameters<typeof StaffOrgChart>[0]['tree']} />
        </details>
      </section>
    </div>
  );
}
