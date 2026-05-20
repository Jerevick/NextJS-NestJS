import { Module } from '@nestjs/common';
import { InstitutionEntitiesModule } from '../institution-entities/institution-entities.module';
import { DashboardController } from './dashboard.controller';
import { DashboardRepository } from './dashboard.repository';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [InstitutionEntitiesModule.register()],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardRepository],
})
export class DashboardModule {}
