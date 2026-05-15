import { Global, Module } from '@nestjs/common';
import { SessionEventsService } from './session-events.service';
import { SessionGateway } from './session.gateway';

@Global()
@Module({
  providers: [SessionGateway, SessionEventsService],
  exports: [SessionEventsService],
})
export class SessionsModule {}
