import { NotificationPriority } from '@prisma/client';
import { IsEnum, IsISO8601, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import type { BulkNotificationTarget } from '../notification-bulk.types';
import type { NotificationChannel } from '../notification.types';

const TARGETS = [
  'ALL_INSTITUTION',
  'SPECIFIC_ENTITY',
  'ALL_EXCEPT_ENTITY',
  'BY_PROGRAMME',
] as const satisfies readonly BulkNotificationTarget[];

export class SendBulkNotificationDto {
  @IsEnum(TARGETS)
  target!: BulkNotificationTarget;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  excludeEntityId?: string;

  @IsOptional()
  @IsString()
  programId?: string;

  @IsOptional()
  @IsString()
  event?: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @IsOptional()
  channels?: NotificationChannel[];

  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;
}
