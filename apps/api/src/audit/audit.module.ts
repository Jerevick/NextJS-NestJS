import { Global, Module } from '@nestjs/common';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuditController } from './audit.controller';
import { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';

@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditRepository, PermissionsGuard],
  exports: [AuditService],
})
export class AuditModule {}
