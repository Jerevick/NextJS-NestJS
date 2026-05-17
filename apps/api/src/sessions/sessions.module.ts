import { Global, Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LmsAssessmentsModule } from '../lms-assessments/lms-assessments.module';
import { SessionEventsService } from './session-events.service';
import { SessionGateway } from './session.gateway';

@Global()
@Module({
  imports: [AuthModule, forwardRef(() => LmsAssessmentsModule)],
  providers: [SessionGateway, SessionEventsService],
  exports: [SessionEventsService],
})
export class SessionsModule {}
