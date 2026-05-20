import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { SportsEligibilityService } from '../sports-eligibility.service';

export type SportsEligibilityJobData =
  | { scope: 'institution'; institutionId: string }
  | { scope: 'student'; institutionId: string; studentId: string };

@Injectable()
export class SportsEligibilityJobsService {
  private readonly log = new Logger(SportsEligibilityJobsService.name);

  constructor(
    private readonly eligibility: SportsEligibilityService,
    private readonly queue: Queue<SportsEligibilityJobData> | null,
  ) {}

  async enqueueAfterGradeRelease(institutionId: string, studentId: string): Promise<void> {
    const data: SportsEligibilityJobData = { scope: 'student', institutionId, studentId };
    if (this.queue) {
      await this.queue.add('recalc-student', data, { removeOnComplete: 100 });
      return;
    }
    this.log.debug('No Redis queue — recalculating sports eligibility synchronously');
    await this.eligibility.recalculateForStudent(institutionId, studentId);
  }

  async enqueueInstitutionRecalc(institutionId: string): Promise<void> {
    const data: SportsEligibilityJobData = { scope: 'institution', institutionId };
    if (this.queue) {
      await this.queue.add('recalc-institution', data, { removeOnComplete: 50 });
      return;
    }
    await this.eligibility.recalculateForInstitution(institutionId);
  }

  async processJob(data: SportsEligibilityJobData): Promise<void> {
    if (data.scope === 'institution') {
      await this.eligibility.recalculateForInstitution(data.institutionId);
    } else {
      await this.eligibility.recalculateForStudent(data.institutionId, data.studentId);
    }
  }
}
