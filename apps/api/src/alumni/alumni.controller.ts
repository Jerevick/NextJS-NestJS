import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AlumniMentorshipProgramService } from './alumni-mentorship-program.service';
import { AlumniMentorshipService } from './alumni-mentorship.service';
import { AlumniService } from './alumni.service';
import { RegisterAlumniProfileDto } from './dto/register-alumni-profile.dto';
import { UpdateAlumniProfileDto } from './dto/update-alumni-profile.dto';

/** Phase 12 — Alumni directory, events, jobs, fundraising, mentorship. */
@Controller('alumni')
@UseGuards(PermissionsGuard)
export class AlumniController {
  constructor(
    private readonly alumni: AlumniService,
    private readonly mentorship: AlumniMentorshipService,
    private readonly mentorshipProgramSvc: AlumniMentorshipProgramService,
  ) {}

  @Get('directory')
  @RequirePermissions('alumni.read')
  directory(
    @CurrentUser() user: AuthUser,
    @Query('entityId') entityId?: string,
    @Query('q') q?: string,
    @Query('industry') industry?: string,
    @Query('programmeId') programmeId?: string,
    @Query('graduationYear') graduationYear?: string,
    @Query('chapter') chapter?: string,
    @Query('location') location?: string,
  ) {
    return this.alumni.listDirectory(user, {
      entityId,
      q,
      industry,
      programmeId,
      graduationYear: graduationYear ? Number(graduationYear) : undefined,
      chapter,
      location,
    });
  }

  @Post('profiles/self')
  @RequirePermissions('alumni.read')
  registerSelf(@CurrentUser() user: AuthUser, @Body() dto: UpdateAlumniProfileDto) {
    return this.alumni.registerSelf(user, dto);
  }

  @Post('profiles')
  @RequirePermissions('alumni.write')
  register(@CurrentUser() user: AuthUser, @Body() dto: RegisterAlumniProfileDto) {
    return this.alumni.registerFromStudent(user, dto);
  }

