import { Global, Module, forwardRef } from '@nestjs/common';
import { AuthCoreModule } from '../auth/auth-core.module';
import { LmsAssessmentsModule } from '../lms-assessments/lms-assessments.module';
import { SessionEventsService } from './session-events.service';
import { SessionGateway } from './session.gateway';
import { SESSION_REALTIME } from './session-realtime.token';

@Global()
@Module({
  imports: [AuthCoreModule, forwardRef(() => LmsAssessmentsModule)],
  providers: [
    SessionGateway,
    SessionEventsService,
    { provide: SESSION_REALTIME, useExisting: SessionGateway },
  ],
  exports: [SessionEventsService, SessionGateway, SESSION_REALTIME],
})
export class SessionsModule {}
