'use client';

import { useEffect, useRef } from 'react';

import { pingLmsCourseAccess } from '@/actions/lms-course-ping-access';

/** Fires once on mount — updates LMS “last accessed” for enrolled students without blocking SSR. */
export function CourseAccessPing({ courseInstanceId }: { courseInstanceId: string }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) {
      return;
    }
    sent.current = true;
    pingLmsCourseAccess(courseInstanceId).catch(() => {});
  }, [courseInstanceId]);

  return null;
}
