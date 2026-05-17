import { NextResponse } from 'next/server';
import { auth } from '@/auth';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const ENROLLMENT_STATUSES = new Set([
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'GRADUATED',
  'WITHDRAWN',
  'DEFERRED',
]);

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

type StudentRow = {
  id: string;
  studentNumber: string;
  email: string;
  enrollmentStatus: string;
  currentLevel: number;
  program: { id: string; name: string; code: string };
  profile?: unknown;
  academicMetrics?: {
    cumulativeGpa: number | null;
    creditHoursCompleted?: number;
    academicStanding: string;
  } | null;
};

type ListResponse = {
  data: StudentRow[];
  nextCursor?: string;
};

function profileName(profile: unknown): { first: string; last: string } {
  if (!profile || typeof profile !== 'object') {
    return { first: '', last: '' };
  }
  const p = profile as { firstName?: unknown; lastName?: unknown };
  const first = typeof p.firstName === 'string' ? p.firstName : '';
  const last = typeof p.lastName === 'string' ? p.lastName : '';
  return { first, last };
}

export async function GET(req: Request) {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const url = new URL(req.url);
  const search = (url.searchParams.get('search') ?? '').trim();
  const programId = (url.searchParams.get('programId') ?? '').trim();
  const enrollmentStatusRaw = (url.searchParams.get('enrollmentStatus') ?? '').trim();
  const enrollmentStatus = ENROLLMENT_STATUSES.has(enrollmentStatusRaw) ? enrollmentStatusRaw : '';

  const base = new URLSearchParams();
  base.set('limit', '100');
  if (search) {
    base.set('search', search);
  }
  if (programId) {
    base.set('programId', programId);
  }
  if (enrollmentStatus) {
    base.set('enrollmentStatus', enrollmentStatus);
  }

  const rows: StudentRow[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 50; page += 1) {
    const qs = new URLSearchParams(base);
    if (cursor) {
      qs.set('cursor', cursor);
    }
    const res = await fetch(`${apiBase}/students?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text();
      return new NextResponse(text || 'Upstream error', { status: res.status });
    }
    const payload = (await res.json()) as ListResponse;
    rows.push(...payload.data);
    if (!payload.nextCursor) {
      break;
    }
    cursor = payload.nextCursor;
  }

  const header = [
    'studentNumber',
    'email',
    'firstName',
    'lastName',
    'programCode',
    'programName',
    'level',
    'status',
    'cumulativeGpa',
    'creditHoursCompleted',
    'academicStanding',
    'id',
  ];
  const lines = [
    header.join(','),
    ...rows.map((r) => {
      const { first, last } = profileName(r.profile);
      return [
        csvCell(r.studentNumber),
        csvCell(r.email),
        csvCell(first),
        csvCell(last),
        csvCell(r.program?.code ?? ''),
        csvCell(r.program?.name ?? ''),
        csvCell(String(r.currentLevel ?? '')),
        csvCell(r.enrollmentStatus ?? ''),
        csvCell(
          r.academicMetrics?.cumulativeGpa !== null &&
            r.academicMetrics?.cumulativeGpa !== undefined &&
            Number.isFinite(r.academicMetrics.cumulativeGpa)
            ? String(r.academicMetrics.cumulativeGpa)
            : '',
        ),
        csvCell(
          r.academicMetrics?.creditHoursCompleted !== undefined &&
            Number.isFinite(r.academicMetrics.creditHoursCompleted)
            ? String(Math.round(r.academicMetrics.creditHoursCompleted))
            : '',
        ),
        csvCell(r.academicMetrics?.academicStanding ?? ''),
        csvCell(r.id),
      ].join(',');
    }),
  ];
  const csv = `\uFEFF${lines.join('\r\n')}`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="students-export.csv"',
    },
  });
}
