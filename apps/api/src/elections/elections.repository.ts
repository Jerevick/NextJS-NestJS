import { Injectable } from '@nestjs/common';
import {
  CandidateStatus,
  ElectionScope,
  ElectionStatus,
  Prisma,
  type Election,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isNominationPhase, isVotingPhase } from './election-lifecycle.util';

@Injectable()
export class ElectionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listElections(institutionId: string, entityId?: string) {
    return this.prisma.election.findMany({
      where: {
        institutionId,
        deletedAt: null,
        ...(entityId ? { OR: [{ entityId }, { scope: ElectionScope.INSTITUTION }] } : {}),
      },
      orderBy: { votingOpenDate: 'desc' },
    });
  }

  findElectionRaw(institutionId: string, id: string) {
    return this.prisma.election.findFirst({
      where: { id, institutionId, deletedAt: null },
    });
  }

  findElection(institutionId: string, id: string, entityId?: string) {
    return this.resolveElection(institutionId, id, entityId).then((election) => {
      if (!election) return null;
      return this.prisma.election.findFirst({
        where: { id: election.id },
        include: {
          candidates: {
            include: {
              user: { select: { id: true, email: true, profile: true } },
            },
          },
        },
      });
    });
  }

  async resolveElection(
    institutionId: string,
    id: string,
    entityId?: string,
  ): Promise<Election | null> {
    const row = await this.findElectionRaw(institutionId, id);
    if (!row) return null;
    if (row.scope === ElectionScope.INSTITUTION) return row;
    if (entityId && row.entityId !== entityId) return null;
    return row;
  }

  createElection(data: Prisma.ElectionUncheckedCreateInput) {
    return this.prisma.election.create({ data });
  }

  updateElection(id: string, data: Prisma.ElectionUncheckedUpdateInput) {
    return this.prisma.election.update({ where: { id }, data });
  }

  listCandidates(electionId: string, status?: CandidateStatus) {
    return this.prisma.electionCandidate.findMany({
      where: { electionId, ...(status ? { status } : {}) },
      include: { user: { select: { id: true, email: true, profile: true } } },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  }

  findCandidate(electionId: string, candidateId: string) {
    return this.prisma.electionCandidate.findFirst({
      where: { id: candidateId, electionId },
    });
  }

  findCandidateById(candidateId: string) {
    return this.prisma.electionCandidate.findUnique({ where: { id: candidateId } });
  }

  createCandidate(data: Prisma.ElectionCandidateUncheckedCreateInput) {
    return this.prisma.electionCandidate.create({ data });
  }

  updateCandidate(id: string, data: Prisma.ElectionCandidateUncheckedUpdateInput) {
    return this.prisma.electionCandidate.update({ where: { id }, data });
  }

  findVoter(electionId: string, userId: string) {
    return this.prisma.electionVoter.findUnique({
      where: { electionId_userId: { electionId, userId } },
    });
  }

  findVoterByBallotToken(ballotToken: string) {
    return this.prisma.electionVoter.findUnique({
      where: { ballotToken },
      include: { election: true },
    });
  }

  updateVoter(id: string, data: Prisma.ElectionVoterUncheckedUpdateInput) {
    return this.prisma.electionVoter.update({ where: { id }, data });
  }

  upsertVoter(data: Prisma.ElectionVoterUncheckedCreateInput) {
    return this.prisma.electionVoter.upsert({
      where: { electionId_userId: { electionId: data.electionId, userId: data.userId } },
      create: data,
      update: {},
    });
  }

  createVotes(votes: Prisma.ElectionVoteUncheckedCreateInput[]) {
    return this.prisma.electionVote.createMany({ data: votes });
  }

  findVoteByToken(verificationToken: string) {
    return this.prisma.electionVote.findUnique({
      where: { verificationToken },
      select: { id: true, electionId: true, position: true, castAt: true, verificationToken: true },
    });
  }

  countVotesByPosition(electionId: string) {
    return this.prisma.electionVote.groupBy({
      by: ['position', 'candidateId'],
      where: { electionId },
      _count: { _all: true },
    });
  }

  appendAudit(data: Prisma.ElectionAuditLogUncheckedCreateInput) {
    return this.prisma.electionAuditLog.create({ data });
  }

  listAudit(electionId: string) {
    return this.prisma.electionAuditLog.findMany({
      where: { electionId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  assertElectionPhase(election: Election, phase: 'nomination' | 'voting') {
    if (phase === 'nomination') return isNominationPhase(election);
    return isVotingPhase(election);
  }
}
