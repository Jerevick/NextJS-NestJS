import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { ListIntegrationsQueryDto } from './dto/list-integrations-query.dto';
import { WebhooksService } from './webhooks.service';

@ApiTags('integrations-webhooks')
@ApiBearerAuth('JWT')
@Controller('integrations/webhooks')
export class IntegrationsWebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get('events')
  @ApiOperation({ summary: 'Supported webhook event types' })
  events() {
    return { events: this.webhooks.listEvents() };
  }

  @Get()
  @ApiOperation({ summary: 'List webhook subscriptions' })
  list(@CurrentUser() user: AuthUser, @Query() query: ListIntegrationsQueryDto) {
    return this.webhooks.list(user, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create webhook subscription' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWebhookDto) {
    return this.webhooks.create(user, dto);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Send sample payload to webhook URL' })
  test(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.webhooks.test(user, id);
  }

  @Get(':id/deliveries')
  @ApiOperation({ summary: 'Webhook delivery attempt log' })
  deliveries(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() query: ListIntegrationsQueryDto,
  ) {
    return this.webhooks.deliveries(user, id, query);
  }

  @Post(':id/revoke')
  @ApiOperation({ summary: 'Disable and soft-delete webhook' })
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.webhooks.remove(user, id);
  }
}
