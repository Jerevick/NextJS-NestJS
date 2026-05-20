import { LmsStudentCoursesDashboard } from '@/components/lms/lms-student-courses-dashboard';

/** Student portal — LMS course cards (Prompt 15.1 /my-courses). */
export default function MyCoursesPage() {
  return <LmsStudentCoursesDashboard coursesBasePath="/lms" embedded />;
}
