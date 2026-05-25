import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/permissions';
import { AssessmentQuestionsAuthoring } from '@/components/lms/assessment-questions-authoring';
import { AssessmentSubmissionForm } from '@/components/lms/assessment-submission-form';
import { QuizAttemptShell } from '@/components/lms/quiz-attempt-shell';
import { resolveStudentId } from '@/lib/resolve-student-id';
import { CourseAccessPing } from '@/components/lms/course-access-ping';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type AssessmentDetail = {
  id: string;
  title: string;
  type: string;
  instructions: string | null;
  dueDate: string | null;
  totalPoints: number;
  courseInstanceId: string;
  questions: Array<{
    id: string;
    type: string;
    content: unknown;
    points: number;
    sortOrder: number;
  }>;
};

export default async function AssessmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; assessmentId: string }>;
  searchParams: Promise<{ studentId?: string }>;
}) {
  const { id: courseInstanceId, assessmentId } = await params;
  const { studentId: studentIdParam } = await searchParams;
  const session = await auth();
  const resolvedStudentId = await resolveStudentId(session, studentIdParam);
  const token = session?.accessToken;
  const canRead = hasPermission(session?.user?.permissions, 'lms.read');
  const canWrite = hasPermission(session?.user?.permissions, 'lms.write');

  if (!token || !canRead) {
    return (
      <main style={{ padding: '2rem' }}>
        <Link href={`/dashboard/courses/${courseInstanceId}`}>← Course</Link>
      </main>
    );
  }

  const res = await fetch(`${apiBase}/lms/assessments/${encodeURIComponent(assessmentId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (res.status === 404) {
    notFound();
  }
  if (!res.ok) {
    return (
      <main style={{ padding: '2rem' }}>
        <p style={{ color: '#b91c1c' }}>Could not load assessment ({res.status}).</p>
      </main>
    );
  }

  const assessment = (await res.json()) as AssessmentDetail;

  return (
    <main
      style={{ padding: '2rem 2.5rem', maxWidth: 720, background: '#f8fafc', minHeight: '100vh' }}
    >
      {session?.user?.studentId &&
      resolvedStudentId &&
      session.user.studentId === resolvedStudentId ? (
        <CourseAccessPing courseInstanceId={courseInstanceId} />
      ) : null}
      <Link
        href={`/dashboard/courses/${courseInstanceId}`}
        style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.9rem' }}
      >
        ← Back to course
      </Link>
      <h1 style={{ margin: '0.75rem 0 0', color: '#0f1729' }}>{assessment.title}</h1>
      <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
        {assessment.type}
        {assessment.dueDate ? ` · Due ${new Date(assessment.dueDate).toLocaleString()}` : ''}
        {' · '}
        {assessment.totalPoints} pts
      </p>
      {assessment.instructions ? (
        <article
          style={{
            marginTop: '1.25rem',
            padding: '1rem 1.25rem',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            whiteSpace: 'pre-wrap',
            lineHeight: 1.6,
          }}
        >
          {assessment.instructions}
        </article>
      ) : null}
      {canWrite && token ? (
        <AssessmentQuestionsAuthoring
          assessmentId={assessment.id}
          questions={assessment.questions ?? []}
          apiBase={apiBase}
          accessToken={token}
        />
      ) : null}
      {resolvedStudentId ? (
        assessment.type === 'QUIZ' || assessment.type === 'EXAM' ? (
          <QuizAttemptShell
            assessmentId={assessment.id}
            studentId={resolvedStudentId}
            apiBase={apiBase}
            accessToken={token}
          />
        ) : (
          <AssessmentSubmissionForm
            assessmentId={assessment.id}
            studentId={resolvedStudentId}
            questions={assessment.questions ?? []}
            apiBase={apiBase}
            accessToken={token}
          />
        )
      ) : (
        <p style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>
          Sign in as a student, or add <code>?studentId=</code> to submit this assessment.
        </p>
      )}
    </main>
  );
}
