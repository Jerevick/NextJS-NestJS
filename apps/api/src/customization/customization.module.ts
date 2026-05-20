import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { StorageModule } from '../storage/storage.module';
import { CustomFormsController } from './custom-forms.controller';
import { FormsController } from './forms.controller';
import { CustomFormsService } from './custom-forms.service';
import { CustomizationController } from './customization.controller';
import { CustomizationRepository } from './customization.repository';
import { CustomizationService } from './customization.service';

@Module({
  imports: [AuditModule, StorageModule],
  controllers: [CustomizationController, CustomFormsController, FormsController],
  providers: [CustomizationRepository, CustomizationService, CustomFormsService],
  exports: [CustomizationService, CustomFormsService],
})
export class CustomizationModule {}
