import { Module } from '@nestjs/common';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { TenantModulesModule } from '../common/tenant-modules/tenant-modules.module';
import { InstitutionsController } from './institutions.controller';
import { InstitutionsRepository } from './institutions.repository';
import { InstitutionsService } from './institutions.service';

@Module({
  imports: [TenantModulesModule],
  controllers: [InstitutionsController],
  providers: [InstitutionsService, InstitutionsRepository, PermissionsGuard, AnyPermissionsGuard],
  exports: [InstitutionsRepository, InstitutionsService],
})
export class InstitutionsModule {}
