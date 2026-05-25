import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule, ThrottlerStorageService } from '@nestjs/throttler';
import { AcademicModule } from './academic/academic.module';
import { AuditModule } from './audit/audit.module';
import { AdmissionsModule } from './admissions/admissions.module';
import { AffiliateModule } from './affiliate/affiliate.module';
import { AttendanceModule } from './attendance/attendance.module';
import { AuthModule } from './auth/auth.module';
import { BackfillModule } from './backfill/backfill.module';
import { BillingModule } from './billing/billing.module';
import { StorageModule } from './storage/storage.module';
import { DocumentsModule } from './documents/documents.module';
import { EnrollmentModule } from './enrollment/enrollment.module';
import { GradesModule } from './grades/grades.module';
import { HealthModule } from './health/health.module';
import { InstitutionEntitiesModule } from './institution-entities/institution-entities.module';
import { OrgStructureModule } from './org-structure/org-structure.module';
import { WorkflowEngineModule } from './workflow-engine/workflow-engine.module';
import { InstitutionsModule } from './institutions/institutions.module';
import { LmsFeatureModule } from './lms/lms.module';
import { LmsAssessmentsModule } from './lms-assessments/lms-assessments.module';
import { FinanceModule } from './modules/finance';
import { AppraisalModule } from './modules/appraisal';
import { AiModule } from './modules/ai';
import { AlumniModule } from './modules/alumni';
import { SportsModule } from './modules/sports';
import { ElectionsModule } from './modules/elections';
import { LeaveModule } from './modules/leave';
import { MeetingsModule } from './modules/meetings';
import { StaffModule } from './modules/staff';
import { NotificationsModule } from './modules/notifications';
import { CustomizationModule } from './modules/customization';
import { IntegrationsModule } from './modules/integrations';
import { PrismaModule } from './prisma/prisma.module';
import { ProgressionModule } from './progression/progression.module';
import { QueuesModule } from './queues/queues.module';
import { RoomsModule } from './rooms/rooms.module';
import { StudentsModule } from './students/students.module';
import { TranscriptsModule } from './transcripts/transcripts.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { FieldsSelectionInterceptor } from './common/interceptors/fields-selection.interceptor';
import { TenantContextInterceptor } from './common/interceptors/tenant-context.interceptor';
import { EntityScopeGuard } from './common/guards/entity-scope.guard';
import { InstitutionScopeGuard } from './common/guards/institution-scope.guard';
import { PositionGuard } from './common/guards/position.guard';
import { ScopeGuard } from './common/guards/scope.guard';
import { AffiliateApiKeyGuard } from './common/guards/affiliate-api-key.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { StudentRecordPostingGuard } from './common/guards/student-record-posting.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { TenantModulesModule } from './common/tenant-modules/tenant-modules.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { PortalModule } from './portal/portal.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SuperAdminModule } from './super-admin/super-admin.module';
import { RedisThrottlerStorage } from './redis/redis-throttler.storage';
import { RedisModule } from './redis/redis.module';
import { RedisService } from './redis/redis.service';
import { SessionsModule } from './sessions/sessions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redis: RedisService) => {
        const throttlers = [{ name: 'default', ttl: 60_000, limit: 200 }];
        const storage = redis.isEnabled()
          ? new RedisThrottlerStorage(redis)
          : new ThrottlerStorageService();
        return { throttlers, storage };
      },
    }),
    PrismaModule,
    TenantModulesModule,
    StorageModule,
    RedisModule,
    ...(process.env.REDIS_URL?.trim() ? [QueuesModule] : []),
    SessionsModule,
    AuditModule,
    AuthModule,
    InstitutionsModule,
    InstitutionEntitiesModule.register(),
    OrgStructureModule,
    WorkflowEngineModule,
    AffiliateModule,
    BillingModule.register(),
    AdmissionsModule,
    AcademicModule,
    AttendanceModule,
    BackfillModule,
    HealthModule,
    StudentsModule.register(),
    ProgressionModule,
    EnrollmentModule.register(),
    DocumentsModule,
    GradesModule,
    RoomsModule,
    TranscriptsModule,
    MonitoringModule,
    PortalModule,
    DashboardModule,
    SuperAdminModule,
    LmsFeatureModule.register(),
    LmsAssessmentsModule,
    FinanceModule,
    StaffModule,
    LeaveModule,
    AppraisalModule,
    ElectionsModule,
    MeetingsModule,
    AiModule.register(),
    AlumniModule,
    SportsModule.register(),
    NotificationsModule.register(),
    CustomizationModule,
    IntegrationsModule.register(),
  ],
  providers: [
    TenantMiddleware,
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: FieldsSelectionInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: InstitutionScopeGuard },
    { provide: APP_GUARD, useClass: EntityScopeGuard },
    { provide: APP_GUARD, useClass: PositionGuard },
    { provide: APP_GUARD, useClass: ScopeGuard },
    { provide: APP_GUARD, useClass: AffiliateApiKeyGuard },
    { provide: APP_GUARD, useClass: StudentRecordPostingGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
