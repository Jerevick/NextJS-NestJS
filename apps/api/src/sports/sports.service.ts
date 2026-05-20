import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, FixtureStatus, Prisma, TenantModule } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AiService } from '../ai/ai.service';
import { TenantModulesService } from '../common/tenant-modules/tenant-modules.service';
import { SportsEligibilityJobsService } from './jobs/sports-eligibility-jobs.service';
import { SportsEligibilityService } from './sports-eligibility.service';
import { SportsRepository } from './sports.repository';

@Injectable()
export class SportsService {
  constructor(
    private readonly repo: SportsRepository,
    private readonly eligibility: SportsEligibilityService,
    private readonly eligibilityJobs: SportsEligibilityJobsService,
    private readonly tenantModules: TenantModulesService,
    private readonly ai: AiService,
  ) {}

  private async assertSports(institutionId: string) {
    await this.tenantModules.assertEnabled(institutionId, TenantModule.SPORTS);
  }

  private entityId(user: AuthUser, override?: string) {
    const id = override?.trim() || user.entityId;
    if (!id)
      throw new BadRequestException('X-Entity-ID header is required for entity-scoped sports');
    return id;
  }

  async listSportTypes(user: AuthUser, entityId?: string) {
    await this.assertSports(user.institutionId);
    return this.repo.listSportTypes(user.institutionId, entityId);
  }

  async createSportType(
    user: AuthUser,
    body: { name: string; entityId?: string; category?: string; season?: string },
  ) {
    await this.assertSports(user.institutionId);
    const eid = body.entityId ?? this.entityId(user);
    return this.repo.createSportType({
      institutionId: user.institutionId,
      entityId: eid,
      name: body.name,
      category: (body.category as 'TEAM') ?? 'TEAM',
      season: (body.season as 'YEAR_ROUND') ?? 'YEAR_ROUND',
    });
  }

  async listTeams(user: AuthUser, entityId?: string) {
    await this.assertSports(user.institutionId);
    return this.repo.listTeams(user.institutionId, entityId);
  }

  async createTeam(
    user: AuthUser,
    body: {
      name: string;
      sportTypeId: string;
      entityId?: string;
      gender?: string;
      level?: string;
      coachId?: string;
      academicYearId?: string;
      homeVenue?: string;
    },
  ) {
    await this.assertSports(user.institutionId);
    const eid = body.entityId ?? this.entityId(user);
    return this.repo.createTeam({
      institutionId: user.institutionId,
      entityId: eid,
      sportTypeId: body.sportTypeId,
      name: body.name,
      gender: (body.gender as 'COED') ?? 'COED',
      level: (body.level as 'VARSITY') ?? 'VARSITY',
      coachId: body.coachId,
      academicYearId: body.academicYearId,
      homeVenue: body.homeVenue,
    });
  }

  async addPlayer(
    user: AuthUser,
    teamId: string,
    body: {
      studentId: string;
      position?: string;
      jerseyNumber?: string;
      medicalClearance?: boolean;
    },
  ) {
    await this.assertSports(user.institutionId);
    const team = await this.repo.findTeam(user.institutionId, teamId);
    if (!team) throw new NotFoundException('Team not found');
    const player = await this.repo.addPlayer({
      institutionId: user.institutionId,
      entityId: team.entityId,
      teamId,
      studentId: body.studentId,
      position: body.position,
      jerseyNumber: body.jerseyNumber,
      medicalClearance: body.medicalClearance ?? false,
    });
    await this.eligibility.recalculateForStudent(user.institutionId, body.studentId);
    return player;
  }

  async listFacilities(user: AuthUser, entityId?: string) {
    await this.assertSports(user.institutionId);
    return this.repo.listFacilities(user.institutionId, entityId);
  }

  async createFacility(
    user: AuthUser,
    body: { name: string; type: string; entityId?: string; capacity?: number; location?: string },
  ) {
    await this.assertSports(user.institutionId);
    const eid = body.entityId ?? this.entityId(user);
    return this.repo.createFacility({
      institutionId: user.institutionId,
      entityId: eid,
      name: body.name,
      type: body.type,
      capacity: body.capacity,
      location: body.location,
    });
  }

  async createBooking(
    user: AuthUser,
    body: {
      facilityId: string;
      purpose: string;
      startTime: string;
      endTime: string;
      teamId?: string;
      attendeeCount?: number;
      notes?: string;
      entityId?: string;
    },
  ) {
    await this.assertSports(user.institutionId);
    const start = new Date(body.startTime);
    const end = new Date(body.endTime);
    if (end <= start) throw new BadRequestException('endTime must be after startTime');
    const conflict = await this.repo.findOverlappingBooking(body.facilityId, start, end);
    if (conflict) {
      throw new BadRequestException('Facility booking conflicts with an existing reservation');
    }
    const eid = body.entityId ?? this.entityId(user);
    return this.repo.createBooking({
      institutionId: user.institutionId,
      entityId: eid,
      facilityId: body.facilityId,
      bookedById: user.userId,
      teamId: body.teamId,
      purpose: body.purpose,
      startTime: start,
      endTime: end,
      status: BookingStatus.CONFIRMED,
      attendeeCount: body.attendeeCount,
      notes: body.notes,
    });
  }

