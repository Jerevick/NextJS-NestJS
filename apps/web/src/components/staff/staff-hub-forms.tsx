'use client';

import type { ReactNode } from 'react';
import { useEffect, useState, useTransition } from 'react';
import {
  addPeerFeedbackAction,
  allocateLeaveBalanceAction,
  carryForwardLeaveAction,
  createAppraisalAction,
  createAppraisalCycleAction,
  createLeaveRequestAction,
  uploadLeaveSupportingDocumentAction,
  createLeaveTypeAction,
  createStaffProfileAction,
  deleteStaffProfileAction,
  submitAppraisalAction,
  applyWorkloadSuggestionsAction,
  fetchKpiTemplateAction,
  suggestWorkloadAction,
  updateAppraisalReviewerAction,
  updateStaffProfileAction,
  upsertWorkloadAction,
} from '@/app/staff/actions';
import { StaffUserPicker } from '@/components/staff/staff-user-picker';

type Profile = {
  id: string;
  staffNumber: string;
  name: string;
  salary?: { amount: number; currency: string } | null;
};

export function StaffHubForms({
  profiles,
  leaveTypes,
  semesters,
  academicYears,
  orgUnits,
  positions,
  appraisals,
  canWrite,
  icsExportUrl,
}: {
  profiles: Profile[];
  leaveTypes: Array<{ id: string; name: string }>;
  semesters: Array<{ id: string; name: string }>;
  academicYears: Array<{ id: string; name: string }>;
  orgUnits: Array<{ id: string; name: string }>;
  positions: Array<{ id: string; title: string; orgUnitId: string }>;
  appraisals: Array<{
    id: string;
    status: string;
    type: string;
    staff: { staffNumber: string; positionId?: string };
    roleExpectations?: { duties: string[]; responsibilities: string[] } | null;
    workflowInstance?: {
      id: string;
      currentStepName: string | null;
    } | null;
  }>;
  canWrite: boolean;
  icsExportUrl?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<
    Array<{ staffId: string; suggestedCreditHours: number; note: string }>
  >([]);
  const [suggestSemesterId, setSuggestSemesterId] = useState('');
  const [reviewAppraisalId, setReviewAppraisalId] = useState('');
  const [kpiTemplate, setKpiTemplate] = useState<
    Array<{ key: string; label: string; weight?: number }>
  >([]);
  const [kpiScores, setKpiScores] = useState<Record<string, string>>({});
  const [roleDuties, setRoleDuties] = useState<string[]>([]);
  const [roleResponsibilities, setRoleResponsibilities] = useState<string[]>([]);

  const reviewAppraisal = appraisals.find((a) => a.id === reviewAppraisalId);
  const reviewPositionId = reviewAppraisal?.staff.positionId;

  useEffect(() => {
    if (!reviewAppraisalId) {
      setKpiTemplate([]);
      setKpiScores({});
      setRoleDuties([]);
      setRoleResponsibilities([]);
      return;
    }
    const fromRow = reviewAppraisal?.roleExpectations;
    if (fromRow) {
      setRoleDuties(fromRow.duties ?? []);
      setRoleResponsibilities(fromRow.responsibilities ?? []);
    }
    if (!reviewPositionId) return;
    let cancelled = false;
    void fetchKpiTemplateAction(reviewPositionId).then((r) => {
      if (cancelled) return;
      if (r.error) {
        setKpiTemplate([]);
        return;
      }
      const template = r.template ?? [];
      setKpiTemplate(template);
      if (!fromRow) {
        setRoleDuties(r.duties ?? []);
        setRoleResponsibilities(r.responsibilities ?? []);
      }
      setKpiScores((prev) => {
        const next: Record<string, string> = {};
        for (const item of template) {
          next[item.key] = prev[item.key] ?? '';
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [reviewAppraisalId, reviewPositionId, reviewAppraisal?.roleExpectations]);

  if (!canWrite) return null;

  return (
    <section style={sectionStyle}>
      <h2 style={{ margin: '0 0 1rem', fontSize: '1.05rem', color: '#0f1729' }}>HR actions</h2>
      {icsExportUrl ? (
        <p style={{ margin: '0 0 1rem', fontSize: '0.82rem' }}>
          <a href={icsExportUrl} style={{ color: '#2563eb' }}>
            Download leave calendar (.ics)
          </a>
          {' · '}
          Subscribe in Google Calendar or Outlook after leave is approved.
        </p>
      ) : null}
      <div
        style={{
          display: 'grid',
          gap: '1.25rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        }}
      >
        <FormCard title="New staff profile">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setMessage(null);
              startTransition(async () => {
                const quals = String(fd.get('qualifications') || '')
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((title) => ({ title }));
                const pubs = String(fd.get('publications') || '')
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((title) => ({ title }));
                const r = await createStaffProfileAction({
                  userId: String(fd.get('userId')),
                  staffNumber: String(fd.get('staffNumber')),
                  orgUnitId: String(fd.get('orgUnitId')),
                  positionId: String(fd.get('positionId')),
                  salaryAmount: Number(fd.get('salaryAmount')) || undefined,
                  salaryCurrency: String(fd.get('salaryCurrency') || 'USD'),
                  qualifications: quals.length ? quals : undefined,
                  publications: pubs.length ? pubs : undefined,
                });
                setMessage(r.error ?? 'Staff profile created.');
              });
            }}
            style={formGrid}
          >
            <StaffUserPicker name="userId" required />
            <input name="staffNumber" placeholder="Staff #" required style={inputStyle} />
            <select name="orgUnitId" required style={inputStyle}>
              <option value="">Org unit</option>
              {orgUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <select name="positionId" required style={inputStyle}>
              <option value="">Position</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <input
              name="salaryAmount"
              type="number"
              placeholder="Salary (optional)"
              style={inputStyle}
            />
            <input
              name="salaryCurrency"
              placeholder="Currency"
              defaultValue="USD"
              style={inputStyle}
            />
            <input
              name="qualifications"
              placeholder="Qualifications (comma-separated)"
              style={inputStyle}
            />
            <input
              name="publications"
              placeholder="Publications (comma-separated titles)"
              style={inputStyle}
            />
            <button type="submit" disabled={pending} style={btnStyle}>
              Create profile
            </button>
          </form>
        </FormCard>

        <FormCard title="Update / remove profile">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setMessage(null);
              startTransition(async () => {
                const r = await updateStaffProfileAction(String(fd.get('profileId')), {
                  orgUnitId: String(fd.get('orgUnitId') || '') || undefined,
                  positionId: String(fd.get('positionId') || '') || undefined,
                  officeLocation: String(fd.get('officeLocation') || ''),
                  salaryAmount: Number(fd.get('salaryAmount')) || undefined,
                  salaryCurrency: String(fd.get('salaryCurrency') || 'USD'),
                });
                setMessage(r.error ?? 'Profile updated.');
              });
            }}
            style={formGrid}
          >
            <select name="profileId" required style={inputStyle}>
              <option value="">Profile</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.staffNumber} — {p.name}
                </option>
              ))}
            </select>
            <select name="orgUnitId" style={inputStyle}>
              <option value="">Org unit (optional)</option>
              {orgUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <select name="positionId" style={inputStyle}>
              <option value="">Position (optional)</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <input name="officeLocation" placeholder="Office" style={inputStyle} />
            <input name="salaryAmount" type="number" placeholder="Salary" style={inputStyle} />
            <input
              name="salaryCurrency"
              placeholder="Currency"
              defaultValue="USD"
              style={inputStyle}
            />
            <button type="submit" disabled={pending} style={btnStyle}>
              Update
            </button>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              if (!confirm('Soft-delete this staff profile?')) return;
              startTransition(async () => {
                const r = await deleteStaffProfileAction(String(fd.get('profileId')));
                setMessage(r.error ?? 'Profile removed.');
              });
            }}
            style={{ ...formGrid, marginTop: 8 }}
          >
            <select name="profileId" required style={inputStyle}>
              <option value="">Profile to remove</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.staffNumber}
                </option>
              ))}
            </select>
            <button type="submit" disabled={pending} style={{ ...btnStyle, background: '#b91c1c' }}>
              Delete profile
            </button>
          </form>
        </FormCard>

        <FormCard title="Leave type">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const r = await createLeaveTypeAction({
                  name: String(fd.get('name')),
                  code: String(fd.get('code')),
                  annualAllocation: Number(fd.get('annualAllocation')) || 0,
                });
                setMessage(r.error ?? 'Leave type saved.');
              });
            }}
            style={formGrid}
          >
            <input name="name" placeholder="Annual leave" required style={inputStyle} />
            <input name="code" placeholder="ANNUAL" required style={inputStyle} />
            <input name="annualAllocation" type="number" placeholder="Days" style={inputStyle} />
            <button type="submit" disabled={pending} style={btnStyle}>
              Add leave type
            </button>
          </form>
        </FormCard>

        <FormCard title="Leave balance">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const r = await allocateLeaveBalanceAction({
                  staffId: String(fd.get('staffId')),
                  leaveTypeId: String(fd.get('leaveTypeId')),
                  academicYearId: String(fd.get('academicYearId')),
                  allocated: Number(fd.get('allocated')) || 0,
                  carriedOver: Number(fd.get('carriedOver')) || 0,
                });
                setMessage(r.error ?? 'Balance allocated.');
              });
            }}
            style={formGrid}
          >
            <StaffSelect profiles={profiles} />
            <LeaveTypeSelect leaveTypes={leaveTypes} />
            <YearSelect academicYears={academicYears} />
            <input
              name="allocated"
              type="number"
              placeholder="Allocated days"
              required
              style={inputStyle}
            />
            <input name="carriedOver" type="number" placeholder="Carried over" style={inputStyle} />
            <button type="submit" disabled={pending} style={btnStyle}>
              Allocate
            </button>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const r = await carryForwardLeaveAction({
                  fromAcademicYearId: String(fd.get('fromYearId')),
                  toAcademicYearId: String(fd.get('toYearId')),
                });
                setMessage(
                  r.error ?? `Carried forward for ${r.carriedForward ?? 0} balance row(s).`,
                );
              });
            }}
            style={{ ...formGrid, marginTop: 8 }}
          >
            <select name="fromYearId" required style={inputStyle}>
              <option value="">From year</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
            <select name="toYearId" required style={inputStyle}>
              <option value="">To year</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
            <button type="submit" disabled={pending} style={btnStyle}>
              Carry forward
            </button>
          </form>
        </FormCard>

        <FormCard title="Leave request">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const staffId = String(fd.get('staffId'));
                let supportingDocKey: string | undefined;
                const file = fd.get('supportingFile');
                if (file instanceof File && file.size > 0) {
                  const uploadFd = new FormData();
                  uploadFd.append('file', file);
                  const up = await uploadLeaveSupportingDocumentAction(staffId, uploadFd);
                  if (up.error) {
                    setMessage(up.error);
                    return;
                  }
                  supportingDocKey = up.supportingDocKey;
                }
                const r = await createLeaveRequestAction({
                  staffId,
                  leaveTypeId: String(fd.get('leaveTypeId')),
                  academicYearId: String(fd.get('academicYearId')),
                  startDate: String(fd.get('startDate')),
                  endDate: String(fd.get('endDate')),
                  reason: String(fd.get('reason')),
                  coveringStaffId: String(fd.get('coveringStaffId') || '') || undefined,
                  supportingDocKey,
                });
                setMessage(r.error ?? 'Leave request submitted.');
              });
            }}
            style={formGrid}
          >
            <StaffSelect profiles={profiles} />
            <LeaveTypeSelect leaveTypes={leaveTypes} />
            <YearSelect academicYears={academicYears} />
            <input name="startDate" type="date" required style={inputStyle} />
            <input name="endDate" type="date" required style={inputStyle} />
            <input name="reason" placeholder="Reason" required style={inputStyle} />
            <select name="coveringStaffId" style={inputStyle}>
              <option value="">Covering staff (optional)</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.staffNumber} — {p.name}
                </option>
              ))}
            </select>
            <label style={{ fontSize: '0.82rem', color: '#64748b', gridColumn: '1 / -1' }}>
              Supporting document (PDF or image, max 5 MB)
              <input
                name="supportingFile"
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                style={{ ...inputStyle, marginTop: 4 }}
              />
            </label>
            <button type="submit" disabled={pending} style={btnStyle}>
              Submit leave
            </button>
          </form>
        </FormCard>

        <FormCard title="Workload">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                let assignedSections: unknown[] | undefined;
                const rawSections = String(fd.get('assignedSections') || '').trim();
                if (rawSections) {
                  try {
                    assignedSections = JSON.parse(rawSections) as unknown[];
                  } catch {
                    setMessage('Assigned sections must be valid JSON array.');
                    return;
                  }
                }
                const r = await upsertWorkloadAction({
                  staffId: String(fd.get('staffId')),
                  semesterId: String(fd.get('semesterId')),
                  totalCreditHours: Number(fd.get('totalCreditHours')) || 0,
                  researchHours: Number(fd.get('researchHours')) || 0,
                  adminHours: Number(fd.get('adminHours')) || 0,
                  assignedSections,
                });
                setMessage(r.error ?? r.warning ?? 'Workload saved.');
              });
            }}
            style={formGrid}
          >
            <StaffSelect profiles={profiles} />
            <select name="semesterId" required style={inputStyle}>
              <option value="">Semester</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              name="totalCreditHours"
              type="number"
              placeholder="Teaching credit hours"
              style={inputStyle}
            />
            <input
              name="researchHours"
              type="number"
              placeholder="Research hours"
              style={inputStyle}
            />
            <input name="adminHours" type="number" placeholder="Admin hours" style={inputStyle} />
            <textarea
              name="assignedSections"
              placeholder='Assigned sections JSON e.g. [{"sectionId":"…","creditHours":3,"role":"lecturer"}]'
              rows={2}
              style={{ ...inputStyle, resize: 'vertical', gridColumn: '1 / -1' }}
            />
            <button type="submit" disabled={pending} style={btnStyle}>
              Save workload
            </button>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const r = await suggestWorkloadAction(
                  String(fd.get('semesterId')),
                  Number(fd.get('totalHours')) || 0,
                );
                if (r.error) setMessage(r.error);
                else {
                  const sem = String(fd.get('semesterId'));
                  setSuggestSemesterId(sem);
                  setSuggestions(r.suggestions ?? []);
                  setMessage('Workload suggestions generated.');
                }
              });
            }}
            style={{ ...formGrid, marginTop: 8 }}
          >
            <select name="semesterId" required style={inputStyle}>
              <option value="">Semester</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              name="totalHours"
              type="number"
              placeholder="Hours to distribute"
              style={inputStyle}
            />
            <button type="submit" disabled={pending} style={btnStyle}>
              AI suggest
            </button>
          </form>
          {suggestions.length > 0 ? (
            <ul style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#334155' }}>
              {suggestions.map((s) => (
                <li key={s.staffId}>
                  {s.note} → {s.suggestedCreditHours}h total
                </li>
              ))}
            </ul>
          ) : null}
          {suggestions.length > 0 && suggestSemesterId ? (
            <button
              type="button"
              disabled={pending}
              style={{ ...btnStyle, marginTop: 8 }}
              onClick={() => {
                startTransition(async () => {
                  const r = await applyWorkloadSuggestionsAction({
                    semesterId: suggestSemesterId,
                    suggestions: suggestions.map((s) => ({
                      staffId: s.staffId,
                      suggestedCreditHours: s.suggestedCreditHours,
                    })),
                  });
                  const skipped = r.skipped?.length
                    ? ` (${r.skipped.length} skipped — over max credit hours)`
                    : '';
                  setMessage(r.error ?? `Applied ${r.applied ?? 0} workload row(s).${skipped}`);
                });
              }}
            >
              Apply suggestions
            </button>
          ) : null}
        </FormCard>

        <FormCard title="Appraisal">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const r = await createAppraisalAction({
                  staffId: String(fd.get('staffId')),
                  periodStart: String(fd.get('periodStart')),
                  periodEnd: String(fd.get('periodEnd')),
                  type: String(fd.get('type') || 'ANNUAL'),
                  reviewerId: String(fd.get('reviewerId') || '') || undefined,
                });
                setMessage(r.error ?? `Appraisal created (${r.id ?? ''}).`);
              });
            }}
            style={formGrid}
          >
            <StaffSelect profiles={profiles} />
            <input name="periodStart" type="date" required style={inputStyle} />
            <input name="periodEnd" type="date" required style={inputStyle} />
            <select name="type" style={inputStyle}>
              <option value="ANNUAL">Annual</option>
              <option value="MID_YEAR">Mid-year</option>
              <option value="PROBATION">Probation</option>
              <option value="THREE_SIXTY">360°</option>
            </select>
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Reviewer (optional — defaults to immediate head / line manager)
              </span>
              <StaffUserPicker name="reviewerId" />
            </div>
            <button type="submit" disabled={pending} style={btnStyle}>
              Open appraisal
            </button>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const r = await createAppraisalCycleAction({
                  periodStart: String(fd.get('periodStart')),
                  periodEnd: String(fd.get('periodEnd')),
                  type: String(fd.get('type') || 'ANNUAL'),
                });
                setMessage(r.error ?? `Opened ${r.created ?? 0} appraisal(s).`);
              });
            }}
            style={{ ...formGrid, marginTop: 8 }}
          >
            <input name="periodStart" type="date" required style={inputStyle} />
            <input name="periodEnd" type="date" required style={inputStyle} />
            <select name="type" style={inputStyle}>
              <option value="ANNUAL">Annual (all staff)</option>
              <option value="THREE_SIXTY">360° (all staff)</option>
            </select>
            <button type="submit" disabled={pending} style={btnStyle}>
              Batch cycle
            </button>
          </form>
        </FormCard>

        <FormCard title="Immediate head assessment">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const scores: Record<string, number> = {};
              for (const item of kpiTemplate) {
                const raw = kpiScores[item.key];
                if (raw === '' || raw === undefined) continue;
                const n = Number(raw);
                if (!Number.isNaN(n)) scores[item.key] = n;
              }
              startTransition(async () => {
                const r = await updateAppraisalReviewerAction(String(fd.get('appraisalId')), {
                  reviewerComments: String(fd.get('reviewerComments') || ''),
                  overallRating: Number(fd.get('overallRating')) || undefined,
                  kpiScores: Object.keys(scores).length ? scores : undefined,
                });
                setMessage(r.error ?? 'Reviewer assessment saved.');
              });
            }}
            style={formGrid}
          >
            <select
              name="appraisalId"
              required
              style={inputStyle}
              value={reviewAppraisalId}
              onChange={(e) => setReviewAppraisalId(e.target.value)}
            >
              <option value="">Appraisal in review</option>
              {appraisals
                .filter((a) => a.status === 'PENDING_REVIEW' || a.status === 'PENDING_ENDORSEMENT')
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.staff.staffNumber} · {a.type}
                  </option>
                ))}
            </select>
            {roleDuties.length > 0 || roleResponsibilities.length > 0 ? (
              <div
                style={{
                  gridColumn: '1 / -1',
                  padding: '0.65rem 0.75rem',
                  background: '#f8fafc',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  fontSize: '0.85rem',
                }}
              >
                <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: '#334155' }}>
                  Assigned duties & responsibilities
                </p>
                {roleDuties.length > 0 ? (
                  <div style={{ marginBottom: roleResponsibilities.length ? '0.5rem' : 0 }}>
                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Duties</span>
                    <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.1rem' }}>
                      {roleDuties.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {roleResponsibilities.length > 0 ? (
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Responsibilities</span>
                    <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.1rem' }}>
                      {roleResponsibilities.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
            {kpiTemplate.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gap: 8,
                  gridColumn: '1 / -1',
                  padding: '0.5rem 0',
                }}
              >
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  KPI scores against role expectations (0–5)
                </span>
                {kpiTemplate.map((item) => (
                  <label
                    key={item.key}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      fontSize: '0.85rem',
                    }}
                  >
                    {item.label}
                    {item.weight != null ? (
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        Weight {(item.weight * 100).toFixed(0)}%
                      </span>
                    ) : null}
                    <input
                      type="number"
                      min={0}
                      max={5}
                      step={0.1}
                      value={kpiScores[item.key] ?? ''}
                      onChange={(ev) =>
                        setKpiScores((prev) => ({ ...prev, [item.key]: ev.target.value }))
                      }
                      style={inputStyle}
                    />
                  </label>
                ))}
              </div>
            ) : reviewAppraisalId ? (
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                No KPI template for this position — use overall rating below.
              </p>
            ) : null}
            <textarea
              name="reviewerComments"
              placeholder="Reviewer comments"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
            <input
              name="overallRating"
              type="number"
              min={0}
              max={5}
              step={0.1}
              placeholder="Overall rating 0–5"
              style={inputStyle}
            />
            <button type="submit" disabled={pending} style={btnStyle}>
              Save reviewer scores
            </button>
          </form>
        </FormCard>

        <FormCard title="Self-assessment / 360°">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const id = String(fd.get('appraisalId'));
                const peerUserId = String(fd.get('peerUserId') || '');
                if (peerUserId) {
                  const pr = await addPeerFeedbackAction(id, {
                    peerUserId,
                    rating: Number(fd.get('peerRating')) || undefined,
                    comment: String(fd.get('peerComment') || ''),
                  });
                  if (pr.error) {
                    setMessage(pr.error);
                    return;
                  }
                }
                const r = await submitAppraisalAction(id, {
                  selfAssessment: String(fd.get('selfAssessment') || ''),
                });
                setMessage(r.error ?? 'Appraisal submitted for review.');
              });
            }}
            style={formGrid}
          >
            <select name="appraisalId" required style={inputStyle}>
              <option value="">Appraisal</option>
              {appraisals
                .filter((a) => a.status === 'DRAFT' || a.status === 'SELF_REVIEW')
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.staff.staffNumber} · {a.type} · {a.status}
                  </option>
                ))}
            </select>
            <textarea
              name="selfAssessment"
              placeholder="Self-assessment"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
            <StaffUserPicker name="peerUserId" />
            <input
              name="peerRating"
              type="number"
              min={1}
              max={5}
              placeholder="Peer rating 1–5"
              style={inputStyle}
            />
            <input name="peerComment" placeholder="Peer comment" style={inputStyle} />
            <button type="submit" disabled={pending} style={btnStyle}>
              Save peer feedback & submit
            </button>
          </form>
        </FormCard>
      </div>
      {message ? (
        <p style={{ margin: '1rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>{message}</p>
      ) : null}
    </section>
  );
}

function FormCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <h3 style={{ margin: 0, fontSize: '0.9rem' }}>{title}</h3>
      {children}
    </div>
  );
}

function StaffSelect({ profiles }: { profiles: Profile[] }) {
  return (
    <select name="staffId" required style={inputStyle}>
      <option value="">Staff</option>
      {profiles.map((p) => (
        <option key={p.id} value={p.id}>
          {p.staffNumber} — {p.name}
        </option>
      ))}
    </select>
  );
}

function LeaveTypeSelect({ leaveTypes }: { leaveTypes: Array<{ id: string; name: string }> }) {
  return (
    <select name="leaveTypeId" required style={inputStyle}>
      <option value="">Leave type</option>
      {leaveTypes.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}

function YearSelect({ academicYears }: { academicYears: Array<{ id: string; name: string }> }) {
  return (
    <select name="academicYearId" required style={inputStyle}>
      <option value="">Academic year</option>
      {academicYears.map((y) => (
        <option key={y.id} value={y.id}>
          {y.name}
        </option>
      ))}
    </select>
  );
}

const sectionStyle = {
  marginTop: '1.25rem',
  padding: '1.25rem 1.5rem',
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
} as const;

const formGrid = { display: 'grid', gap: 6 } as const;

const inputStyle = {
  padding: '0.45rem 0.6rem',
  borderRadius: 8,
  border: '1px solid #e2e8f0',
  fontSize: '0.85rem',
} as const;

const btnStyle = {
  padding: '0.45rem 0.75rem',
  borderRadius: 8,
  border: 'none',
  background: '#1e3a5f',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.85rem',
  cursor: 'pointer',
} as const;
