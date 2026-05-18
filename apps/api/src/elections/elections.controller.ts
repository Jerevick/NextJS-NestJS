import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { CandidateStatus } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { BlindSignDto } from './dto/blind-sign.dto';
import { BoothCredentialDto } from './dto/booth-credential.dto';
import { IssueBoothDto } from './dto/issue-booth.dto';
import { CastBoothVoteDto } from './dto/cast-booth-vote.dto';
import { CastVoteDto } from './dto/cast-vote.dto';
import { CreateElectionDto } from './dto/create-election.dto';
import { NominateCandidateDto } from './dto/nominate-candidate.dto';
import { UpdateElectionDto } from './dto/update-election.dto';
import { ElectionDocumentsService } from './election-documents.service';
import { ElectionsService } from './elections.service';

/** Phase 11 elections — blind-signature voting and certification. */
@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('elections')
@UseGuards(PermissionsGuard)
export class ElectionsController {
  constructor(
    private readonly elections: ElectionsService,
    private readonly documents: ElectionDocumentsService,
  ) {}

  @Get()
  @RequirePermissions('elections.read', 'elections.manage')
  list(@CurrentUser() user: AuthUser, @Query('entityId') entityId?: string) {
    return this.elections.list(user, entityId);
  }

  @Post()
  @RequirePermissions('elections.manage')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateElectionDto) {
    return this.elections.create(user, dto);
  }

  @Public()
  @Get('verify/:token')
  verify(@Param('token') token: string) {
    return this.elections.verifyVote(token);
  }

  @Get('candidates/:candidateId/manifesto')
  @RequirePermissions('elections.read', 'elections.manage')
  manifestoUrl(@CurrentUser() user: AuthUser, @Param('candidateId') candidateId: string) {
    return this.documents.getManifestoUrl(user, candidateId);
  }

  @Get(':id')
  @RequirePermissions('elections.read', 'elections.manage')
  getOne(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.elections.getOne(user, id, entityId);
  }

  @Get(':id/candidates')
  @RequirePermissions('elections.read', 'elections.manage')
  candidates(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.elections.listCandidates(user, id, entityId);
  }

  @Patch(':id')
  @RequirePermissions('elections.manage')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateElectionDto) {
    return this.elections.update(user, id, dto);
  }

  @Post(':id/sync-lifecycle')
  @RequirePermissions('elections.manage')
  syncLifecycle(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.elections.syncLifecycle(user, id);
  }

  @Get(':id/ballot')
  @RequirePermissions('elections.read', 'elections.manage')
  ballot(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.elections.ballot(user, id);
  }

  @Post(':id/booth/issue')
  @RequirePermissions('elections.read', 'elections.manage')
  issueBooth(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: IssueBoothDto) {
    return this.elections.issueBoothCredential(user, id, body.ballotCommitment);
  }

  @Post(':id/booth/blind-sign')
  @RequirePermissions('elections.read', 'elections.manage')
  blindSign(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: BlindSignDto) {
    return this.elections.signBlindedBallot(user, id, dto.ballotToken, dto.blindedCommitmentHex);
  }

  @Post(':id/booth/blind-endorse')
  @RequirePermissions('elections.read', 'elections.manage')
  blindEndorse(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { ballotToken: string },
  ) {
    return this.elections.finalizeBlindEndorsement(user, id, body.ballotToken);
  }

  @Public()
  @Post(':id/booth/ballot')
  boothBallot(@Param('id') id: string, @Body() dto: BoothCredentialDto) {
    return this.elections.boothBallot(id, dto);
  }

  @Public()
  @Post(':id/booth/cast')
  castBooth(@Param('id') id: string, @Body() dto: CastBoothVoteDto) {
    return this.elections.castBoothVote(id, dto);
  }

  @Post(':id/vote')
  @RequirePermissions('elections.read', 'elections.manage')
  vote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CastVoteDto) {
    return this.elections.castVote(user, id, dto);
  }

  @Get(':id/results')
  @RequirePermissions('elections.manage')
  results(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.elections.results(user, id);
  }

  @Get(':id/public-results')
  @RequirePermissions('elections.read', 'elections.manage')
  publicResults(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.elections.publicResults(user, id);
  }

  @Post(':id/nominations')
  @RequirePermissions('elections.read', 'elections.manage')
  nominate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: NominateCandidateDto,
  ) {
    return this.elections.nominate(user, id, dto);
  }

  @Post(':id/manifesto-upload')
  @RequirePermissions('elections.read', 'elections.manage')
  @UseInterceptors(FileInterceptor('file'))
  uploadManifesto(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.documents.uploadManifesto(user, id, file);
  }

  @Post(':id/candidates/:candidateId/photo')
  @RequirePermissions('elections.read', 'elections.manage')
  @UseInterceptors(FileInterceptor('file'))
  uploadCandidatePhoto(
    @CurrentUser() user: AuthUser,
    @Param('candidateId') candidateId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.documents.uploadCandidatePhoto(user, candidateId, file);
  }

  @Patch(':id/candidates/:candidateId')
  @RequirePermissions('elections.manage')
  reviewCandidate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('candidateId') candidateId: string,
    @Body() body: { status: CandidateStatus; rejectionReason?: string },
  ) {
    return this.elections.reviewCandidate(user, id, candidateId, body.status, body.rejectionReason);
  }

  @Post(':id/start-certification')
  @RequirePermissions('elections.manage')
  startCertification(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.elections.startCertification(user, id);
  }

  @Post(':id/publish-results')
  @RequirePermissions('elections.manage')
  publish(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.elections.publishResults(user, id);
  }

  @Get(':id/audit')
  @RequirePermissions('elections.manage')
  audit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.elections.auditLog(user, id);
  }
}
