import { Module } from '@nestjs/common';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AiModule } from '../ai/ai.module';
import { AlumniController } from './alumni.controller';
import { AlumniMentorshipService } from './alumni-mentorship.service';
import { AlumniRepository } from './alumni.repository';
import { AlumniService } from './alumni.service';

@Module({
  imports: [AiModule.register()],
  controllers: [AlumniController],
  providers: [AlumniService, AlumniMentorshipService, AlumniRepository, PermissionsGuard],
  exports: [AlumniService, AlumniMentorshipService],
})
export class AlumniModule {}
