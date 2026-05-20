import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  getInstitutionSettings(institutionId: string) {
    return this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { settings: true },
    });
  }

  listSportTypes(institutionId: string, entityId?: string) {
    return this.prisma.sportType.findMany({
      where: { institutionId, ...(entityId ? { entityId } : {}) },
      orderBy: { name: 'asc' },
    });
  }

  createSportType(data: Prisma.SportTypeUncheckedCreateInput) {
    return this.prisma.sportType.create({ data });
  }

  listTeams(institutionId: string, entityId?: string) {
    return this.prisma.sportsTeam.findMany({
      where: { institutionId, deletedAt: null, ...(entityId ? { entityId } : {}) },
      include: { sportType: true, _count: { select: { players: true } } },
    });
  }

  findTeam(institutionId: string, id: string) {
    return this.prisma.sportsTeam.findFirst({
      where: { id, institutionId, deletedAt: null },
      include: { players: { include: { student: { select: { id: true, studentNumber: true } } } } },
    });
  }

  createTeam(data: Prisma.SportsTeamUncheckedCreateInput) {
    return this.prisma.sportsTeam.create({ data });
  }

  findPlayer(institutionId: string, id: string) {
    return this.prisma.sportsPlayer.findFirst({
      where: { id, institutionId },
      include: { student: true, team: true },
    });
  }

  addPlayer(data: Prisma.SportsPlayerUncheckedCreateInput) {
    return this.prisma.sportsPlayer.create({ data });
  }

  updatePlayer(id: string, data: Prisma.SportsPlayerUpdateInput) {
    return this.prisma.sportsPlayer.update({ where: { id }, data });
  }

  listActivePlayers(institutionId: string, teamId?: string) {
    return this.prisma.sportsPlayer.findMany({
      where: {
        institutionId,
        isActive: true,
        ...(teamId ? { teamId } : {}),
      },
      include: {
        student: { select: { id: true, programId: true } },
        team: { select: { id: true, name: true, sportTypeId: true } },
      },
    });
  }

  listFacilities(institutionId: string, entityId?: string) {
    return this.prisma.sportsFacility.findMany({
      where: { institutionId, ...(entityId ? { entityId } : {}) },
    });
  }

  createFacility(data: Prisma.SportsFacilityUncheckedCreateInput) {
    return this.prisma.sportsFacility.create({ data });
  }

  findOverlappingBooking(facilityId: string, startTime: Date, endTime: Date, excludeId?: string) {
    return this.prisma.facilityBooking.findFirst({
      where: {
        facilityId,
        status: { not: 'CANCELLED' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });
  }

  createBooking(data: Prisma.FacilityBookingUncheckedCreateInput) {
    return this.prisma.facilityBooking.create({ data });
  }

  listBookings(institutionId: string, facilityId?: string) {
    return this.prisma.facilityBooking.findMany({
      where: {
        institutionId,
        ...(facilityId ? { facilityId } : {}),
        status: { not: 'CANCELLED' },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  listCompetitions(institutionId: string) {
    return this.prisma.sportsCompetition.findMany({
      where: { institutionId, deletedAt: null },
      include: { sportType: true },
    });
  }

  createCompetition(data: Prisma.SportsCompetitionUncheckedCreateInput) {
    return this.prisma.sportsCompetition.create({ data });
  }

  listFixtures(institutionId: string, competitionId?: string) {
    return this.prisma.sportsFixture.findMany({
      where: {
        institutionId,
        ...(competitionId ? { competitionId } : {}),
      },
      include: { homeTeam: true, awayTeam: true },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  findFixture(institutionId: string, id: string) {
    return this.prisma.sportsFixture.findFirst({
      where: { id, institutionId },
      include: { homeTeam: true, awayTeam: true },
    });
  }

  createFixture(data: Prisma.SportsFixtureUncheckedCreateInput) {
    return this.prisma.sportsFixture.create({ data });
  }

  updateFixture(id: string, data: Prisma.SportsFixtureUpdateInput) {
    return this.prisma.sportsFixture.update({ where: { id }, data });
  }

  studentEnrollmentsForGpa(institutionId: string, studentId: string) {
    return this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
      select: {
        id: true,
        programId: true,
        enrollments: {
          where: { deletedAt: null },
          include: {
            section: { include: { course: { select: { id: true, creditHours: true } } } },
            semester: { select: { startDate: true } },
          },
        },
      },
    });
  }

  progressionRuleGpaPolicy(institutionId: string, programId: string) {
    return this.prisma.progressionRule.findFirst({
      where: { institutionId, programId, deletedAt: null },
      select: { gpaRepeatPolicy: true },
    });
  }

  listTeamPlayers(institutionId: string, teamId: string) {
    return this.prisma.sportsPlayer.findMany({
      where: { institutionId, teamId, isActive: true },
      include: { student: { select: { id: true, studentNumber: true, programId: true } } },
    });
  }

  removePlayer(id: string) {
    return this.prisma.sportsPlayer.update({
      where: { id },
      data: { isActive: false },
    });
  }

  findCompetition(institutionId: string, id: string) {
    return this.prisma.sportsCompetition.findFirst({
      where: { id, institutionId, deletedAt: null },
    });
  }

  createCompetitionEntry(data: Prisma.SportsCompetitionEntryUncheckedCreateInput) {
    return this.prisma.sportsCompetitionEntry.create({ data });
  }

  listCompetitionEntries(institutionId: string, competitionId: string) {
    return this.prisma.sportsCompetitionEntry.findMany({
      where: { institutionId, competitionId },
      include: { team: true },
    });
  }

  listAwards(institutionId: string, entityId?: string) {
    return this.prisma.sportsAward.findMany({
      where: { institutionId, ...(entityId ? { entityId } : {}) },
      orderBy: { awardedAt: 'desc' },
    });
  }

  createAward(data: Prisma.SportsAwardUncheckedCreateInput) {
    return this.prisma.sportsAward.create({ data });
  }

  listRecords(institutionId: string, category?: string) {
    return this.prisma.sportsRecord.findMany({
      where: { institutionId, ...(category ? { category } : {}) },
      orderBy: { setAt: 'desc' },
    });
  }

  createRecord(data: Prisma.SportsRecordUncheckedCreateInput) {
    return this.prisma.sportsRecord.create({ data });
  }

  appendPlayerStats(playerId: string, stats: Prisma.InputJsonValue) {
    return this.prisma.sportsPlayer.findUnique({ where: { id: playerId } }).then(async (p) => {
      if (!p) return null;
      const existing =
        p.careerStats && typeof p.careerStats === 'object' && !Array.isArray(p.careerStats)
          ? (p.careerStats as Record<string, unknown>)
          : {};
      const history = Array.isArray(existing.history) ? [...existing.history] : [];
      history.push(stats);
      return this.prisma.sportsPlayer.update({
        where: { id: playerId },
        data: { careerStats: { ...existing, history } as Prisma.InputJsonValue },
      });
    });
  }
}
