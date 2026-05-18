import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CandidateStatus,
  ElectionScope,
  ElectionStatus,
  Prisma,
  TenantModule,
  UserRole,
} from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { TenantModulesService } from '../common/tenant-modules/tenant-modules.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { parseEligibilityRules, studentMeetsEligibility } from './election-eligibility.util';
import { deriveElectionStatusFromDates } from './election-lifecycle.util';
import {
  newBallotToken,
  signBallotCredential,
  verifyBallotCredential,
} from './election-booth.util';
import {
  buildBallotCommitment,
  getElectionRsaKeys,
  newBallotCommitmentNonce,
  signBlindedCommitment,
  verifyWithStoredParams,
} from './election-blind-rsa.util';
import { computeVoterHash, newVerificationToken } from './election-vote.util';
import type { CastBoothVoteDto } from './dto/cast-booth-vote.dto';
import type { CastVoteDto } from './dto/cast-vote.dto';
import type { CreateElectionDto } from './dto/create-election.dto';
import type { NominateCandidateDto } from './dto/nominate-candidate.dto';
import type { UpdateElectionDto } from './dto/update-election.dto';
import { ElectionDocumentsService } from './election-documents.service';
import { ElectionsRepository } from './elections.repository';

@Injectable()
export class ElectionsService {
  constructor(
    private readonly repo: ElectionsRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tenantModules: TenantModulesService,
    private readonly workflows: WorkflowEngineService,
    private readonly documents: ElectionDocumentsService,
  ) {}

  private async assertElectionsModule(institutionId: string) {
    await this.tenantModules.assertEnabled(institutionId, TenantModule.ELECTIONS);
  }

  private entityId(user: AuthUser, override?: string) {
    if (override?.trim()) return override.trim();
    if (!user.entityId) {
      throw new BadRequestException('X-Entity-ID header is required for entity-scoped elections');
    }
    return user.entityId;
  }

  private canManage(user: AuthUser) {
    return user.permissions?.includes('*') || user.permissions?.includes('elections.manage');
  }

  private hasInstitutionScope(user: AuthUser) {
    return user.permissions?.includes('*') || user.permissions?.includes('institutions.write');
  }

  private scopeEntityId(user: AuthUser, queryEntityId?: string) {
    if (this.canManage(user) && this.hasInstitutionScope(user)) {
      return queryEntityId?.trim() || undefined;
    }
    return this.entityId(user, queryEntityId);
  }

  private async logElection(
    election: { id: string; institutionId: string; entityId: string },
    actorId: string,
    action: string,
    details?: Record<string, unknown>,
  ) {
    await this.repo.appendAudit({
      institutionId: election.institutionId,
      entityId: election.entityId,
      electionId: election.id,
      actorId,
      action,
      details: (details ?? {}) as Prisma.InputJsonValue,
    });
    this.audit.append({
      institutionId: election.institutionId,
      actorId,
      action: `election.${action}`,
      entity: 'Election',
      entityId: election.id,
      newValues: details as Prisma.InputJsonValue,
    });
  }

  async list(user: AuthUser, queryEntityId?: string) {
    await this.assertElectionsModule(user.institutionId);
    const entityId = this.scopeEntityId(user, queryEntityId);
    return this.repo.listElections(user.institutionId, entityId).then((data) => ({ data }));
  }

  async getOne(user: AuthUser, id: string, queryEntityId?: string) {
    await this.assertElectionsModule(user.institutionId);
    const entityId = this.scopeEntityId(user, queryEntityId);
    const row = await this.repo.findElection(user.institutionId, id, entityId);
    if (!row) throw new NotFoundException('Election not found');
    return row;
  }

  async listCandidates(user: AuthUser, electionId: string, queryEntityId?: string) {
    await this.assertElectionsModule(user.institutionId);
    const entityId = this.scopeEntityId(user, queryEntityId);
    const election = await this.repo.resolveElection(user.institutionId, electionId, entityId);
    if (!election) throw new NotFoundException('Election not found');
    const data = await this.repo.listCandidates(electionId);
    return {
      data: data.map((c) => ({
        ...c,
        photoUrl: this.documents.getPhotoUrl(c.photo),
      })),
    };
  }

