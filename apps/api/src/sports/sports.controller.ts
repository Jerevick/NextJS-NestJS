import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { SportsService } from './sports.service';

/** Phase 12 — Sports teams, fixtures, facilities, GPA eligibility. */
@Controller('sports')
@UseGuards(PermissionsGuard)
export class SportsController {
  constructor(private readonly sports: SportsService) {}

  @Get('sport-types')
  @RequirePermissions('sports.read')
  sportTypes(@CurrentUser() user: AuthUser, @Query('entityId') entityId?: string) {
    return this.sports.listSportTypes(user, entityId);
  }

  @Post('sport-types')
  @RequirePermissions('sports.write')
  createSportType(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.sports.createSportType(
      user,
      body as Parameters<SportsService['createSportType']>[1],
    );
  }

  @Get('teams')
  @RequirePermissions('sports.read')
  teams(@CurrentUser() user: AuthUser, @Query('entityId') entityId?: string) {
    return this.sports.listTeams(user, entityId);
  }

  @Post('teams')
  @RequirePermissions('sports.write')
  createTeam(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.sports.createTeam(user, body as Parameters<SportsService['createTeam']>[1]);
  }

  @Post('teams/:teamId/players')
  @RequirePermissions('sports.write')
  addPlayer(
    @CurrentUser() user: AuthUser,
    @Param('teamId') teamId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.sports.addPlayer(user, teamId, body as Parameters<SportsService['addPlayer']>[2]);
  }

  @Get('facilities')
  @RequirePermissions('sports.read')
  facilities(@CurrentUser() user: AuthUser, @Query('entityId') entityId?: string) {
    return this.sports.listFacilities(user, entityId);
  }

  @Post('facilities')
  @RequirePermissions('sports.write')
  createFacility(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.sports.createFacility(user, body as Parameters<SportsService['createFacility']>[1]);
  }

  @Get('bookings')
  @RequirePermissions('sports.read')
  bookings(@CurrentUser() user: AuthUser, @Query('facilityId') facilityId?: string) {
    return this.sports.listBookings(user, facilityId);
  }

  @Post('bookings')
  @RequirePermissions('sports.write')
  createBooking(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.sports.createBooking(user, body as Parameters<SportsService['createBooking']>[1]);
  }

  @Get('competitions')
  @RequirePermissions('sports.read')
  competitions(@CurrentUser() user: AuthUser) {
    return this.sports.listCompetitions(user);
  }

  @Post('competitions')
  @RequirePermissions('sports.write')
  createCompetition(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.sports.createCompetition(
      user,
      body as Parameters<SportsService['createCompetition']>[1],
    );
  }

  @Get('fixtures')
  @RequirePermissions('sports.read')
  fixtures(@CurrentUser() user: AuthUser, @Query('competitionId') competitionId?: string) {
    return this.sports.listFixtures(user, competitionId);
  }

  @Post('fixtures')
  @RequirePermissions('sports.write')
  createFixture(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.sports.createFixture(user, body as Parameters<SportsService['createFixture']>[1]);
  }

  @Patch('fixtures/:id')
  @RequirePermissions('sports.write')
  updateFixture(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.sports.updateFixtureStatistics(
      user,
      id,
      body as Parameters<SportsService['updateFixtureStatistics']>[2],
    );
  }

  @Post('eligibility/recalculate')
  @RequirePermissions('sports.write')
  recalculate(@CurrentUser() user: AuthUser) {
    return this.sports.recalculateEligibility(user);
  }

  @Get('eligibility/at-risk')
  @RequirePermissions('sports.read')
  atRisk(@CurrentUser() user: AuthUser, @Query('includeNarrative') includeNarrative?: string) {
    return this.sports.atRiskAlerts(user, includeNarrative === 'true' || includeNarrative === '1');
  }

  @Get('teams/:teamId/roster')
  @RequirePermissions('sports.read')
  roster(@CurrentUser() user: AuthUser, @Param('teamId') teamId: string) {
    return this.sports.getTeamRoster(user, teamId);
  }

  @Patch('players/:id')
  @RequirePermissions('sports.write')
  updatePlayer(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.sports.updatePlayer(user, id, body as Parameters<SportsService['updatePlayer']>[2]);
  }

  @Post('players/:id/remove')
  @RequirePermissions('sports.write')
  removePlayer(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sports.removePlayer(user, id);
  }

  @Post('players/:id/stats')
  @RequirePermissions('sports.write')
  playerStats(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { stats: Record<string, unknown>; fixtureId?: string },
  ) {
    return this.sports.recordPlayerStats(user, id, body.stats ?? {}, body.fixtureId);
  }

  @Post('competitions/:id/register-team')
  @RequirePermissions('sports.write')
  registerTeam(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body('teamId') teamId: string,
  ) {
    return this.sports.registerTeamForCompetition(user, id, teamId);
  }

  @Get('competitions/:id/entries')
  @RequirePermissions('sports.read')
  competitionEntries(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sports.listCompetitionEntries(user, id);
  }

  @Patch('fixtures/:id/logistics')
  @RequirePermissions('sports.write')
  fixtureLogistics(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body('logistics') logistics: Record<string, unknown>,
  ) {
    return this.sports.updateFixtureLogistics(user, id, logistics ?? {});
  }

  @Get('awards')
  @RequirePermissions('sports.read')
  awards(@CurrentUser() user: AuthUser, @Query('entityId') entityId?: string) {
    return this.sports.listAwards(user, entityId);
  }

  @Post('awards')
  @RequirePermissions('sports.write')
  createAward(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.sports.createAward(user, body as Parameters<SportsService['createAward']>[1]);
  }

  @Get('records')
  @RequirePermissions('sports.read')
  records(@CurrentUser() user: AuthUser, @Query('category') category?: string) {
    return this.sports.listRecords(user, category);
  }

  @Post('records')
  @RequirePermissions('sports.write')
  createRecord(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.sports.createRecord(user, body as Parameters<SportsService['createRecord']>[1]);
  }
}
