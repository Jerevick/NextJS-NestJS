import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreatePublicApiKeyDto } from './dto/create-public-api-key.dto';
import { ListIntegrationsQueryDto } from './dto/list-integrations-query.dto';
import { PublicApiKeyService } from './public-api-key.service';

@ApiTags('public-api-keys')
@ApiBearerAuth('JWT')
@Controller('integrations/public-api-keys')
export class PublicApiKeysController {
  constructor(private readonly keys: PublicApiKeyService) {}

  @Get()
  @ApiOperation({ summary: 'List institution REST API keys' })
  list(@CurrentUser() user: AuthUser, @Query() query: ListIntegrationsQueryDto) {
    return this.keys.list(user, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create API key (shown once)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePublicApiKeyDto) {
    return this.keys.create(user, dto);
  }

  @Post(':id/revoke')
  @ApiOperation({ summary: 'Revoke API key' })
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.keys.revoke(user, id);
  }
}
