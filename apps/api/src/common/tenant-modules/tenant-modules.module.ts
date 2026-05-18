import { Global, Module } from '@nestjs/common';
import { TenantModulesService } from './tenant-modules.service';

@Global()
@Module({
  providers: [TenantModulesService],
  exports: [TenantModulesService],
})
export class TenantModulesModule {}