  async listBookings(user: AuthUser, facilityId?: string) {
    await this.assertSports(user.institutionId);
    return this.repo.listBookings(user.institutionId, facilityId);
  }

  async listCompetitions(user: AuthUser) {
    await this.assertSports(user.institutionId);
    return this.repo.listCompetitions(user.institutionId);
  }

  async createCompetition(
    user: AuthUser,
    body: {
      name: string;
      sportTypeId: string;
      startDate: string;
      endDate?: string;
      venue?: string;
      type?: string;
      entityId?: string;
    },
  ) {
    await this.assertSports(user.institutionId);
    return this.repo.createCompetition({
      institutionId: user.institutionId,
      entityId: body.entityId,
      name: body.name,
      sportTypeId: body.sportTypeId,
      organizerId: user.userId,
      startDate: new Date(body.startDate),
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      venue: body.venue,
      type: (body.type as 'LEAGUE') ?? 'LEAGUE',
    });
  }

  async listFixtures(user: AuthUser, competitionId?: string) {
    await this.assertSports(user.institutionId);
    return this.repo.listFixtures(user.institutionId, competitionId);
  }

  async createFixture(
    user: AuthUser,
    body: {
      homeTeamId: string;
      awayTeamId: string;
      scheduledAt: string;
      competitionId?: string;
      venue?: string;
      entityId?: string;
      logistics?: Record<string, unknown>;
    },
  ) {
    await this.assertSports(user.institutionId);
    if (body.homeTeamId === body.awayTeamId) {
      throw new BadRequestException('Home and away teams must differ');
    }
    const home = await this.repo.findTeam(user.institutionId, body.homeTeamId);
    const away = await this.repo.findTeam(user.institutionId, body.awayTeamId);
    if (!home || !away) throw new NotFoundException('Home or away team not found');
    const interEntity = home.entityId !== away.entityId;
    return this.repo.createFixture({
      institutionId: user.institutionId,
      entityId: interEntity ? null : (body.entityId ?? home.entityId),
      competitionId: body.competitionId,
      homeTeamId: body.homeTeamId,
      awayTeamId: body.awayTeamId,
      scheduledAt: new Date(body.scheduledAt),
      venue: body.venue,
      logistics: body.logistics as Prisma.InputJsonValue | undefined,
    });
  }

  async updateFixtureStatistics(
    user: AuthUser,
    fixtureId: string,
    body: {
      score?: Record<string, unknown>;
      statistics?: Record<string, unknown>;
      status?: string;
      matchReport?: string;
    },
  ) {
    await this.assertSports(user.institutionId);
    const fixture = await this.repo.findFixture(user.institutionId, fixtureId);
    if (!fixture) throw new NotFoundException('Fixture not found');

    if (body.statistics) {
      const playerIds = this.extractPlayerIds(body.statistics);
      for (const pid of playerIds) {
        const player = await this.repo.findPlayer(user.institutionId, pid);
        if (player && !player.isEligible) {
          throw new BadRequestException(
            `Player ${pid} is ineligible: ${player.ineligibilityReason ?? 'GPA or medical clearance'}`,
          );
        }
      }
    }

    return this.repo.updateFixture(fixtureId, {
      score: body.score as Prisma.InputJsonValue | undefined,
      statistics: body.statistics as Prisma.InputJsonValue | undefined,
      status: body.status as FixtureStatus | undefined,
      matchReport: body.matchReport,
    });
  }

  async recalculateEligibility(user: AuthUser) {
    await this.assertSports(user.institutionId);
    await this.eligibilityJobs.enqueueInstitutionRecalc(user.institutionId);
    return { queued: true };
  }

