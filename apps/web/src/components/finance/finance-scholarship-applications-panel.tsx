'use client';

import { useState, useTransition } from 'react';
import { reviewScholarshipApplicationAction } from '@/app/finance/actions';

type ApplicationRow = {
  id: string;
  scholarshipId: string;
  scholarshipName: string;
  studentNumber: string;
  status: string;
  workflowInstanceId?: string | null;
  responses: unknown;
  createdAt: string;
};

export function FinanceScholarshipApplicationsPanel({
  applications,
  academicYears,
  canWrite,
}: {
  applications: ApplicationRow[];
  academicYears: Array<{ id: string; name: string }>;
  canWrite: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [approveId, setApproveId] = useState<string | null>(null);
  const [academicYearId, setAcademicYearId] = useState(academicYears[0]?.id ?? '');
  const [awardAmount, setAwardAmount] = useState('1000');
  const [reviewNotes, setReviewNotes] = useState('');

  if (applications.length === 0) {
    return (
      <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No scholarship applications in scope.</p>
    );
  }

  const reviewable = (status: string) =>
    status === 'SUBMITTED' || status === 'APPROVED' || status === 'UNDER_REVIEW';

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {applications.map((app) => (
        <article
          key={app.id}
          style={{
            padding: '0.75rem 1rem',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            background: '#f8fafc',
          }}
        >
          <div
            style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}
          >
            <div>
              <strong style={{ color: '#0f1729' }}>{app.scholarshipName}</strong>
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                #{app.studentNumber} · {app.status}
                {app.workflowInstanceId ? ' · workflow' : ''} ·{' '}
                {new Date(app.createdAt).toLocaleDateString()}
              </p>
            </div>
            {canWrite && reviewable(app.status) && app.status !== 'UNDER_REVIEW' ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setApproveId(app.id);
                    setMessage(null);
                  }}
                  style={{
                    padding: '0.3rem 0.65rem',
                    borderRadius: 6,
                    border: 'none',
                    background: '#15803d',
                    color: '#fff',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  Approve & award
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setMessage(null);
                    startTransition(async () => {
                      const r = await reviewScholarshipApplicationAction(app.id, {
                        status: 'REJECTED',
                      });
                      setMessage(r.error ?? 'Application rejected.');
                    });
                  }}
                  style={{
                    padding: '0.3rem 0.65rem',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  Reject
                </button>
              </div>
            ) : app.status === 'UNDER_REVIEW' ? (
              <span style={{ fontSize: '0.78rem', color: '#b45309' }}>Pending BURSAR workflow</span>
            ) : null}
          </div>
          {app.responses && typeof app.responses === 'object' ? (
            <pre
              style={{
                margin: '0.5rem 0 0',
                fontSize: '0.75rem',
                color: '#475569',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {JSON.stringify(app.responses, null, 2)}
            </pre>
          ) : null}
        </article>
      ))}

      {approveId ? (
        <div
          style={{
            padding: '1rem',
            border: '1px solid #cbd5e1',
            borderRadius: 10,
            background: '#fff',
          }}
        >
          <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>
            Approve application & create award
          </h4>
          <div style={{ display: 'grid', gap: 8, maxWidth: 360 }}>
            <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
              Academic year
              <select
                value={academicYearId}
                onChange={(e) => setAcademicYearId(e.target.value)}
                style={{ padding: '0.4rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
              >
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
              Award amount
              <input
                type="number"
                min={0.01}
                value={awardAmount}
                onChange={(e) => setAwardAmount(e.target.value)}
                style={{ padding: '0.4rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
              Notes
              <input
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                style={{ padding: '0.4rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                disabled={pending || !academicYearId}
                onClick={() => {
                  const amount = Number(awardAmount);
                  if (!Number.isFinite(amount) || amount <= 0) {
                    setMessage('Enter a valid award amount.');
                    return;
                  }
                  startTransition(async () => {
                    const r = await reviewScholarshipApplicationAction(approveId, {
                      status: 'APPROVED',
                      academicYearId,
                      awardAmount: amount,
                      reviewNotes: reviewNotes.trim() || undefined,
                    });
                    setMessage(r.error ?? 'Approved and award created.');
                    if (!r.error) setApproveId(null);
                  });
                }}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: 8,
                  border: 'none',
                  background: '#15803d',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setApproveId(null)}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {message ? (
        <p
          style={{
            margin: 0,
            fontSize: '0.85rem',
            color: message.includes('failed') ? '#b91c1c' : '#15803d',
          }}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
