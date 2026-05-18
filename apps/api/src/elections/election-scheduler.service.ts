import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ElectionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { deriveElectionStatusFromDates } from './election-lifecycle.util';
import { ElectionsNotificationsService } from './elections-notifications.service';

@Injectable()
export class ElectionSchedulerService {
  private readonly log = new Logger(ElectionSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: ElectionsNotificationsService,
  ) {}

  @Cron('*/15 * * * *')
  async syncElectionPhases(): Promise<void> {
    const elections = await this.prisma.election.findMany({
      where: {
        deletedAt: null,
        status: {
          notIn: [
            ElectionStatus.CERTIFICATION_PENDING,
            ElectionStatus.PUBLISHED,
            ElectionStatus.ARCHIVED,
          ],
        },
      },
      take: 200,
    });

    for (const election of elections) {
      const next = deriveElectionStatusFromDates(election);
      if (!next || next === election.status) continue;

      await this.prisma.election.update({
        where: { id: election.id },
        data: { status: next },
      });

      if (next === ElectionStatus.VOTING_OPEN && !election.votingNotifiedAt) {
        try {
          const count = await this.notify.notifyVotingOpen({
            id: election.id,
            institutionId: election.institutionId,
            entityId: election.entityId,
            title: election.title,
            scope: election.scope,
            eligibilityRules: election.eligibilityRules,
          });
          await this.prisma.election.update({
            where: { id: election.id },
            data: { votingNotifiedAt: new Date() },
          });
          this.log.log(`Voting open notifications sent for ${election.id}: ${count}`);
        } catch (e) {
          this.log.warn(`Voting notifications failed for ${election.id}: ${String(e)}`);
        }
      }
    }
  }
}
