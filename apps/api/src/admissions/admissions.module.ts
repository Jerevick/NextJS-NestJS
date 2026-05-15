import { Module } from '@nestjs/common';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AdmissionsController } from './admissions.controller';
import { AdmissionsRepository } from './admissions.repository';
import { AdmissionsService } from './admissions.service';

@Module({
  controllers: [AdmissionsController],
  providers: [AdmissionsService, AdmissionsRepository, PermissionsGuard, AnyPermissionsGuard],
})
export class AdmissionsModule {}
