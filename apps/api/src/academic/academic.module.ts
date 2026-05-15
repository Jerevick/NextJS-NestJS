import { Module } from '@nestjs/common';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AcademicController } from './academic.controller';
import { AcademicRepository } from './academic.repository';
import { AcademicService } from './academic.service';

@Module({
  controllers: [AcademicController],
  providers: [AcademicService, AcademicRepository, PermissionsGuard, AnyPermissionsGuard],
})
export class AcademicModule {}
