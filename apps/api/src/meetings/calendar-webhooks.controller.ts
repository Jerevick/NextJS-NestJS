import { Body, Controller, Headers, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CalendarWebhooksService } from './calendar-webhooks.service';

@Controller('webhooks/calendar')
export class CalendarWebhooksController {
  constructor(private readonly webhooks: CalendarWebhooksService) {}

  @Public()
  @Post('google')
  async google(
    @Headers() headers: Record<string, string | undefined>,
    @Query('meetingId') meetingId: string | undefined,
    @Res() res: Response,
  ) {
    await this.webhooks.handleGooglePush(headers, meetingId);
    res.status(200).send();
  }

  @Public()
  @Post('microsoft')
  async microsoft(
    @Query('validationToken') validationToken: string | undefined,
    @Body() body: { value?: Array<{ resource?: string; changeType?: string }> },
    @Res() res: Response,
  ) {
    if (validationToken) {
      res.contentType('text/plain').send(validationToken);
      return;
    }
    await this.webhooks.handleMicrosoftNotification(body);
    res.status(202).send();
  }
}
