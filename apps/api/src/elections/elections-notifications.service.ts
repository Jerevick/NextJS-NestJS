import { Injectable, Logger } from '@nestjs/common';
import { NotificationEventsService } from '../notifications/notification-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { parseEligibilityRules, studentMeetsEligibility } from './election-eligibility.util';

@Injectable()
export class ElectionsNotificationsService {
  private readonly log = new Logger(ElectionsNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: NotificationEventsService,
  ) {}

  async notifyVotingOpen(election: {
    id: string;
    institutionId: string;
    entityId: string;
    title: string;
    scope: 'ENTITY' | 'INSTITUTION';
    eligibilityRules: unknown;
  }): Promise<number> {
    const rules = parseEligibilityRules(election.eligibilityRules);
    const students = await this.prisma.student.findMany({
      where: {
        institutionId: election.institutionId,
        deletedAt: null,
        userId: { not: null },
        ...(election.scope === 'ENTITY' ? { entityId: election.entityId } : {}),
      },
      select: {
        userId: true,
        enrollmentStatus: true,
        currentLevel: true,
        programId: true,
        entityId: true,
      },
    });

    let sent = 0;

    for (const s of students) {
      if (!s.userId) continue;
      if (
        !studentMeetsEligibility(s, rules, {
          electionEntityId: election.entityId,
          electionScope: election.scope,
        })
      ) {
        continue;
      }
      await this.notify.notifyElectionVotingOpen({
        institutionId: election.institutionId,
        entityId: s.entityId,
        recipientId: s.userId,
        electionTitle: election.title,
        electionId: election.id,
      });
      sent += 1;
    }

    const staffProfiles = await this.prisma.staffProfile.findMany({
      where: {
        institutionId: election.institutionId,
        deletedAt: null,
        ...(election.scope === 'ENTITY' ? { entityId: election.entityId } : {}),
      },
      select: { userId: true },
    });
    for (const sp of staffProfiles) {
      if (rules.roles?.length && !rules.roles.includes('STAFF')) continue;
      await this.notify.notifyElectionVotingOpen({
        institutionId: election.institutionId,
        entityId: election.entityId,
        recipientId: sp.userId,
        electionTitle: election.title,
        electionId: election.id,
      });
      sent += 1;
    }

    this.log.log(`Voting open notifications sent for election ${election.id}: ${sent}`);
    return sent;
  }
}
