import { auth } from '@/auth';
import { LmsLessonViewer } from '@/components/lms/lms-lesson-viewer';
import { resolveStudentId } from '@/lib/resolve-student-id';

export default async function LessonViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; lessonId: string }>;
  searchParams: Promise<{ studentId?: string }>;
}) {
  const { id, lessonId } = await params;
  const { studentId: studentIdParam } = await searchParams;
  const session = await auth();
  const studentId = await resolveStudentId(session, studentIdParam);
  return (
    <LmsLessonViewer
      courseInstanceId={id}
      lessonId={lessonId}
      learningRoutePrefix="/courses"
      studentId={studentId ?? null}
    />
  );
}
