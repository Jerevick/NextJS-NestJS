import { SetMetadata } from '@nestjs/common';
import {
  STUDENT_RECORD_WRITE_KEY,
  type StudentRecordWriteDescriptor,
} from '../record-posting/student-record-write.meta';

/**
 * Declares how this handler resolves the student and optional record date for
 * {@link StudentRecordPostingGuard}. Omit on routes that do not post student-associated records.
 */
export const StudentRecordWrite = (descriptor: StudentRecordWriteDescriptor) =>
  SetMetadata(STUDENT_RECORD_WRITE_KEY, descriptor);
