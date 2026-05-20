import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AlumniModule } from '../alumni/alumni.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { DocumentsModule } from '../documents/documents.module';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { FinanceModule } from '../modules/finance';
import { LmsFeatureModule } from '../lms/lms.module';
import { ProgressionModule } from '../progression/progression.module';
import { PortalAcademicTipService } from './portal-academic-tip.service';
import { PortalAlumniService } from './portal-alumni.service';
import { PortalController } from './portal.controller';
import { PortalRepository } from './portal.repository';
import { PortalService } from './portal.service';

@Module({
  imports: [
    FinanceModule,
    ProgressionModule,
    AttendanceModule,
    LmsFeatureModule,
    DocumentsModule,
    AlumniModule,
    AiModule.register(),
    EnrollmentModule.register(),
  ],
  controllers: [PortalController],
  providers: [PortalService, PortalAlumniService, PortalRepository, PortalAcademicTipService],
})
export class PortalModule {}
