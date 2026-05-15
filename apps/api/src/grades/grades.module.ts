import { Module } from '@nestjs/common';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { GradesController } from './grades.controller';
import { GradesRepository } from './grades.repository';
import { GradesService } from './grades.service';

@Module({
  controllers: [GradesController],
  providers: [GradesService, GradesRepository, PermissionsGuard, AnyPermissionsGuard],
})
export class GradesModule {}
