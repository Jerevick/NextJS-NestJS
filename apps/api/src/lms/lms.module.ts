import { Module } from '@nestjs/common';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { LmsController } from './lms.controller';
import { LmsRepository } from './lms.repository';
import { LmsService } from './lms.service';
import { LmsSharedModule } from './lms-shared.module';

@Module({
  imports: [LmsSharedModule],
  controllers: [LmsController],
  providers: [LmsService, LmsRepository, PermissionsGuard],
})
export class LmsFeatureModule {}
