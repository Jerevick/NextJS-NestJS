import { LmsStudentCoursesDashboard } from '@/components/lms/lms-student-courses-dashboard';

/** Legacy path; Prompt 8.2 canonical LMS lives at **`/lms`**. */
export default function CoursesPage() {
  return <LmsStudentCoursesDashboard coursesBasePath="/courses" />;
}
