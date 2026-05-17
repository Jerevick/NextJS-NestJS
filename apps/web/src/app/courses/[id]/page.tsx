import { auth } from '@/auth';
import { LmsCourseLearningHome } from '@/components/lms/lms-course-learning-home';
import { resolveStudentId } from '@/lib/resolve-student-id';

export default async function CourseHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ studentId?: string }>;
}) {
  const { id } = await params;
  const { studentId: studentIdParam } = await searchParams;
  const session = await auth();
  const studentId = await resolveStudentId(session, studentIdParam);
  return (
    <LmsCourseLearningHome
      courseInstanceId={id}
      learningRoutePrefix="/courses"
      catalogHref="/courses"
      studentId={studentId ?? null}
    />
  );
}
