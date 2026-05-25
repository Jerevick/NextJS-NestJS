import { Module } from '@nestjs/common';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AiModule } from '../ai/ai.module';
import { MailService } from '../mail/mail.service';
import { AlumniController } from './alumni.controller';
import { AlumniMentorshipProgramService } from './alumni-mentorship-program.service';
import { AlumniMentorshipService } from './alumni-mentorship.service';
import { AlumniPaymentsService } from './alumni-payments.service';
import { AlumniRepository } from './alumni.repository';
import { AlumniService } from './alumni.service';

/** Phase 12 — Alumni directory, events, jobs, fundraising, AI mentorship. */
@Module({
  imports: [AiModule.register()],
  controllers: [AlumniController],
  providers: [
    AlumniService,
    AlumniMentorshipService,
    AlumniMentorshipProgramService,
    AlumniPaymentsService,
    AlumniRepository,
    MailService,
    PermissionsGuard,
  ],
  exports: [AlumniService, AlumniMentorshipService, AlumniRepository],
})
export class AlumniModule {}