  @Patch('profiles/:id')
  @RequirePermissions('alumni.write')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAlumniProfileDto,
  ) {
    return this.alumni.updateProfile(user, id, dto);
  }

  @Post('profiles/:id/sync-embedding')
  @RequirePermissions('alumni.write')
  syncEmbedding(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.mentorship.syncMentorEmbedding(user.institutionId, id);
  }

  @Post('mentorship/suggest-matches')
  @RequirePermissions('students.read')
  suggestMatches(
    @CurrentUser() user: AuthUser,
    @Query('studentId') studentId: string,
    @Query('includeNarrative') includeNarrative?: string,
  ) {
    return this.mentorship.suggestMatches(user, studentId, {
      includeNarrative: includeNarrative === 'true' || includeNarrative === '1',
    });
  }

  @Get('chapters')
  @RequirePermissions('alumni.read')
  chapters(@CurrentUser() user: AuthUser, @Query('entityId') entityId?: string) {
    return this.alumni.listChapters(user, entityId);
  }

  @Post('chapters')
  @RequirePermissions('alumni.write')
  createChapter(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.alumni.createChapter(user, body as Parameters<AlumniService['createChapter']>[1]);
  }

  @Patch('chapters/:id')
  @RequirePermissions('alumni.write')
  updateChapter(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.alumni.updateChapter(
      user,
      id,
      body as Parameters<AlumniService['updateChapter']>[2],
    );
  }

  @Get('events')
  @RequirePermissions('alumni.read')
  events(@CurrentUser() user: AuthUser, @Query('entityId') entityId?: string) {
    return this.alumni.listEvents(user, entityId);
  }

  @Post('events')
  @RequirePermissions('alumni.write')
  createEvent(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.alumni.createEvent(user, body as Parameters<AlumniService['createEvent']>[1]);
  }

  @Post('events/:id/register')
  @RequirePermissions('alumni.read')
  registerEvent(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body?: { paymentRef?: string; successUrl?: string; cancelUrl?: string },
  ) {
    return this.alumni.registerForEvent(user, id, body);
  }

  @Post('events/:id/confirm-payment')
  @RequirePermissions('alumni.read')
  confirmEventPayment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body('reference') reference: string,
  ) {
    return this.alumni.confirmEventPayment(user, id, reference);
  }

  @Get('chapters/:id/members')
  @RequirePermissions('alumni.read')
  chapterMembers(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.alumni.listChapterMembers(user, id);
  }

  @Post('chapters/:id/members')
  @RequirePermissions('alumni.write')
  addChapterMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body('profileId') profileId: string,
  ) {
    return this.alumni.addChapterMember(user, id, profileId);
  }

  @Post('chapters/:id/members/:profileId/remove')
  @RequirePermissions('alumni.write')
  removeChapterMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('profileId') profileId: string,
  ) {
    return this.alumni.removeChapterMember(user, id, profileId);
  }

  @Get('jobs')
  @RequirePermissions('alumni.read', 'students.read')
  jobs(@CurrentUser() user: AuthUser) {
    return this.alumni.listJobs(user);
  }

  @Post('jobs')
  @RequirePermissions('alumni.write')
  createJob(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.alumni.createJob(user, body as Parameters<AlumniService['createJob']>[1]);
  }

  @Post('jobs/:id/apply')
  @RequirePermissions('students.read')
  applyJob(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { studentId: string; coverNote?: string },
  ) {
    return this.alumni.applyToJob(user, id, body.studentId, body.coverNote);
  }

  @Get('campaigns')
  @RequirePermissions('alumni.read')
  campaigns(@CurrentUser() user: AuthUser) {
    return this.alumni.listCampaigns(user);
  }

  @Post('campaigns')
  @RequirePermissions('alumni.write')
  createCampaign(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.alumni.createCampaign(user, body as Parameters<AlumniService['createCampaign']>[1]);
  }

  @Patch('campaigns/:id/activate')
  @RequirePermissions('alumni.write')
  activateCampaign(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.alumni.activateCampaign(user, id);
  }

  @Post('campaigns/:id/donate')
  @RequirePermissions('alumni.read')
  donate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body()
    body: {
      amount: number;
      anonymous?: boolean;
      message?: string;
      paymentRef?: string;
      successUrl?: string;
      cancelUrl?: string;
    },
  ) {
    return this.alumni.donate(user, id, body);
  }

  @Get('mentorship/programs')
  @RequirePermissions('alumni.read')
  mentorshipPrograms(@CurrentUser() user: AuthUser, @Query('entityId') entityId?: string) {
    return this.mentorshipProgramSvc.listPrograms(user, entityId);
  }

  @Post('mentorship/programs')
  @RequirePermissions('alumni.write')
  createMentorshipProgram(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.mentorshipProgramSvc.createProgram(
      user,
      body as Parameters<AlumniMentorshipProgramService['createProgram']>[1],
    );
  }

  @Get('mentorship/pairs')
  @RequirePermissions('alumni.read')
  mentorshipPairs(@CurrentUser() user: AuthUser, @Query('programId') programId?: string) {
    return this.mentorshipProgramSvc.listPairs(user, programId);
  }

  @Post('mentorship/pairs')
  @RequirePermissions('alumni.write')
  createMentorshipPair(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.mentorshipProgramSvc.createPair(
      user,
      body as Parameters<AlumniMentorshipProgramService['createPair']>[1],
    );
  }

  @Patch('surveys/:id/open')
  @RequirePermissions('alumni.write')
  openSurvey(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body('isOpen') isOpen: boolean,
  ) {
    return this.alumni.openSurvey(user, id, isOpen !== false);
  }

  @Post('newsletters/send')
  @RequirePermissions('alumni.write')
  newsletter(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.alumni.sendNewsletter(user, body as Parameters<AlumniService['sendNewsletter']>[1]);
  }

  @Get('surveys')
  @RequirePermissions('alumni.read')
  surveys(@CurrentUser() user: AuthUser) {
    return this.alumni.listSurveys(user);
  }

  @Post('surveys')
  @RequirePermissions('alumni.write')
  createSurvey(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.alumni.createSurvey(user, body as Parameters<AlumniService['createSurvey']>[1]);
  }

  @Post('surveys/:id/responses')
  @RequirePermissions('alumni.read')
  submitSurvey(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body('answers') answers: Record<string, unknown>,
  ) {
    return this.alumni.submitSurveyResponse(user, id, answers ?? {});
  }

  @Get('surveys/:id/analytics')
  @RequirePermissions('alumni.write')
  surveyAnalytics(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.alumni.surveyAnalytics(user, id);
  }
}
