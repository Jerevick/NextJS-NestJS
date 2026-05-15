export const STUDENT_RECORD_WRITE_KEY = 'unicore:studentRecordWrite';

export type StudentRecordDateSource =
  | { kind: 'bodyField'; field: string }
  /** Use request time (e.g. grade entry with no historical date). */
  | { kind: 'now' };

export type StudentRecordWriteDescriptor =
  | {
      mode: 'bodyStudentId';
      studentIdField: string;
      recordDate?: StudentRecordDateSource;
    }
  | {
      mode: 'paramStudentId';
      param: string;
      recordDate?: StudentRecordDateSource;
    }
  | {
      mode: 'enrollmentIdParam';
      param: string;
      recordDate?: StudentRecordDateSource;
    }
  | {
      mode: 'gradeOverrideIdParam';
      param: string;
      recordDate?: StudentRecordDateSource;
    }
  | {
      mode: 'attendanceIdParam';
      param: string;
    }
  | {
      mode: 'bulkBodyAttendance';
      entriesField: string;
      studentIdField: string;
      sessionDateField: string;
    };
