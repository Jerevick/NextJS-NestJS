import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { BulkEnrollmentJobStatus } from '@prisma/client';
import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { STUDENT_CSV_IMPORT_QUEUE } from '../queues/queue.constants';
import type { StudentCsvImportJobData } from './student-csv-import.service';
import { StudentCsvImportService } from './student-csv-import.service';

@Processor(STUDENT_CSV_IMPORT_QUEUE)
export class StudentCsvImportProcessor extends WorkerHost {
  private readonly log = new Logger(StudentCsvImportProcessor.name);

  constructor(
    private readonly imports: StudentCsvImportService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<StudentCsvImportJobData>): Promise<void> {
    try {
      await this.imports.runJob(job.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'CSV import processor failed';
      this.log.error(`student-csv-import job ${job.data.jobId}: ${message}`);
      await this.prisma.studentCsvImportJob.update({
        where: { id: job.data.jobId },
        data: {
          status: BulkEnrollmentJobStatus.FAILED,
          errorMessage: message,
          completedAt: new Date(),
        },
      });
      throw err;
    }
  }
}
