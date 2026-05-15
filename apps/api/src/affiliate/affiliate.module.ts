import { Module } from '@nestjs/common';
import { AffiliateAdminController } from './affiliate-admin.controller';
import { AffiliatePublicController } from './affiliate-public.controller';
import { AffiliateService } from './affiliate.service';

@Module({
  controllers: [AffiliateAdminController, AffiliatePublicController],
  providers: [AffiliateService],
  exports: [AffiliateService],
})
export class AffiliateModule {}
