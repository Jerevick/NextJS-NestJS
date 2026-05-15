import { Module } from '@nestjs/common';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { InstitutionsController } from './institutions.controller';
import { InstitutionsRepository } from './institutions.repository';
import { InstitutionsService } from './institutions.service';

@Module({
  controllers: [InstitutionsController],
  providers: [InstitutionsService, InstitutionsRepository, PermissionsGuard, AnyPermissionsGuard],
  exports: [InstitutionsRepository, InstitutionsService],
})
export class InstitutionsModule {}
