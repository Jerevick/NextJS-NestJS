'use client';

import { useState, useTransition } from 'react';
import {
  createScholarshipAction,
  createScholarshipAwardAction,
  disburseScholarshipAwardAction,
} from '@/app/finance/actions';

type ScholarshipRow = {
  id: string;
  name: string;
  type: string;
  totalFund: number;
  disbursedAmount: number;
  applicationSchemaId?: string | null;
};
type FormOption = { id: string; label: string };
type AwardRow = {
  id: string;
  scholarshipName: string;
  studentNumber: string;
  amount: number;
  status: string;
};

export function FinanceScholarshipsPanel({
  scholarships,
  awards,
  academicYears,
  applicationForms,
  canWrite,
}: {
  scholarships: ScholarshipRow[];
  awards: AwardRow[];
  academicYears: Array<{ id: string; name: string }>;
  applicationForms: FormOption[];
  canWrite: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('MERIT');
  const [fund, setFund] = useState('10000');
  const [applicationSchemaId, setApplicationSchemaId] = useState(applicationForms[0]?.id ?? '');
  const [awardScholarshipId, setAwardScholarshipId] = useState(scholarships[0]?.id ?? '');
  const [studentId, setStudentId] = useState('');
  const [academicYearId, setAcademicYearId] = useState(academicYears[0]?.id ?? '');
  const [awardAmount, setAwardAmount] = useState('1000');

  if (!canWrite && scholarships.length <= 0 && awards.length <= 0) {
    return <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No scholarships in scope.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      {canWrite ? (
        <form
          style={{ display: 'grid', gap: 8, maxWidth: 420 }}
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            startTransition(async () => {
              const r = await createScholarshipAction({
                name: name.trim(),
                type,
                fundingSource: 'Institution',
                totalFund: Number(fund),
                applicationSchemaId: applicationSchemaId.trim() || undefined,
              });
              setMessage(r.error ?? 'Scholarship created.');
              if (r.ok) setName('');
            });
          }}
        >
          <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#334155' }}>New scholarship fund</h3>
          <input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
          >
            <option value="MERIT">Merit</option>
            <option value="NEED_BASED">Need-based</option>
            <option value="ATHLETIC">Athletic</option>
            <option value="SPONSORED">Sponsored</option>
            <option value="OTHER">Other</option>
          </select>
          <input
            type="number"
            min={0}
            placeholder="Total fund"
            value={fund}
            onChange={(e) => setFund(e.target.value)}
            style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
          {applicationForms.length > 0 ? (
            <select
              value={applicationSchemaId}
              onChange={(e) => setApplicationSchemaId(e.target.value)}
              style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
            >
              <option value="">No application form</option>
              {applicationForms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            style={{
              padding: '0.5rem',
              borderRadius: 8,
              border: 'none',
              background: '#1e3a5f',
              color: '#fff',
              fontWeight: 600,
            }}
          >
            Create scholarship
          </button>
        </form>
      ) : null}

      {canWrite && scholarships.length > 0 ? (
        <form
          style={{ display: 'grid', gap: 8, maxWidth: 420 }}
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            startTransition(async () => {
              const r = await createScholarshipAwardAction(awardScholarshipId, {
                studentId: studentId.trim(),
                academicYearId,
                amount: Number(awardAmount),
              });
              setMessage(r.error ?? 'Award created (pending disbursement).');
            });
          }}
        >
          <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#334155' }}>Award student</h3>
          <select
            value={awardScholarshipId}
            onChange={(e) => setAwardScholarshipId(e.target.value)}
            style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
          >
            {scholarships.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Student ID"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            required
            style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
          <select
            value={academicYearId}
            onChange={(e) => setAcademicYearId(e.target.value)}
            style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
          >
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0.01}
            value={awardAmount}
            onChange={(e) => setAwardAmount(e.target.value)}
            style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
          <button
            type="submit"
            disabled={pending}
            style={{
              padding: '0.5rem',
              borderRadius: 8,
              border: 'none',
              background: '#1e3a5f',
              color: '#fff',
              fontWeight: 600,
            }}
          >
            Create award
          </button>
        </form>
      ) : null}

      {awards.length > 0 ? (
        <div>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', color: '#334155' }}>
            Recent awards
          </h3>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '0.88rem' }}>
            {awards.map((a) => (
              <li
                key={a.id}
                style={{
                  padding: '0.5rem 0',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <span>
                  {a.scholarshipName} · #{a.studentNumber} · {a.amount.toFixed(2)} · {a.status}
                </span>
                {canWrite && a.status === 'PENDING' ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setMessage(null);
                      startTransition(async () => {
                        const r = await disburseScholarshipAwardAction(a.id);
                        setMessage(r.error ?? 'Disbursed to student ledger.');
                      });
                    }}
                    style={{
                      padding: '0.25rem 0.6rem',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    Disburse
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
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