  async create(user: AuthUser, dto: CreateElectionDto) {
    await this.assertElectionsModule(user.institutionId);
    if (!this.canManage(user)) throw new ForbiddenException('Requires elections.manage');
    const entityId = this.entityId(user);
    const scope = dto.scope ?? ElectionScope.ENTITY;
    const row = await this.repo.createElection({
      institutionId: user.institutionId,
      entityId,
      title: dto.title.trim(),
      description: dto.description?.trim() ?? '',
      type: dto.type,
      scope,
      eligibilityOrgUnitId: dto.eligibilityOrgUnitId,
      eligibilityRules: (dto.eligibilityRules ?? {}) as Prisma.InputJsonValue,
      positions: dto.positions as unknown as Prisma.InputJsonValue,
      nominationOpenDate: new Date(dto.nominationOpenDate),
      nominationCloseDate: new Date(dto.nominationCloseDate),
      votingOpenDate: new Date(dto.votingOpenDate),
      votingCloseDate: new Date(dto.votingCloseDate),
      status: ElectionStatus.DRAFT,
    });
    await this.logElection(row, user.userId, 'created', { title: row.title, scope });
    return row;
  }

  async update(user: AuthUser, id: string, dto: UpdateElectionDto) {
    await this.assertElectionsModule(user.institutionId);
    if (!this.canManage(user)) throw new ForbiddenException('Requires elections.manage');
    const entityId = this.scopeEntityId(user);
    const existing = await this.repo.resolveElection(user.institutionId, id, entityId);
    if (!existing) throw new NotFoundException('Election not found');
    const data: Prisma.ElectionUncheckedUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.eligibilityRules !== undefined) {
      data.eligibilityRules = dto.eligibilityRules as Prisma.InputJsonValue;
    }
    if (dto.nominationOpenDate) data.nominationOpenDate = new Date(dto.nominationOpenDate);
    if (dto.nominationCloseDate) data.nominationCloseDate = new Date(dto.nominationCloseDate);
    if (dto.votingOpenDate) data.votingOpenDate = new Date(dto.votingOpenDate);
    if (dto.votingCloseDate) data.votingCloseDate = new Date(dto.votingCloseDate);
    const row = await this.repo.updateElection(id, data);
    await this.logElection(row, user.userId, 'updated', { status: row.status });
    return row;
  }

  async syncLifecycle(user: AuthUser, electionId: string) {
    if (!this.canManage(user)) throw new ForbiddenException('Requires elections.manage');
    await this.assertElectionsModule(user.institutionId);
    const entityId = this.scopeEntityId(user);
    const election = await this.repo.resolveElection(user.institutionId, electionId, entityId);
    if (!election) throw new NotFoundException('Election not found');
    const next = deriveElectionStatusFromDates(election);
    if (!next || next === election.status) return election;
    const row = await this.repo.updateElection(electionId, { status: next });
    await this.logElection(row, user.userId, 'lifecycle.sync', { status: next });
    return row;
  }

  async nominate(user: AuthUser, electionId: string, dto: NominateCandidateDto) {
    await this.assertElectionsModule(user.institutionId);
    const entityId = this.scopeEntityId(user);
    const election = await this.repo.resolveElection(user.institutionId, electionId, entityId);
    if (!election) throw new NotFoundException('Election not found');
    if (!this.repo.assertElectionPhase(election, 'nomination')) {
      throw new BadRequestException('Nominations are not open for this election');
    }
    const nominee = await this.prisma.user.findFirst({
      where: { id: dto.userId, institutionId: user.institutionId, deletedAt: null },
    });
    if (!nominee) throw new BadRequestException('Nominee user not found');
    const positions = election.positions as Array<{ title: string }>;
    if (!positions.some((p) => p.title === dto.position)) {
      throw new BadRequestException('Unknown position');
    }
    try {
      const candidate = await this.repo.createCandidate({
        institutionId: election.institutionId,
        entityId: election.entityId,
        electionId: election.id,
        userId: dto.userId,
        position: dto.position,
        manifesto: dto.manifesto?.trim() ?? '',
        manifestoDocKey: dto.manifestoDocKey,
        nominatedBy: user.userId,
        secondedBy: dto.secondedBy,
        status: CandidateStatus.PENDING,
      });
      await this.logElection(election, user.userId, 'candidate.nominated', {
        candidateId: candidate.id,
        position: dto.position,
      });
      return candidate;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Already nominated for this position');
      }
      throw e;
    }
  }

  async reviewCandidate(
    user: AuthUser,
    electionId: string,
    candidateId: string,
    status: CandidateStatus,
    rejectionReason?: string,
  ) {
    if (!this.canManage(user)) throw new ForbiddenException('Requires elections.manage');
    await this.assertElectionsModule(user.institutionId);
    const entityId = this.scopeEntityId(user);
    const election = await this.repo.resolveElection(user.institutionId, electionId, entityId);
    if (!election) throw new NotFoundException('Election not found');
    const candidate = await this.repo.findCandidate(electionId, candidateId);
    if (!candidate) throw new NotFoundException('Candidate not found');
    const row = await this.repo.updateCandidate(candidateId, {
      status,
      rejectionReason: status === CandidateStatus.REJECTED ? rejectionReason : null,
    });
    await this.logElection(election, user.userId, 'candidate.reviewed', { candidateId, status });
    return row;
  }

  async ballot(user: AuthUser, electionId: string) {
    await this.assertElectionsModule(user.institutionId);
    const entityId = this.scopeEntityId(user);
    const election = await this.repo.findElection(user.institutionId, electionId, entityId);
    if (!election) throw new NotFoundException('Election not found');
    await this.assertEligibleVoter(user, election);
    const approved = await this.repo.listCandidates(electionId, CandidateStatus.APPROVED);
    return {
      election: {
        id: election.id,
        title: election.title,
        status: election.status,
        votingOpenDate: election.votingOpenDate,
        votingCloseDate: election.votingCloseDate,
      },
      positions: election.positions,
      candidates: approved.map((c) => ({
        id: c.id,
        position: c.position,
        manifesto: c.manifesto,
        user: { id: c.user.id, name: profileName(c.user.profile) },
      })),
    };
  }

  async issueBoothCredential(user: AuthUser, electionId: string, clientCommitment?: string) {
    await this.assertElectionsModule(user.institutionId);
    const entityId = this.scopeEntityId(user);
    const election = await this.repo.resolveElection(user.institutionId, electionId, entityId);
    if (!election) throw new NotFoundException('Election not found');
    if (!this.repo.assertElectionPhase(election, 'voting')) {
      throw new BadRequestException('Voting is not open for this election');
    }
    await this.assertEligibleVoter(user, election);

    const existing = await this.repo.findVoter(electionId, user.userId);
    if (existing?.hasVoted) {
      throw new ConflictException('You have already voted in this election');
    }

    const ballotToken = newBallotToken();
    const ballotSignature = signBallotCredential(election.institutionId, electionId, ballotToken);
    const ballotCommitment =
      clientCommitment?.toLowerCase() ??
      buildBallotCommitment(electionId, newBallotCommitmentNonce());
    const ballotExpiresAt = election.votingCloseDate ?? new Date(Date.now() + 4 * 60 * 60_000);
    const rsaKeys = getElectionRsaKeys();

    await this.prisma.electionVoter.upsert({
      where: { electionId_userId: { electionId, userId: user.userId } },
      create: {
        institutionId: election.institutionId,
        entityId: election.entityId,
        electionId,
        userId: user.userId,
        ballotToken,
        ballotSignature,
        ballotExpiresAt,
        ballotCommitment,
      },
      update: {
        ballotToken,
        ballotSignature,
        ballotExpiresAt,
        ballotCommitment,
        blindRsaSignature: null,
      },
    });

    return {
      electionId,
      ballotToken,
      ballotSignature,
      ballotCommitment,
      electionPublicKeyPem: rsaKeys.publicKeyPem,
      rsaPublicParams: rsaKeys.publicParams,
      expiresAt: ballotExpiresAt,
      boothUrl: `/elections/${electionId}/booth`,
    };
  }

  /** Signs a client-blinded commitment; issuer never sees the plaintext commitment. */
  async signBlindedBallot(
    user: AuthUser,
    electionId: string,
    ballotToken: string,
    blindedCommitmentHex: string,
  ) {
    await this.assertElectionsModule(user.institutionId);
    const voter = await this.repo.findVoterByBallotToken(ballotToken);
    if (!voter || voter.electionId !== electionId || voter.userId !== user.userId) {
      throw new ForbiddenException('Invalid booth session');
    }
    if (!voter.ballotCommitment) throw new BadRequestException('Missing ballot commitment');
    const signedBlindedHex = signBlindedCommitment(blindedCommitmentHex);
    return { signedBlindedHex };
  }

  /** @deprecated Prefer client blind + POST blind-sign; kept for backward compatibility. */
  async finalizeBlindEndorsement(user: AuthUser, electionId: string, ballotToken: string) {
    const { blindCommitment, unblindSignature } = await import('@unicore/utils');
    await this.assertElectionsModule(user.institutionId);
    const voter = await this.repo.findVoterByBallotToken(ballotToken);
    if (!voter || voter.electionId !== electionId || voter.userId !== user.userId) {
      throw new ForbiddenException('Invalid booth session');
    }
    if (!voter.ballotCommitment) throw new BadRequestException('Missing ballot commitment');
    const params = getElectionRsaKeys().publicParams;
    const { blindedHex, blindingFactorHex } = blindCommitment(voter.ballotCommitment, params);
    const signedBlinded = signBlindedCommitment(blindedHex);
    const blindRsaSignature = unblindSignature(signedBlinded, blindingFactorHex, params);
    return { blindRsaSignature };
  }

  async castVote(user: AuthUser, electionId: string, dto: CastVoteDto) {
    await this.assertElectionsModule(user.institutionId);
    const entityId = this.scopeEntityId(user);
    const election = await this.repo.resolveElection(user.institutionId, electionId, entityId);
    if (!election) throw new NotFoundException('Election not found');
    if (!this.repo.assertElectionPhase(election, 'voting')) {
      throw new BadRequestException('Voting is not open for this election');
    }
    await this.assertEligibleVoter(user, election);

    const voter = await this.repo.findVoter(electionId, user.userId);
    if (voter?.hasVoted) throw new ConflictException('You have already voted in this election');

    return this.recordBallotChoices(election, user.userId, dto.choices);
  }

  async boothBallot(electionId: string, dto: { ballotToken: string; ballotSignature: string }) {
    const voter = await this.repo.findVoterByBallotToken(dto.ballotToken);
    if (!voter?.election || voter.election.id !== electionId) {
      throw new NotFoundException('Invalid booth credential');
    }
    const election = voter.election;
    await this.assertElectionsModule(election.institutionId);
    if (voter.hasVoted) throw new ConflictException('Credential already used');
    if (
      !voter.ballotSignature ||
      !verifyBallotCredential(
        election.institutionId,
        electionId,
        dto.ballotToken,
        dto.ballotSignature,
      ) ||
      dto.ballotSignature !== voter.ballotSignature
    ) {
      throw new ForbiddenException('Invalid booth signature');
    }
    const approved = await this.repo.listCandidates(electionId, CandidateStatus.APPROVED);
    return {
      election: {
        id: election.id,
        title: election.title,
        status: election.status,
      },
      positions: election.positions,
      candidates: approved.map((c) => ({
        id: c.id,
        position: c.position,
        manifesto: c.manifesto,
        displayName: `Candidate ${c.id.slice(-6)}`,
      })),
    };
  }

  async castBoothVote(electionId: string, dto: CastBoothVoteDto) {
    const voter = await this.repo.findVoterByBallotToken(dto.ballotToken);
    if (!voter?.election) throw new NotFoundException('Invalid booth credential');
    const election = voter.election;
    await this.assertElectionsModule(election.institutionId);
    if (!this.repo.assertElectionPhase(election, 'voting')) {
      throw new BadRequestException('Voting is not open for this election');
    }
    if (voter.hasVoted) throw new ConflictException('This booth credential has already been used');
    if (voter.ballotExpiresAt && voter.ballotExpiresAt < new Date()) {
      throw new BadRequestException('Booth credential has expired');
    }
    if (
      !voter.ballotSignature ||
      !verifyBallotCredential(
        election.institutionId,
        electionId,
        dto.ballotToken,
        dto.ballotSignature,
      ) ||
      dto.ballotSignature !== voter.ballotSignature
    ) {
      throw new ForbiddenException('Invalid booth signature');
    }
    if (
      !voter.ballotCommitment ||
      !verifyWithStoredParams(voter.ballotCommitment, dto.blindRsaSignature)
    ) {
      throw new ForbiddenException('Invalid RSA blind endorsement');
    }

    return this.recordBallotChoices(election, voter.userId, dto.choices, voter.id);
  }

  private async recordBallotChoices(
    election: { id: string; institutionId: string; entityId: string },
    userId: string,
    choices: CastVoteDto['choices'],
    voterRowId?: string,
  ) {
    const electionId = election.id;
    const approved = await this.repo.listCandidates(electionId, CandidateStatus.APPROVED);
    const byId = new Map(approved.map((c) => [c.id, c]));
    const positionsSeen = new Set<string>();
    for (const choice of choices) {
      if (positionsSeen.has(choice.position)) {
        throw new BadRequestException('Duplicate position in ballot');
      }
      positionsSeen.add(choice.position);
      const cand = byId.get(choice.candidateId);
      if (!cand || cand.position !== choice.position) {
        throw new BadRequestException('Invalid candidate for position');
      }
    }

    const voterHash = computeVoterHash(electionId, userId, election.institutionId);
    const sessionToken = newVerificationToken();
    const votes: Prisma.ElectionVoteUncheckedCreateInput[] = choices.map((choice) => ({
      institutionId: election.institutionId,
      entityId: election.entityId,
      electionId,
      voterHash,
      position: choice.position,
      candidateId: choice.candidateId,
      verificationToken: newVerificationToken(),
    }));

    await this.prisma.$transaction(async (tx) => {
      await tx.electionVoter.upsert({
        where: { electionId_userId: { electionId, userId } },
        create: {
          institutionId: election.institutionId,
          entityId: election.entityId,
          electionId,
          userId,
          hasVoted: true,
          votedAt: new Date(),
          verificationToken: sessionToken,
        },
        update: {
          hasVoted: true,
          votedAt: new Date(),
          verificationToken: sessionToken,
          ballotToken: null,
          ballotSignature: null,
          ballotExpiresAt: null,
        },
      });
      await tx.electionVote.createMany({ data: votes });
    });

    if (voterRowId) {
      await this.repo.updateVoter(voterRowId, {
        ballotToken: null,
        ballotSignature: null,
        ballotExpiresAt: null,
      });
    }

    return {
      verificationToken: sessionToken,
      voteTokens: votes.map((v) => ({
        position: v.position,
        verificationToken: v.verificationToken,
      })),
    };
  }

  async verifyVote(token: string) {
    const vote = await this.repo.findVoteByToken(token);
    if (!vote) throw new NotFoundException('Vote not found');
    return {
      counted: true,
      electionId: vote.electionId,
      position: vote.position,
      castAt: vote.castAt,
      verificationToken: vote.verificationToken,
    };
  }

  private async buildResults(electionId: string) {
    const tallies = await this.repo.countVotesByPosition(electionId);
    const candidates = await this.repo.listCandidates(electionId, CandidateStatus.APPROVED);
    const candMap = new Map(candidates.map((c) => [c.id, c]));
    const byPosition: Record<
      string,
      Array<{ candidateId: string; votes: number; name: string }>
    > = {};
    for (const t of tallies) {
      const list = byPosition[t.position] ?? [];
      const c = candMap.get(t.candidateId);
      list.push({
        candidateId: t.candidateId,
        votes: t._count._all,
        name: c ? profileName(c.user.profile) : 'Candidate',
      });
      byPosition[t.position] = list.sort((a, b) => b.votes - a.votes);
    }
    return byPosition;
  }

  async results(user: AuthUser, electionId: string) {
    if (!this.canManage(user)) throw new ForbiddenException('Requires elections.manage');
    await this.assertElectionsModule(user.institutionId);
    const entityId = this.scopeEntityId(user);
    const election = await this.repo.resolveElection(user.institutionId, electionId, entityId);
    if (!election) throw new NotFoundException('Election not found');
    if (
      election.status !== ElectionStatus.VOTING_OPEN &&
      election.status !== ElectionStatus.VOTING_CLOSED
    ) {
      throw new ForbiddenException(
        'Tallies are only available while voting is open or after it has closed',
      );
    }
    return {
      electionId,
      status: election.status,
      publishedAt: election.resultsPublishedAt,
      results: await this.buildResults(electionId),
    };
  }

  async publicResults(user: AuthUser, electionId: string) {
    await this.assertElectionsModule(user.institutionId);
    const election = await this.repo.resolveElection(
      user.institutionId,
      electionId,
      this.scopeEntityId(user),
    );
    if (!election) throw new NotFoundException('Election not found');
    if (election.status !== ElectionStatus.PUBLISHED) {
      throw new ForbiddenException('Results are not published yet');
    }
    return {
      electionId,
      title: election.title,
      publishedAt: election.resultsPublishedAt,
      results: await this.buildResults(electionId),
    };
  }

  async startCertification(user: AuthUser, electionId: string) {
    if (!this.canManage(user)) throw new ForbiddenException('Requires elections.manage');
    await this.assertElectionsModule(user.institutionId);
    const entityId = this.scopeEntityId(user);
    const election = await this.repo.resolveElection(user.institutionId, electionId, entityId);
    if (!election) throw new NotFoundException('Election not found');
    if (
      election.status !== ElectionStatus.VOTING_CLOSED &&
      election.status !== ElectionStatus.CERTIFICATION_PENDING
    ) {
      throw new BadRequestException('Election must be closed for voting before certification');
    }

    if (election.workflowInstanceId) {
      return election;
    }

    const instance = await this.workflows.initiateWorkflow({
      institutionId: election.institutionId,
      entityId: election.entityId,
      definitionCode: 'ELECTION_CERTIFICATION',
      entityType: 'Election',
      entityId_record: election.id,
      initiatedBy: user.userId,
      metadata: { electionId: election.id, title: election.title },
    });

    const row = await this.repo.updateElection(electionId, {
      status: ElectionStatus.CERTIFICATION_PENDING,
      workflowInstanceId: instance.id,
      certifiedBy: user.userId,
      certifiedAt: new Date(),
    });
    await this.logElection(row, user.userId, 'certification.started', {
      workflowInstanceId: instance.id,
    });
    return row;
  }

  /** Called when ELECTION_CERTIFICATION workflow completes. */
  async completeCertificationFromWorkflow(institutionId: string, electionId: string) {
    const election = await this.repo.findElectionRaw(institutionId, electionId);
    if (!election) return;
    await this.repo.updateElection(electionId, {
      status: ElectionStatus.PUBLISHED,
      resultsPublishedAt: new Date(),
    });
  }

  async publishResults(user: AuthUser, electionId: string) {
    if (!this.canManage(user)) throw new ForbiddenException('Requires elections.manage');
    await this.assertElectionsModule(user.institutionId);
    const entityId = this.scopeEntityId(user);
    const election = await this.repo.resolveElection(user.institutionId, electionId, entityId);
    if (!election) throw new NotFoundException('Election not found');
    const row = await this.repo.updateElection(electionId, {
      status: ElectionStatus.PUBLISHED,
      resultsPublishedAt: new Date(),
    });
    await this.logElection(row, user.userId, 'results.published');
    return row;
  }

  auditLog(user: AuthUser, electionId: string) {
    if (!this.canManage(user)) throw new ForbiddenException('Requires elections.manage');
    return this.repo.listAudit(electionId).then((data) => ({ data }));
  }

  private async assertEligibleVoter(
    user: AuthUser,
    election: {
      id: string;
      institutionId: string;
      entityId: string;
      scope: ElectionScope;
      eligibilityOrgUnitId: string | null;
      eligibilityRules: unknown;
    },
  ) {
    const rules = parseEligibilityRules(election.eligibilityRules);
    if (rules.roles?.length && !rules.roles.includes(user.role)) {
      throw new ForbiddenException('You are not eligible to participate in this election');
    }

    if (election.eligibilityOrgUnitId) {
      const staff = await this.prisma.staffProfile.findFirst({
        where: { userId: user.userId, institutionId: user.institutionId, deletedAt: null },
      });
      if (staff && staff.orgUnitId !== election.eligibilityOrgUnitId) {
        throw new ForbiddenException('You are not in the eligible org unit for this election');
      }
    }

    if (user.role === UserRole.STUDENT) {
      const student = await this.prisma.student.findFirst({
        where: { userId: user.userId, institutionId: user.institutionId, deletedAt: null },
      });
      if (!student) throw new ForbiddenException('Student record required for eligibility');
      if (
        !studentMeetsEligibility(student, rules, {
          electionEntityId: election.entityId,
          electionScope: election.scope,
        })
      ) {
        throw new ForbiddenException('You do not meet eligibility rules for this election');
      }
    }

    await this.repo.upsertVoter({
      institutionId: election.institutionId,
      entityId: election.entityId,
      electionId: election.id,
      userId: user.userId,
    });
  }
}

function profileName(profile: unknown): string {
  if (!profile || typeof profile !== 'object') return 'User';
  const p = profile as Record<string, unknown>;
  const first = String(p.firstName ?? '').trim();
  const last = String(p.lastName ?? '').trim();
  return [first, last].filter(Boolean).join(' ') || 'User';
}
