/** Shapes aligned with `LmsService.serializeCourseInstanceDetail` JSON. */

export type LmsLessonResource = {
  id: string;
  title: string;
  fileKey: string;
  fileType: string;
  fileSize: number;
};

export type LMSLesson = {
  id: string;
  title: string;
  type: string;
  content: unknown;
  duration: number | null;
  sortOrder: number;
  isPublished: boolean;
  resources?: LmsLessonResource[];
};

export type LMSCourseModule = {
  id: string;
  title: string;
  sortOrder: number;
  isPublished: boolean;
  unlockCondition: unknown;
  lessons: LMSLesson[];
};
