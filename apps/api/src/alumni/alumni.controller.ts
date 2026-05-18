import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AlumniMentorshipService } from './alumni-mentorship.service';
import { AlumniService } from './alumni.service';
import { RegisterAlumniProfileDto } from './dto/register-alumni-profile.dto';
import { UpdateAlumniProfileDto } from './dto/update-alumni-profile.dto';

@Controller('alumni')
@UseGuards(PermissionsGuard)
export class AlumniController {
  constructor(
    private readonly alumni: AlumniService,
    private readonly mentorship: AlumniMentorshipService,
  ) {}

  @Get('directory')
  @RequirePermissions('alumni.read')
  directory(@CurrentUser() user: AuthUser, @Query('entityId') entityId?: string) {
    return this.alumni.listDirectory(user, entityId);
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

  /** AI mentorship matching — pgvector cosine similarity over mentor expertise embeddings. */
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
}