  async atRiskAlerts(user: AuthUser, includeNarrative = false) {
    await this.assertSports(user.institutionId);
    const alerts = await this.eligibility.atRiskAlerts(user.institutionId);
    const message =
      alerts.length > 0
        ? alerts
            .map(
              (a) =>
                `${a.atRiskCount} player(s) on the ${a.teamName} team are at GPA risk this semester`,
            )
            .join('; ')
        : null;

    let narrative: string | undefined;
    if (includeNarrative && alerts.length > 0) {
      narrative = await this.ai.complete(user.institutionId, [
        {
          role: 'system',
          content:
            'Summarise sports academic eligibility risks for athletics staff. Use team names only; do not invent student names.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            alerts: alerts.map((a) => ({
              team: a.teamName,
              atRiskCount: a.atRiskCount,
            })),
          }),
        },
      ]);
    }

    return { alerts, message, narrative, isAIGenerated: Boolean(narrative) };
  }

  async getTeamRoster(user: AuthUser, teamId: string) {
    await this.assertSports(user.institutionId);
    const team = await this.repo.findTeam(user.institutionId, teamId);
    if (!team) throw new NotFoundException('Team not found');
    return this.repo.listTeamPlayers(user.institutionId, teamId);
  }

  async updatePlayer(
    user: AuthUser,
    playerId: string,
    body: {
      medicalClearance?: boolean;
      position?: string;
      jerseyNumber?: string;
      isActive?: boolean;
    },
  ) {
    await this.assertSports(user.institutionId);
    const player = await this.repo.findPlayer(user.institutionId, playerId);
    if (!player) throw new NotFoundException('Player not found');
    const updated = await this.repo.updatePlayer(playerId, {
      medicalClearance: body.medicalClearance,
      position: body.position,
      jerseyNumber: body.jerseyNumber,
      isActive: body.isActive,
    });
    await this.eligibility.recalculateForStudent(user.institutionId, player.studentId);
    return updated;
  }

  async removePlayer(user: AuthUser, playerId: string) {
    await this.assertSports(user.institutionId);
    const player = await this.repo.findPlayer(user.institutionId, playerId);
    if (!player) throw new NotFoundException('Player not found');
    return this.repo.removePlayer(playerId);
  }

  async registerTeamForCompetition(user: AuthUser, competitionId: string, teamId: string) {
    await this.assertSports(user.institutionId);
    const competition = await this.repo.findCompetition(user.institutionId, competitionId);
    if (!competition) throw new NotFoundException('Competition not found');
    const team = await this.repo.findTeam(user.institutionId, teamId);
    if (!team) throw new NotFoundException('Team not found');

    const roster = await this.repo.listTeamPlayers(user.institutionId, teamId);
    const ineligible = roster.filter((p) => !p.isEligible);
    if (ineligible.length > 0) {
      throw new BadRequestException(
        `${ineligible.length} player(s) are ineligible and cannot register for competition`,
      );
    }

    return this.repo.createCompetitionEntry({
      institutionId: user.institutionId,
      competitionId,
      teamId,
      allEligible: ineligible.length === 0,
      notes: ineligible.length ? 'Partial roster ineligible' : undefined,
    });
  }

  async listCompetitionEntries(user: AuthUser, competitionId: string) {
    await this.assertSports(user.institutionId);
    return this.repo.listCompetitionEntries(user.institutionId, competitionId);
  }

  async updateFixtureLogistics(
    user: AuthUser,
    fixtureId: string,
    logistics: Record<string, unknown>,
  ) {
    await this.assertSports(user.institutionId);
    const fixture = await this.repo.findFixture(user.institutionId, fixtureId);
    if (!fixture) throw new NotFoundException('Fixture not found');
    return this.repo.updateFixture(fixtureId, {
      logistics: logistics as Prisma.InputJsonValue,
    });
  }

  async recordPlayerStats(
    user: AuthUser,
    playerId: string,
    stats: Record<string, unknown>,
    fixtureId?: string,
  ) {
    await this.assertSports(user.institutionId);
    const player = await this.repo.findPlayer(user.institutionId, playerId);
    if (!player) throw new NotFoundException('Player not found');
    if (!player.isEligible) {
      throw new BadRequestException(
        `Player is ineligible: ${player.ineligibilityReason ?? 'GPA or medical clearance'}`,
      );
    }
    const entry = {
      recordedAt: new Date().toISOString(),
      fixtureId,
      ...stats,
    };
    return this.repo.appendPlayerStats(playerId, entry as Prisma.InputJsonValue);
  }

  async listAwards(user: AuthUser, entityId?: string) {
    await this.assertSports(user.institutionId);
    return this.repo.listAwards(user.institutionId, entityId);
  }

  async createAward(
    user: AuthUser,
    body: {
      title: string;
      description?: string;
      entityId?: string;
      sportTypeId?: string;
      teamId?: string;
      playerId?: string;
      academicYear?: string;
    },
  ) {
    await this.assertSports(user.institutionId);
    return this.repo.createAward({
      institutionId: user.institutionId,
      entityId: body.entityId,
      title: body.title,
      description: body.description,
      sportTypeId: body.sportTypeId,
      teamId: body.teamId,
      playerId: body.playerId,
      academicYear: body.academicYear,
    });
  }

  async listRecords(user: AuthUser, category?: string) {
    await this.assertSports(user.institutionId);
    return this.repo.listRecords(user.institutionId, category);
  }

  async createRecord(
    user: AuthUser,
    body: {
      category: string;
      title: string;
      value: string;
      holderName?: string;
      entityId?: string;
      sportTypeId?: string;
    },
  ) {
    await this.assertSports(user.institutionId);
    return this.repo.createRecord({
      institutionId: user.institutionId,
      entityId: body.entityId,
      category: body.category,
      title: body.title,
      value: body.value,
      holderName: body.holderName,
      sportTypeId: body.sportTypeId,
    });
  }

  private extractPlayerIds(statistics: Record<string, unknown>): string[] {
    const ids: string[] = [];
    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      const obj = node as Record<string, unknown>;
      if (typeof obj.playerId === 'string') ids.push(obj.playerId);
      Object.values(obj).forEach(walk);
    };
    walk(statistics);
    return ids;
  }
}
