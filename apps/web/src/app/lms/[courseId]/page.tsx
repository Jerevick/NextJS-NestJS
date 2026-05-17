import { auth } from '@/auth';
import { LmsCourseLearningHome } from '@/components/lms/lms-course-learning-home';
import { resolveStudentId } from '@/lib/resolve-student-id';

/** Prompt **8.2 (2)** — learner course shell mounted at `/lms`. */
export default async function LmsCourseHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ studentId?: string }>;
}) {
  const { courseId } = await params;
  const { studentId: studentIdParam } = await searchParams;
  const session = await auth();
  const studentId = await resolveStudentId(session, studentIdParam);
  return (
    <LmsCourseLearningHome
      courseInstanceId={courseId}
      learningRoutePrefix="/lms"
      catalogHref="/lms"
      studentId={studentId ?? null}
    />
  );
}
