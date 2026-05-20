import { DynamicModule, Logger, Module } from '@nestjs/common';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { AttendanceModule } from '../attendance/attendance.module';
import { AuditModule } from '../audit/audit.module';
import { CustomizationModule } from '../customization/customization.module';
import { RedisModule } from '../redis/redis.module';
import { WEBHOOK_DELIVERY_QUEUE } from '../queues/queue.constants';
import { IntegrationRegistry } from './integration.registry';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsDeveloperController } from './integrations-developer.controller';
import { IntegrationsRepository } from './integrations.repository';
import { IntegrationsService } from './integrations.service';
import { IntegrationsWebhooksController } from './integrations-webhooks.controller';
import { ICalPublicController } from './ical-public.controller';
import { ICalExportService } from './ical-export.service';
import { WebhookDeliveryProcessor } from './jobs/webhook-delivery.processor';
import {
  BigBlueButtonIntegration,
  GoogleCalendarIntegration,
  GoogleScholarIntegration,
  ICalExportIntegration,
  INTEGRATION_PROVIDER_CLASSES,
  MicrosoftOutlookIntegration,
  MicrosoftTeamsIntegration,
  SlackIntegration,
  TurnitinIntegration,
  TwilioSmsIntegration,
  WhatsAppBusinessIntegration,
  ZoomIntegration,
} from './providers/integration.providers';
import { PublicApiKeysController } from './public-api-keys.controller';
import { PublicApiKeyService } from './public-api-key.service';
import { SyncController } from './sync.controller';
import { UsersMobileController } from './users-mobile.controller';
import { UsersMobileService } from './users-mobile.service';
import { MobileSyncService } from './mobile-sync.service';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookEventsListener } from './webhook-events.listener';
import { WebhooksService } from './webhooks.service';
import { PlatformWebhookEmitter } from './platform-webhook-emitter.service';
import { FieldsSelectionInterceptor } from '../common/interceptors/fields-selection.interceptor';

const log = new Logger('IntegrationsModule');

const INTEGRATION_PROVIDERS = [
  ZoomIntegration,
  BigBlueButtonIntegration,
  MicrosoftTeamsIntegration,
  WhatsAppBusinessIntegration,
  TwilioSmsIntegration,
  SlackIntegration,
  TurnitinIntegration,
  GoogleScholarIntegration,
  GoogleCalendarIntegration,
  MicrosoftOutlookIntegration,
  ICalExportIntegration,
];

@Module({})
export class IntegrationsModule {
  static register(): DynamicModule {
    const useBull = Boolean(process.env.REDIS_URL?.trim());
    if (!useBull) {
      log.warn('REDIS_URL is not set — webhook delivery runs synchronously in-process.');
    }
    return {
      module: IntegrationsModule,
      imports: [
        AuditModule,
        AttendanceModule,
        CustomizationModule,
        RedisModule,
        ...(useBull ? [BullModule.registerQueue({ name: WEBHOOK_DELIVERY_QUEUE })] : []),
      ],
      controllers: [
        IntegrationsController,
        IntegrationsDeveloperController,
        IntegrationsWebhooksController,
        PublicApiKeysController,
        SyncController,
        UsersMobileController,
        ICalPublicController,
      ],
      providers: [
        IntegrationsRepository,
        IntegrationsService,
        IntegrationRegistry,
        WebhooksService,
        WebhookEventsListener,
        PlatformWebhookEmitter,
        PublicApiKeyService,
        MobileSyncService,
        UsersMobileService,
        ICalExportService,
        FieldsSelectionInterceptor,
        ...INTEGRATION_PROVIDERS,
        {
          provide: WebhookDeliveryService,
          useFactory: (repo: IntegrationsRepository, queue?: Queue) =>
            new WebhookDeliveryService(repo, queue),
          inject: [
            IntegrationsRepository,
            ...(useBull ? [getQueueToken(WEBHOOK_DELIVERY_QUEUE)] : []),
          ],
        },
        ...(useBull ? [WebhookDeliveryProcessor] : []),
      ],
      exports: [IntegrationsService, WebhooksService, PublicApiKeyService, PlatformWebhookEmitter],
    };
  }
}

// Ensure provider classes are referenced (tree-shaking / DI)
void INTEGRATION_PROVIDER_CLASSES;
