import { auth } from '@/auth';
import { LmsLessonViewer } from '@/components/lms/lms-lesson-viewer';
import { resolveStudentId } from '@/lib/resolve-student-id';

export default async function LmsLessonViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
  searchParams: Promise<{ studentId?: string }>;
}) {
  const { courseId, lessonId } = await params;
  const { studentId: studentIdParam } = await searchParams;
  const session = await auth();
  const studentId = await resolveStudentId(session, studentIdParam);
  return (
    <LmsLessonViewer
      courseInstanceId={courseId}
      lessonId={lessonId}
      learningRoutePrefix="/lms"
      studentId={studentId ?? null}
    />
  );
}
