'use client';

type Profile = {
  id: string;
  staffNumber: string;
  name: string;
  email: string;
  position: { title: string };
  orgUnit: { name: string };
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
  orgChartTree,
  canWrite,
}: {
  profiles: Profile[];
  leaveTypes: Array<{ id: string; name: string; code: string; annualAllocation: number }>;
  leaveRequests: LeaveRequest[];
  appraisals: Array<{ id: string; status: string; type: string; staff: { staffNumber: string } }>;
  workload: Array<{
    id: string;
    totalCreditHours: number;
    maxCreditHours: number;
    utilizationPct: number;
    overCapacity: boolean;
    staff: { staffNumber: string };
  }>;
  semesters: Array<{ id: string; name: string }>;
  orgChartTree: unknown[];
  canWrite: boolean;
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
      <section style={sectionStyle}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', color: '#0f1729' }}>
          Staff registry
        </h2>
        {profiles.length === 0 ? (
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
            No staff profiles yet.
            {canWrite ? ' Create profiles via the API (POST /staff/profiles).' : ''}
          </p>
        ) : (
          <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr
                style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}
              >
                <th style={{ padding: '0.4rem' }}>#</th>
                <th style={{ padding: '0.4rem' }}>Name</th>
                <th style={{ padding: '0.4rem' }}>Unit</th>
                <th style={{ padding: '0.4rem' }}>Position</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.4rem', fontFamily: 'monospace' }}>{p.staffNumber}</td>
                  <td style={{ padding: '0.4rem' }}>{p.name}</td>
                  <td style={{ padding: '0.4rem' }}>{p.orgUnit.name}</td>
                  <td style={{ padding: '0.4rem' }}>{p.position.title}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', color: '#0f1729' }}>
          Workload heatmap
        </h2>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: '#64748b' }}>
          Semester: {semesters[0]?.name ?? '—'}
        </p>
        {workload.length === 0 ? (
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>No workload records.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {workload.map((w) => (
              <div
                key={w.id}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  background: w.overCapacity
                    ? '#fef2f2'
                    : w.utilizationPct >= 85
                      ? '#fffbeb'
                      : '#f8fafc',
                  minWidth: 140,
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{w.staff.staffNumber}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {w.totalCreditHours}/{w.maxCreditHours} cr · {w.utilizationPct}%
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', color: '#0f1729' }}>Leave</h2>
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: '#64748b' }}>
          Types:{' '}
          {leaveTypes.map((t) => `${t.name} (${t.annualAllocation}d)`).join(', ') ||
            'none configured'}
        </p>
        {leaveRequests.length === 0 ? (
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>No leave requests.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem', color: '#334155' }}>
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
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', color: '#0f1729' }}>Appraisals</h2>
        {appraisals.length === 0 ? (
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>No appraisal cycles.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem', color: '#334155' }}>
            {appraisals.map((a) => (
              <li key={a.id}>
                {a.staff.staffNumber} · {a.type} · {a.status}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', color: '#0f1729' }}>Org chart</h2>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: '#64748b' }}>
          Derived from org units, positions, and staff profiles.
        </p>
        {orgChartTree.length === 0 ? (
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
            No org units for this entity.
          </p>
        ) : (
          <pre
            style={{
              margin: 0,
              padding: '0.75rem',
              background: '#f8fafc',
              borderRadius: 8,
              fontSize: '0.72rem',
              overflow: 'auto',
              maxHeight: 280,
            }}
          >
            {JSON.stringify(orgChartTree, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
