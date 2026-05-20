import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ConfigureIntegrationDto } from './dto/configure-integration.dto';
import { ICalExportService } from './ical-export.service';
import { IntegrationsService } from './integrations.service';

@ApiTags('integrations')
@ApiBearerAuth('JWT')
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly ical: ICalExportService,
  ) {}

  @Get('ical/subscribe-url')
  @ApiOperation({ summary: 'Build read-only iCal subscribe URL for entity' })
  @ApiQuery({ name: 'entityId', required: false })
  icalUrl(@CurrentUser() user: AuthUser, @Query('entityId') entityId?: string) {
    return this.ical.buildSubscribeUrl(user.institutionId, entityId?.trim() || null);
  }

  @Get('marketplace')
  @ApiOperation({ summary: 'List integration marketplace catalog with status' })
  @ApiQuery({ name: 'entityId', required: false })
  marketplace(@CurrentUser() user: AuthUser, @Query('entityId') entityId?: string) {
    return this.integrations.marketplace(user, entityId);
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get integration configuration' })
  @ApiQuery({ name: 'entityId', required: false })
  getConfig(
    @CurrentUser() user: AuthUser,
    @Param('code') code: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.integrations.getConfig(user, code, entityId);
  }

  @Post(':code/configure')
  @ApiOperation({ summary: 'Configure an integration' })
  configure(
    @CurrentUser() user: AuthUser,
    @Param('code') code: string,
    @Body() dto: ConfigureIntegrationDto,
  ) {
    return this.integrations.configure(user, code, dto.entityId, dto.settings, dto.enabled ?? true);
  }

  @Post(':code/test')
  @ApiOperation({ summary: 'Test integration connectivity' })
  @ApiQuery({ name: 'entityId', required: false })
  test(
    @CurrentUser() user: AuthUser,
    @Param('code') code: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.integrations.test(user, code, entityId);
  }

  @Post(':code/disable')
  @ApiOperation({ summary: 'Disable an integration' })
  @ApiQuery({ name: 'entityId', required: false })
  disable(
    @CurrentUser() user: AuthUser,
    @Param('code') code: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.integrations.disable(user, code, entityId);
  }
}
